import { queryOne } from '../../config/db.js';
import { AppError } from '../../utils/AppError.js';
import { loadTaxFacts } from '../ledger/aggregates.js';
import { getReturn, loadProcessCounts } from '../itr/itr.service.js';
import { ageCategory, getCalculation, getEligibility } from '../tax/tax.service.js';
import { getActiveRuleset } from '../tax/rulesets.js';
import { STEPS, advanceTax, deductionGap, noticeRisk, readinessScore } from './insights.js';

const count = async (sql, caseId) => Number((await queryOne(sql, { caseId })).total);

const loadCase = async (userId, caseId) => {
  const row = await queryOne(
    `SELECT c.id, c.assessment_year, p.dob FROM itr_cases c LEFT JOIN taxpayer_profiles p ON p.user_id = c.user_id
      WHERE c.id = :caseId AND c.user_id = :userId`,
    { caseId, userId },
  );
  if (!row) throw AppError.notFound('Return not found');
  return row;
};

const hasError = (itr, code) => itr.validation.errors.some((e) => e.code === code);

const insightsFor = async ({ kase, caseId, itr, calculation, counts, facts }) => {
  const stale = hasError(itr, 'stale_calculation');
  const hasData = counts.transactions > 0 || Object.keys(facts).length > 0;
  const ruleset = await getActiveRuleset(kase.assessment_year);

  const risk = noticeRisk({ hasData, mismatches: counts.mismatches, missing: counts.missing, escalated: counts.escalated, pendingReview: counts.pendingReview, stale });
  const gap = ruleset
    ? deductionGap({ claimed80c: (facts.deduction_80c ?? 0) / 100, claimed80d: (facts.deduction_80d ?? 0) / 100, ageCategory: ageCategory(kase.dob, kase.assessment_year), caps: ruleset.config.deductionCaps })
    : null;

  const regime = calculation ? calculation.regimes[calculation.recommended] : null;
  return {
    noticeRisk: risk,
    deductionGap: gap && { ...gap, applies: 'old regime only', hasFigures: facts.deduction_80c !== undefined || facts.deduction_80d !== undefined },
    advanceTax: regime ? { ...advanceTax({ netPayable: regime.netPayable }), regime: calculation.recommended } : null,
  };
};

export const getFiling = async (userId, caseId) => {
  const kase = await loadCase(userId, caseId);
  const [documents, transactions, itr, eligibility, { calculation }, processCounts, facts] = await Promise.all([
    count('SELECT COUNT(*) AS total FROM documents WHERE case_id = :caseId', caseId),
    count('SELECT COUNT(*) AS total FROM bank_transactions WHERE case_id = :caseId', caseId),
    getReturn(userId, caseId),
    getEligibility(userId, caseId),
    getCalculation(userId, caseId),
    loadProcessCounts(caseId),
    loadTaxFacts(caseId),
  ]);
  const counts = { documents, transactions, ...processCounts };

  const taxDone = Boolean(calculation) && !['no_calculation', 'no_regime', 'stale_calculation'].some((c) => hasError(itr, c));
  const done = {
    start: eligibility.complete,
    documents: documents > 0,
    review: transactions > 0 && counts.pendingReview === 0,
    reconcile: (Object.keys(facts).length > 0 || Boolean(calculation)) && counts.openReconciliation === 0 && counts.escalated === 0,
    tax: taxDone,
    return: itr.status === 'approved',
  };

  const steps = STEPS.map((s) => ({ key: s.key, label: s.label, path: s.path, done: done[s.key] }));
  const next = steps.find((s) => !s.done) ?? null;

  return {
    assessmentYear: kase.assessment_year,
    status: itr.status,
    steps,
    next: next && { key: next.key, label: next.label, path: next.path },
    readiness: { score: readinessScore(done), blocking: itr.validation.errors.length },
    insights: await insightsFor({ kase, caseId, itr, calculation, counts, facts }),
  };
};
