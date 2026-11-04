import { query, queryOne } from '../../config/db.js';
import { AppError } from '../../utils/AppError.js';
import { recordAudit } from '../../utils/audit.js';
import { NEEDS_REVIEW_SQL, confirmHighConfidence } from '../classification/classification.service.js';
import { getReturn } from '../itr/itr.service.js';
import { getReconciliation, resolveItem } from '../reconciliation/reconciliation.service.js';
import { processDocument } from '../ledger/ledger.service.js';
import { QUESTIONS } from '../tax/eligibility.js';
import { calculateTax, chooseRegime, getCalculation, saveAnswers } from '../tax/tax.service.js';

const assertCaseOwner = async (userId, caseId) => {
  const row = await queryOne('SELECT id, assessment_year FROM itr_cases WHERE id = :caseId AND user_id = :userId', { caseId, userId });
  if (!row) throw AppError.notFound('Return not found');
  return row;
};

// Reads every statement that has not been read yet. A file that cannot be read is reported, not fatal.
const processPending = async (userId, caseId, ip) => {
  const docs = await query("SELECT id, original_name FROM documents WHERE case_id = :caseId AND doc_type = 'bank_statement' AND status = 'uploaded' ORDER BY id", { caseId });
  const failed = [];
  for (const doc of docs) {
    try {
      await processDocument(userId, doc.id, ip);
    } catch (err) {
      failed.push({ name: doc.original_name, message: err instanceof AppError ? err.message : 'This file could not be read.' });
    }
  }
  return { read: docs.length - failed.length, failed };
};

// Rows the engine could not place are left out of income (as they always are until reviewed) so they do not block the return.
const setAsideUncertain = async (caseId) => {
  const result = await query(
    `UPDATE bank_transactions t LEFT JOIN categories c ON c.id = t.category_id
        SET t.user_status = 'ignored'
      WHERE t.case_id = :caseId AND ${NEEDS_REVIEW_SQL}`,
    { caseId },
  );
  return result.affectedRows;
};

// Answers the eligibility questions from what the statements show; a "yes" means a different form is needed.
const inferEligibility = async (userId, caseId, ip) => {
  const rows = await query(
    'SELECT c.code, COUNT(*) AS total FROM bank_transactions t JOIN categories c ON c.id = t.category_id WHERE t.case_id = :caseId GROUP BY c.code',
    { caseId },
  );
  const seen = new Set(rows.map((r) => r.code));
  const answers = Object.fromEntries(QUESTIONS.map((q) => [q.key, q.hintCategory && seen.has(q.hintCategory) ? 'yes' : 'no']));
  await saveAnswers(userId, caseId, answers, ip);
  return answers;
};

// Only one side exists when no tax document was added, so there is nothing to compare; record that and move on.
const acknowledgeMissingDocuments = async (userId, caseId, ip) => {
  const { items } = await getReconciliation(userId, caseId);
  const missing = items.filter((i) => i.status === 'missing');
  for (const item of missing) {
    await resolveItem(userId, item.id, { action: 'resolve', note: 'No tax document added; quick filing used the bank statements only.' }, ip);
  }
  return missing.length;
};

const summarise = (calculation, regime) => {
  const chosen = calculation.regimes[regime];
  const other = calculation.regimes[regime === 'new' ? 'old' : 'new'];
  return {
    regime,
    totalIncome: chosen.grossTotalIncome,
    taxableIncome: chosen.taxableIncome,
    totalTax: chosen.totalTax,
    netPayable: chosen.netPayable,
    savedVersusOther: Math.max(0, other.totalTax - chosen.totalTax),
  };
};

export const quickPrepare = async (userId, caseId, ip) => {
  await assertCaseOwner(userId, caseId);

  const files = await processPending(userId, caseId, ip);
  await confirmHighConfidence(userId, caseId, ip);
  const setAside = await setAsideUncertain(caseId);
  const answers = await inferEligibility(userId, caseId, ip);
  const missingDocuments = await acknowledgeMissingDocuments(userId, caseId, ip);

  const unsupported = Object.entries(answers).filter(([, a]) => a === 'yes').map(([key]) => QUESTIONS.find((q) => q.key === key).why);
  if (unsupported.length) {
    return { status: 'unsupported', files, setAside, reasons: unsupported };
  }

  try {
    await calculateTax(userId, caseId, ip);
  } catch (err) {
    if (err instanceof AppError && err.code === 'INSUFFICIENT_DATA') return { status: 'no_income', files, setAside };
    throw err;
  }

  const { calculation } = await getCalculation(userId, caseId);
  await chooseRegime(userId, caseId, calculation.recommended, ip);
  await recordAudit({ caseId, userId, action: 'quick_prepare', detail: { regime: calculation.recommended, setAside, missingDocuments, answers }, ip });

  return {
    status: 'ready',
    files,
    setAside,
    missingDocuments,
    summary: summarise(calculation, calculation.recommended),
    return: await getReturn(userId, caseId),
  };
};
