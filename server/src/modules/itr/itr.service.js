import { bulkInsert, query, queryOne, transaction } from '../../config/db.js';
import { AppError } from '../../utils/AppError.js';
import { recordAudit } from '../../utils/audit.js';
import { decrypt, sha256 } from '../../utils/crypto.js';
import { stableStringify } from '../../utils/stableStringify.js';
import { NEEDS_REVIEW_SQL } from '../classification/classification.service.js';
import { countOpenItems } from '../reconciliation/reconciliation.service.js';
import { buildComparison, getCalculation, getEligibility } from '../tax/tax.service.js';
import { FORM, buildReturnModel } from './mapper.js';
import { notify } from '../notifications/notifications.service.js';
import { requiredConfirmations, validateReturn } from './validator.js';

const SOURCE_LABELS = { form16: 'Form 16', ais: 'AIS', form26as: 'Form 26AS' };

const loadReturnCase = async (userId, caseId) => {
  const row = await queryOne(
    `SELECT c.id, c.user_id, c.assessment_year, c.status, c.approved_hash, c.approved_at,
            p.full_name, p.pan_encrypted, p.pan_last4, p.dob, p.residential_status, p.address
       FROM itr_cases c LEFT JOIN taxpayer_profiles p ON p.user_id = c.user_id
      WHERE c.id = :caseId AND c.user_id = :userId`,
    { caseId, userId },
  );
  if (!row) throw AppError.notFound('Return not found');
  if (!row.dob) throw AppError.badRequest('Complete your taxpayer profile first', 'PROFILE_REQUIRED');
  return row;
};

const loadDocNames = async (caseId) => {
  const rows = await query(
    'SELECT f.source, d.original_name FROM tax_facts f JOIN documents d ON d.id = f.document_id WHERE f.case_id = :caseId ORDER BY f.id',
    { caseId },
  );
  return Object.fromEntries(rows.reverse().map((r) => [SOURCE_LABELS[r.source], r.original_name]));
};

export const loadProcessCounts = async (caseId) => {
  await countOpenItems(caseId); // refreshes reconciliation items from current data
  const items = await query('SELECT status, COUNT(*) AS total FROM reconciliation_items WHERE case_id = :caseId GROUP BY status', { caseId });
  const count = (status) => Number(items.find((i) => i.status === status)?.total ?? 0);
  const { pending } = await queryOne(
    `SELECT COUNT(*) AS pending FROM bank_transactions t LEFT JOIN categories c ON c.id = t.category_id WHERE t.case_id = :caseId AND ${NEEDS_REVIEW_SQL}`,
    { caseId },
  );
  return { openReconciliation: count('mismatch') + count('missing'), mismatches: count('mismatch'), missing: count('missing'), escalated: count('escalated'), pendingReview: Number(pending) };
};

// The saved calculation is stale if re-running it on today's data gives different numbers.
const isStale = (saved, fresh) => ['taxableIncome', 'totalTax', 'netPayable'].some((k) => Math.abs(saved[k] - fresh[k] / 100) > 0.5);

export const assemble = async (userId, caseId) => {
  const kase = await loadReturnCase(userId, caseId);
  const profile = { fullName: kase.full_name, pan: `XXXXXX${kase.pan_last4}`, dob: kase.dob, residentialStatus: kase.residential_status, address: kase.address };

  const { calculation, chosenRegime } = await getCalculation(userId, caseId);
  const eligibility = await getEligibility(userId, caseId);
  const counts = await loadProcessCounts(caseId);

  let stale = false;
  let fresh = null;
  if (calculation) {
    fresh = await buildComparison({ assessment_year: kase.assessment_year, dob: kase.dob }, caseId);
    stale = ['old', 'new'].some((r) => isStale(calculation.regimes[r], fresh.comparison[r]));
  }

  const calc = chosenRegime && calculation ? calculation.regimes[chosenRegime] : null;
  const sections = calc
    ? buildReturnModel({ assessmentYear: kase.assessment_year, regime: chosenRegime, profile, calc, docNames: await loadDocNames(caseId), panDisplay: profile.pan })
    : null;

  const rulesetVerified = calculation?.ruleset.verified ?? false;
  const context = {
    hasCalculation: Boolean(calculation),
    regimeChosen: Boolean(chosenRegime),
    regime: chosenRegime,
    stale,
    eligibility,
    ...counts,
    salaryEstimated: fresh?.inputs.sources.salary === 'Bank salary credits (estimate)',
    ignoredDeductions: chosenRegime === 'new' && Boolean(fresh && (fresh.inputs.deductions.section80C || fresh.inputs.deductions.section80D)),
    rulesetVerified,
  };
  const validation = validateReturn({ model: sections, kase: { assessmentYear: kase.assessment_year }, profile, context });
  const hash = sections ? sha256(stableStringify({ sections, regime: chosenRegime, assessmentYear: kase.assessment_year, ruleset: calculation.ruleset.version })) : null;

  return { kase, profile, sections, validation, hash, regime: chosenRegime, ruleset: calculation?.ruleset ?? null, rulesetVerified };
};

const persist = async (caseId, { sections, validation }) => {
  await transaction(async (run) => {
    await run('DELETE FROM itr_fields WHERE case_id = :caseId', { caseId });
    if (sections) {
      const rows = sections.flatMap((sec) => sec.fields.map((f) => ({ case_id: caseId, section: sec.title, field_code: f.code, label: f.label, field_value: String(f.value).slice(0, 255), evidence: f.evidence })));
      await bulkInsert(run, 'itr_fields', ['case_id', 'section', 'field_code', 'label', 'field_value', 'evidence'], rows);
    }
    await run('DELETE FROM validation_results WHERE case_id = :caseId AND level IS NOT NULL', { caseId });
    if (validation.issues.length) {
      await bulkInsert(run, 'validation_results', ['case_id', 'level', 'code', 'severity', 'message'], validation.issues.map((i) => ({ case_id: caseId, level: i.level, code: i.code, severity: i.severity, message: i.message.slice(0, 300) })));
    }
  });
};

// Keeps the case status honest: an approval is only valid while the return still matches what was approved.
const syncStatus = async (caseId, state) => {
  const { kase, sections, validation, hash } = state;
  if (kase.status === 'filed') return { status: 'filed', approvalRevoked: false };

  if (kase.approved_hash) {
    if (hash && hash === kase.approved_hash && !validation.blocking) return { status: 'approved', approvalRevoked: false };
    // approved_at is kept so the "approval withdrawn" notice stays visible until the user approves again.
    await query("UPDATE itr_cases SET status = 'needs_review', approved_hash = NULL WHERE id = :caseId", { caseId });
    await notify(kase.user_id, { type: 'approval_withdrawn', title: 'Your approval was withdrawn', body: `Figures for AY ${kase.assessment_year} changed after you approved. Review and approve again.`, link: `/cases/${caseId}/itr`, caseId });
    return { status: 'needs_review', approvalRevoked: true };
  }
  const approvalRevoked = Boolean(kase.approved_at);
  if (!sections) return { status: kase.status, approvalRevoked };

  const status = validation.blocking ? 'needs_review' : 'ready';
  if (status !== kase.status) await query('UPDATE itr_cases SET status = :status WHERE id = :caseId', { status, caseId });
  return { status, approvalRevoked };
};

export const toReturnDto = (state, { status, approvalRevoked }) => ({
  assessmentYear: state.kase.assessment_year,
  form: FORM,
  regime: state.regime,
  status,
  approvalRevoked,
  approvedAt: ['approved', 'filed'].includes(status) ? state.kase.approved_at : null,
  sections: state.sections ?? [],
  validation: { errors: state.validation.errors, warnings: state.validation.warnings },
  confirmations: requiredConfirmations({ rulesetVerified: state.rulesetVerified }),
  canApprove: Boolean(state.sections) && !state.validation.blocking && !['approved', 'filed'].includes(status),
  canExport: ['approved', 'filed'].includes(status),
  filed: status === 'filed',
  ruleset: state.ruleset,
});

export const getReturn = async (userId, caseId) => {
  const state = await assemble(userId, caseId);
  await persist(caseId, state);
  return toReturnDto(state, await syncStatus(caseId, state));
};

export const approveReturn = async (userId, caseId, confirmations, ip) => {
  const state = await assemble(userId, caseId);
  if (!state.sections) throw AppError.badRequest('Calculate your tax and choose a regime first.', 'NOT_READY');
  if (state.validation.blocking) {
    throw new AppError(422, 'VALIDATION_BLOCKING', `Fix the ${state.validation.errors.length} blocking issue(s) before approving.`);
  }
  const openReview = await queryOne("SELECT id FROM expert_reviews WHERE case_id = :caseId AND status IN ('requested','in_review') LIMIT 1", { caseId });
  if (openReview) throw new AppError(409, 'REVIEW_OPEN', 'An expert is still reviewing this return. You can approve once they respond.');
  const missing = requiredConfirmations({ rulesetVerified: state.rulesetVerified }).filter((c) => !confirmations.includes(c.key));
  if (missing.length) {
    throw AppError.badRequest('Please tick every confirmation to approve.', 'CONFIRMATION_REQUIRED', missing.map((c) => ({ field: c.key, message: 'Required' })));
  }

  await query("UPDATE itr_cases SET status = 'approved', approved_hash = :hash, approved_at = NOW() WHERE id = :caseId", { hash: state.hash, caseId });
  await notify(userId, { type: 'return_approved', title: `Your AY ${state.kase.assessment_year} return is approved`, body: 'You can now download the return package.', link: `/cases/${caseId}/itr`, caseId });
  await recordAudit({ caseId, userId, action: 'itr_approve', detail: { hash: state.hash, regime: state.regime, confirmations }, ip });
  return getReturn(userId, caseId);
};

export const exportReturn = async (userId, caseId, ip) => {
  const state = await assemble(userId, caseId);
  if (!['approved', 'filed'].includes(state.kase.status) || !state.hash || state.hash !== state.kase.approved_hash || state.validation.blocking) {
    throw new AppError(409, 'NOT_APPROVED', 'Approve the return before exporting it.');
  }

  const { kase } = state;
  const approvedAt = kase.approved_at;
  await recordAudit({ caseId, userId, action: 'itr_export', detail: { hash: state.hash }, ip });

  return {
    filename: `finora-itr1-ay${kase.assessment_year}.json`,
    body: {
      meta: {
        generator: 'Finora',
        format: 'finora-itr1-internal',
        formatVersion: 1,
        official: false,
        notice: 'This is a review-ready return package, not the official Income Tax Department ITR-1 JSON. Do not upload it to the e-filing portal as is.',
        assessmentYear: kase.assessment_year,
        form: FORM,
        regime: state.regime,
        ruleset: state.ruleset ? { version: state.ruleset.version, source: state.ruleset.source, verifiedByTaxProfessional: state.ruleset.verified } : null,
        approvedAt,
        packageHash: state.hash,
      },
      taxpayer: { name: kase.full_name, pan: decrypt(kase.pan_encrypted), dateOfBirth: kase.dob, residentialStatus: kase.residential_status, address: kase.address },
      sections: Object.fromEntries(state.sections.map((s) => [s.key, { title: s.title, fields: Object.fromEntries(s.fields.map((f) => [f.code, { label: f.label, value: f.value, evidence: f.evidence }])) }])),
    },
  };
};
