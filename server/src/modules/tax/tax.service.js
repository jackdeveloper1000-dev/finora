import { query, queryOne, transaction } from '../../config/db.js';
import { AppError } from '../../utils/AppError.js';
import { recordAudit } from '../../utils/audit.js';
import { financialYear } from '../../utils/financialYear.js';
import { NEEDS_REVIEW_SQL } from '../classification/classification.service.js';
import { countByCategory, loadBankTotals, loadTaxFacts } from '../ledger/aggregates.js';
import { countOpenItems } from '../reconciliation/reconciliation.service.js';
import { compareRegimes } from './calculator.js';
import { QUESTIONS, contradictionWarnings, evaluateEligibility } from './eligibility.js';
import { getActiveRuleset } from './rulesets.js';

const toRupees = (paise) => paise / 100;

const loadCase = async (userId, caseId) => {
  const row = await queryOne(
    `SELECT c.id, c.assessment_year, c.tax_regime, p.dob, p.residential_status
       FROM itr_cases c LEFT JOIN taxpayer_profiles p ON p.user_id = c.user_id
      WHERE c.id = :caseId AND c.user_id = :userId`,
    { caseId, userId },
  );
  if (!row) throw AppError.notFound('Return not found');
  if (!row.dob) throw AppError.badRequest('Complete your taxpayer profile first', 'PROFILE_REQUIRED');
  return row;
};

// Age on the last day of the financial year decides the senior-citizen slabs.
export const ageCategory = (dob, assessmentYear) => {
  const end = new Date(`${financialYear(assessmentYear).end}T00:00:00Z`);
  const born = new Date(`${dob}T00:00:00Z`);
  let age = end.getUTCFullYear() - born.getUTCFullYear();
  if (end.getUTCMonth() < born.getUTCMonth() || (end.getUTCMonth() === born.getUTCMonth() && end.getUTCDate() < born.getUTCDate())) age -= 1;
  return age >= 80 ? 'superSenior' : age >= 60 ? 'senior' : 'general';
};

/* ---------- eligibility ---------- */

const ensureQuestions = (caseId) =>
  Promise.all(
    QUESTIONS.map((q) =>
      query('INSERT IGNORE INTO questions (case_id, question_key, topic, question, why_needed) VALUES (:caseId, :key, :topic, :question, :why)', {
        caseId, key: q.key, topic: q.topic, question: q.question.slice(0, 300), why: q.why.slice(0, 300),
      }),
    ),
  );

const loadAnswers = async (caseId) => {
  const rows = await query('SELECT question_key, answer FROM questions WHERE case_id = :caseId', { caseId });
  return Object.fromEntries(rows.filter((r) => r.answer).map((r) => [r.question_key, r.answer]));
};

export const getEligibility = async (userId, caseId, { grossTotalIncome = null } = {}) => {
  const kase = await loadCase(userId, caseId);
  await ensureQuestions(caseId);
  const answers = await loadAnswers(caseId);
  const result = evaluateEligibility({ answers, residentialStatus: kase.residential_status, grossTotalIncome });
  const warnings = contradictionWarnings(answers, await countByCategory(caseId));

  return {
    ...result,
    warnings,
    questions: QUESTIONS.map((q) => ({ key: q.key, question: q.question, why: q.why, answer: answers[q.key] ?? null })),
  };
};

export const saveAnswers = async (userId, caseId, answers, ip) => {
  await loadCase(userId, caseId);
  await ensureQuestions(caseId);
  const valid = new Set(QUESTIONS.map((q) => q.key));
  const unknown = Object.keys(answers).filter((k) => !valid.has(k));
  if (unknown.length) throw AppError.badRequest('Unknown question', 'VALIDATION_ERROR', unknown.map((k) => ({ field: `answers.${k}`, message: 'Unknown question' })));

  for (const [key, answer] of Object.entries(answers)) {
    await query('UPDATE questions SET answer = :answer, answered_at = NOW() WHERE case_id = :caseId AND question_key = :key', { caseId, key, answer });
  }
  await recordAudit({ caseId, userId, action: 'eligibility_answers', detail: answers, ip });
  return getEligibility(userId, caseId);
};

/* ---------- calculation ---------- */

// Prefers the authoritative tax document; falls back to the bank ledger and says so.
const pick = (documentValue, documentLabel, bankValue, bankLabel) =>
  documentValue > 0 ? { value: documentValue, source: documentLabel } : { value: bankValue, source: bankValue > 0 ? bankLabel : null };

const gatherInputs = async (caseId) => {
  const bank = await loadBankTotals(caseId);
  const facts = await loadTaxFacts(caseId);

  const salary = pick(facts.gross_salary ?? 0, 'Form 16', bank.salary, 'Bank salary credits (estimate)');
  // Interest and dividends: the higher of AIS and your statements, so nothing is under-reported.
  const interest = (facts.ais_interest ?? 0) >= bank.interest ? pick(facts.ais_interest ?? 0, 'AIS', 0, null) : pick(bank.interest, 'Bank statements', 0, null);
  const dividend = (facts.ais_dividend ?? 0) >= bank.dividend ? pick(facts.ais_dividend ?? 0, 'AIS', 0, null) : pick(bank.dividend, 'Bank statements', 0, null);
  const tds = facts.tds_total_26as ? { value: facts.tds_total_26as, source: 'Form 26AS' } : { value: facts.tds_salary ?? 0, source: facts.tds_salary ? 'Form 16' : null };
  const advance = facts.tax_challans ? { value: facts.tax_challans, source: 'Form 26AS' } : { value: bank.taxPaid, source: bank.taxPaid ? 'Bank statements' : null };

  return {
    income: { salaryGross: salary.value, interest: interest.value, dividend: dividend.value },
    deductions: { section80C: facts.deduction_80c ?? 0, section80D: facts.deduction_80d ?? 0 },
    credits: { tds: tds.value, advanceTax: advance.value },
    sources: {
      salary: salary.source, interest: interest.source, dividend: dividend.source, tds: tds.source, advanceTax: advance.source,
      section80C: facts.deduction_80c ? 'Form 16' : null, section80D: facts.deduction_80d ? 'Form 16' : null,
    },
  };
};

const buildWarnings = async (caseId, ruleset, inputs) => {
  const warnings = [];
  if (!ruleset.config.meta.verifiedBy) warnings.push('These tax rules have not yet been verified by a tax professional. Treat the figures as an estimate.');
  if (inputs.sources.salary === 'Bank salary credits (estimate)') warnings.push('Salary is estimated from bank credits (after TDS). Add your Form 16 gross salary for an accurate result.');

  const { open } = await countOpenItems(caseId);
  if (open > 0) warnings.push(`${open} reconciliation item(s) are still unresolved.`);
  const { pending } = await queryOne(
    `SELECT COUNT(*) AS pending FROM bank_transactions t LEFT JOIN categories c ON c.id = t.category_id WHERE t.case_id = :caseId AND ${NEEDS_REVIEW_SQL}`,
    { caseId },
  );
  if (Number(pending) > 0) warnings.push(`${pending} transaction(s) still need review and are not counted as income.`);
  return warnings;
};

const mapSteps = (steps) => steps.map((s) => ({ ...s, amount: toRupees(s.amount) }));

const toStored = (calc) => ({
  regime: calc.regime,
  label: calc.label,
  grossTotalIncome: toRupees(calc.grossTotalIncome),
  deductions: toRupees(calc.deductions),
  taxableIncome: toRupees(calc.taxableIncome),
  totalTax: toRupees(calc.totalTax),
  netPayable: toRupees(calc.netPayable),
  steps: mapSteps(calc.steps),
});

// Runs the calculation from the current data without saving. Also used to detect stale saved results.
export const buildComparison = async (kase, caseId) => {
  const ruleset = await getActiveRuleset(kase.assessment_year);
  if (!ruleset) throw new AppError(503, 'RULESET_MISSING', `Tax rules for AY ${kase.assessment_year} are not available yet.`);
  const inputs = await gatherInputs(caseId);
  return { ruleset, inputs, comparison: compareRegimes({ ruleset, ageCategory: ageCategory(kase.dob, kase.assessment_year), ...inputs }) };
};

export const calculateTax = async (userId, caseId, ip) => {
  const kase = await loadCase(userId, caseId);

  const eligibility = await getEligibility(userId, caseId);
  if (!eligibility.complete) throw new AppError(422, 'ELIGIBILITY_INCOMPLETE', 'Answer the eligibility questions first.');

  const { ruleset, inputs, comparison } = await buildComparison(kase, caseId);
  if (!inputs.income.salaryGross && !inputs.income.interest && !inputs.income.dividend) {
    throw new AppError(422, 'INSUFFICIENT_DATA', 'No income found yet. Upload a bank statement or add your Form 16 figures first.');
  }
  const finalEligibility = await getEligibility(userId, caseId, { grossTotalIncome: comparison.new.grossTotalIncome });
  if (!finalEligibility.supported) {
    throw new AppError(422, 'NOT_SUPPORTED', 'This return is outside what Finora can prepare. A tax professional should handle it.');
  }

  const warnings = await buildWarnings(caseId, ruleset, inputs);
  await transaction(async (run) => {
    for (const regime of ['old', 'new']) {
      const stored = toStored(comparison[regime]);
      await run(
        `INSERT INTO tax_calculations (case_id, ruleset_id, regime, gross_income, deductions, taxable_income, tax_payable, tds_credit, net_payable, trace_json)
         VALUES (:caseId, :rulesetId, :regime, :gross, :deductions, :taxable, :tax, :credit, :net, :trace)`,
        {
          caseId, rulesetId: ruleset.id, regime,
          gross: stored.grossTotalIncome, deductions: stored.deductions, taxable: stored.taxableIncome, tax: stored.totalTax,
          credit: toRupees(inputs.credits.tds + inputs.credits.advanceTax), net: stored.netPayable,
          trace: JSON.stringify({ steps: stored.steps, warnings, label: stored.label }),
        },
      );
    }
    await run("UPDATE itr_cases SET itr_form = 'ITR-1' WHERE id = :caseId", { caseId });
  });

  await recordAudit({ caseId, userId, action: 'tax_calculate', detail: { rulesetId: ruleset.id, recommended: comparison.recommended }, ip });
  return getCalculation(userId, caseId);
};

const latestFor = (caseId, regime) =>
  queryOne('SELECT c.*, r.version, r.config_json FROM tax_calculations c JOIN tax_rulesets r ON r.id = c.ruleset_id WHERE c.case_id = :caseId AND c.regime = :regime ORDER BY c.id DESC LIMIT 1', { caseId, regime });

const parse = (value) => (typeof value === 'string' ? JSON.parse(value) : value);

const toDto = (row) => {
  const trace = parse(row.trace_json);
  return {
    regime: row.regime,
    label: trace.label,
    grossTotalIncome: Number(row.gross_income),
    deductions: Number(row.deductions),
    taxableIncome: Number(row.taxable_income),
    totalTax: Number(row.tax_payable),
    netPayable: Number(row.net_payable),
    steps: trace.steps,
  };
};

export const getCalculation = async (userId, caseId) => {
  const kase = await loadCase(userId, caseId);
  const [oldRow, newRow] = await Promise.all([latestFor(caseId, 'old'), latestFor(caseId, 'new')]);
  if (!oldRow || !newRow) return { calculation: null, chosenRegime: kase.tax_regime };

  const config = parse(newRow.config_json);
  const regimes = { old: toDto(oldRow), new: toDto(newRow) };
  return {
    calculation: {
      calculatedAt: newRow.created_at,
      ruleset: { version: newRow.version, source: config.meta.source, verified: Boolean(config.meta.verifiedBy), financialYear: config.meta.financialYear },
      regimes,
      recommended: regimes.new.totalTax <= regimes.old.totalTax ? 'new' : 'old',
      savings: Math.abs(regimes.new.totalTax - regimes.old.totalTax),
      warnings: parse(newRow.trace_json).warnings ?? [],
    },
    chosenRegime: kase.tax_regime,
  };
};

export const chooseRegime = async (userId, caseId, regime, ip) => {
  await loadCase(userId, caseId);
  if (!(await latestFor(caseId, regime))) throw AppError.badRequest('Calculate your tax first.', 'NO_CALCULATION');
  await query('UPDATE itr_cases SET tax_regime = :regime WHERE id = :caseId', { regime, caseId });
  await recordAudit({ caseId, userId, action: 'tax_regime_choose', detail: { regime }, ip });
  return getCalculation(userId, caseId);
};
