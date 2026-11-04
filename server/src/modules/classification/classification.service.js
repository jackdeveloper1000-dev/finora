import { query, queryOne } from '../../config/db.js';
import { AppError } from '../../utils/AppError.js';
import { recordAudit } from '../../utils/audit.js';
import { HIGH_CONFIDENCE, classifyTransaction } from './rules.js';
import { similarKey } from './similarity.js';

// Needs `bank_transactions t LEFT JOIN categories c ON c.id = t.category_id`.
// Spending categories don't affect tax, so only unknown or low-confidence tax-relevant items need a person.
export const NEEDS_REVIEW_SQL = `(t.user_status = 'unreviewed' AND (t.category_id IS NULL OR c.code = 'unknown'
  OR (t.ai_confidence < ${HIGH_CONFIDENCE} AND c.tax_head <> 'not_taxable')))`;

const findOwnedTransaction = async (userId, id) => {
  const row = await queryOne(
    `SELECT t.* FROM bank_transactions t JOIN itr_cases ic ON ic.id = t.case_id WHERE t.id = :id AND ic.user_id = :userId`,
    { id, userId },
  );
  if (!row) throw AppError.notFound('Transaction not found');
  return row;
};

const assertCaseOwner = async (userId, caseId) => {
  const row = await queryOne('SELECT id FROM itr_cases WHERE id = :caseId AND user_id = :userId', { caseId, userId });
  if (!row) throw AppError.notFound('Return not found');
};

const findCategory = async (code) => {
  const category = await queryOne('SELECT id, code FROM categories WHERE code = :code', { code });
  if (!category) throw AppError.badRequest('Unknown category', 'VALIDATION_ERROR', [{ field: 'categoryCode', message: 'Unknown category' }]);
  return category;
};

// `ids` come from the database (integers), so they are safe to inline in an IN list.
const updateByIds = (ids, setClause, params) =>
  ids.length ? query(`UPDATE bank_transactions SET ${setClause} WHERE id IN (${ids.join(',')})`, params) : Promise.resolve();

export const listCategories = async () => {
  const rows = await query("SELECT code, label, tax_head FROM categories ORDER BY code = 'unknown', label");
  return rows.map((r) => ({ code: r.code, label: r.label, taxHead: r.tax_head }));
};

// Re-runs rules for rows nobody has reviewed. A person's decision is never overwritten.
export const classifyCase = async (caseId) => {
  const rows = await query(
    `SELECT id, description, debit, credit FROM bank_transactions
      WHERE case_id = :caseId AND (classified_by IS NULL OR (classified_by = 'rule' AND user_status = 'unreviewed'))`,
    { caseId },
  );
  const categories = new Map((await query('SELECT id, code FROM categories')).map((c) => [c.code, c.id]));

  const groups = new Map();
  for (const row of rows) {
    const result = classifyTransaction({ description: row.description, debit: Number(row.debit), credit: Number(row.credit) });
    const key = `${result.code}|${result.confidence}|${result.reason}`;
    groups.set(key, { ...result, ids: [...(groups.get(key)?.ids ?? []), row.id] });
  }

  for (const group of groups.values()) {
    await updateByIds(group.ids, "category_id = :category, ai_confidence = :confidence, classified_by = 'rule', class_reason = :reason", {
      category: categories.get(group.code),
      confidence: group.confidence,
      reason: group.reason.slice(0, 160),
    });
  }
  return rows.length;
};

const findSimilar = async (txn) => {
  const key = similarKey(txn.description);
  if (!key) return [];
  const rows = await query(
    `SELECT id, description, category_id FROM bank_transactions
      WHERE case_id = :caseId AND id <> :id AND user_status = 'unreviewed' AND (credit > 0) = :isCredit`,
    { caseId: txn.case_id, id: txn.id, isCredit: Number(txn.credit) > 0 ? 1 : 0 },
  );
  return rows.filter((r) => similarKey(r.description) === key);
};

export const countSimilar = async (userId, id) => ({ count: (await findSimilar(await findOwnedTransaction(userId, id))).length });

const applyCategory = async (txn, category, similar) => {
  const changed = (row) => (row.category_id === category.id ? 'confirmed' : 'corrected');
  const targets = [txn, ...similar];

  for (const status of ['confirmed', 'corrected']) {
    await updateByIds(
      targets.filter((row) => changed(row) === status).map((row) => row.id),
      "category_id = :category, ai_confidence = 1, classified_by = 'user', class_reason = 'Set by you', user_status = :status",
      { category: category.id, status },
    );
  }
};

export const updateTransaction = async (userId, id, { action, categoryCode, applyToSimilar }, ip) => {
  const txn = await findOwnedTransaction(userId, id);
  let updated = 1;

  if (action === 'categorize') {
    const category = await findCategory(categoryCode);
    const similar = applyToSimilar ? await findSimilar(txn) : [];
    await applyCategory(txn, category, similar);
    updated += similar.length;
  } else if (action === 'confirm') {
    const category = txn.category_id && (await queryOne('SELECT code FROM categories WHERE id = :id', { id: txn.category_id }));
    if (!category || category.code === 'unknown') {
      throw AppError.badRequest('Choose a category before confirming.', 'CATEGORY_REQUIRED');
    }
    await query("UPDATE bank_transactions SET user_status = 'confirmed' WHERE id = :id", { id });
  } else if (action === 'ignore') {
    await query("UPDATE bank_transactions SET user_status = 'ignored' WHERE id = :id", { id });
  } else {
    await query("UPDATE bank_transactions SET user_status = 'unreviewed', classified_by = NULL WHERE id = :id", { id });
    await classifyCase(txn.case_id);
  }

  await recordAudit({ caseId: txn.case_id, userId, action: 'txn_classify', detail: { transactionId: id, action, categoryCode, updated }, ip });
  return { updated };
};

export const confirmHighConfidence = async (userId, caseId, ip) => {
  await assertCaseOwner(userId, caseId);
  const result = await query(
    `UPDATE bank_transactions t JOIN categories c ON c.id = t.category_id
        SET t.user_status = 'confirmed'
      WHERE t.case_id = :caseId AND t.user_status = 'unreviewed' AND t.ai_confidence >= ${HIGH_CONFIDENCE} AND c.code <> 'unknown'`,
    { caseId },
  );
  await recordAudit({ caseId, userId, action: 'txn_confirm_high_confidence', detail: { confirmed: result.affectedRows }, ip });
  return { confirmed: result.affectedRows };
};

export const getReviewStats = async (caseId) => {
  const counts = await queryOne(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(${NEEDS_REVIEW_SQL}), 0) AS needs_review,
            COALESCE(SUM(t.user_status IN ('confirmed','corrected')), 0) AS reviewed,
            COALESCE(SUM(t.user_status = 'ignored'), 0) AS ignored,
            COALESCE(SUM(t.user_status = 'unreviewed' AND t.ai_confidence >= ${HIGH_CONFIDENCE} AND c.code <> 'unknown'), 0) AS ready_to_confirm
       FROM bank_transactions t LEFT JOIN categories c ON c.id = t.category_id WHERE t.case_id = :caseId`,
    { caseId },
  );
  const byCategory = await query(
    `SELECT c.code, c.label, c.tax_head, COUNT(*) AS count, COALESCE(SUM(t.credit),0) AS credits, COALESCE(SUM(t.debit),0) AS debits
       FROM bank_transactions t LEFT JOIN categories c ON c.id = t.category_id
      WHERE t.case_id = :caseId AND t.user_status <> 'ignored'
      GROUP BY c.id ORDER BY (SUM(t.credit) + SUM(t.debit)) DESC`,
    { caseId },
  );

  return {
    needsReview: Number(counts.needs_review),
    reviewed: Number(counts.reviewed),
    ignored: Number(counts.ignored),
    readyToConfirm: Number(counts.ready_to_confirm),
    byCategory: byCategory.map((r) => ({
      code: r.code ?? 'unknown',
      label: r.label ?? 'Unclassified',
      taxHead: r.tax_head ?? 'not_taxable',
      count: Number(r.count),
      credits: Number(r.credits),
      debits: Number(r.debits),
    })),
  };
};
