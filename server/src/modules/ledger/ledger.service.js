import { bulkInsert, query, queryOne, transaction } from '../../config/db.js';
import { AppError } from '../../utils/AppError.js';
import { recordAudit } from '../../utils/audit.js';
import { sha256 } from '../../utils/crypto.js';
import { financialYear } from '../../utils/financialYear.js';
import { notify } from '../notifications/notifications.service.js';
import { NEEDS_REVIEW_SQL, classifyCase, getReviewStats } from '../classification/classification.service.js';
import { findOwnedDocument, readStoredFile } from '../documents/documents.service.js';
import { buildIssues, reconcileBalances } from './integrity.js';
import { parseStatement } from './parsers/index.js';

const UNKNOWN_BANK = 'Unknown bank';
const UNKNOWN_LAST4 = 'XXXX';
const TXN_COLUMNS = ['case_id', 'account_id', 'document_id', 'txn_date', 'description', 'debit', 'credit', 'balance', 'source_row', 'dup_hash'];

const toRupees = (paise) => (paise === null ? null : (paise / 100).toFixed(2));
const normalize = (text) => text.toLowerCase().replace(/\s+/g, ' ').trim();

// Identical rows in one file are legitimate (same amount, same day), so the occurrence index
// is part of the hash. The same occurrence in an overlapping statement then hashes identically.
const withDupHashes = (transactions) => {
  const seen = new Map();
  return transactions.map((t) => {
    const base = [t.date, t.debit, t.credit, t.balance ?? '', normalize(t.description)].join('|');
    const occurrence = seen.get(base) ?? 0;
    seen.set(base, occurrence + 1);
    return { ...t, dupHash: sha256(`${base}|${occurrence}`) };
  });
};

const findOrCreateAccount = async (run, caseId, { bankName, accountLast4 }) => {
  const name = bankName ?? UNKNOWN_BANK;
  const last4 = accountLast4 ?? UNKNOWN_LAST4;
  const [existing] = await run('SELECT id FROM bank_accounts WHERE case_id = :caseId AND bank_name = :name AND account_last4 = :last4', { caseId, name, last4 });
  if (existing) return existing.id;
  const result = await run('INSERT INTO bank_accounts (case_id, bank_name, account_last4) VALUES (:caseId, :name, :last4)', { caseId, name, last4 });
  return result.insertId;
};

const markFailed = (id, status, message) =>
  query('UPDATE documents SET status = :status, error_message = :message WHERE id = :id', { id, status, message: message.slice(0, 255) });

const persist = async (doc, parsed, fy) => {
  const hashed = withDupHashes(parsed.transactions);
  const balance = reconcileBalances(parsed.transactions);

  return transaction(async (run) => {
    const accountId = await findOrCreateAccount(run, doc.case_id, parsed);
    // Reprocessing refreshes untouched rows but never discards a person's decision (confirmed, corrected or ignored).
    await run("DELETE FROM bank_transactions WHERE document_id = :id AND user_status = 'unreviewed' AND COALESCE(classified_by, '') <> 'user'", { id: doc.id });
    const kept = new Set((await run('SELECT dup_hash FROM bank_transactions WHERE document_id = :id', { id: doc.id })).map((r) => r.dup_hash));
    await run('DELETE FROM validation_results WHERE document_id = :id', { id: doc.id });

    const rows = hashed.map((t) => ({
      case_id: doc.case_id,
      account_id: accountId,
      document_id: doc.id,
      txn_date: t.date,
      description: t.description.slice(0, 500),
      debit: toRupees(t.debit),
      credit: toRupees(t.credit),
      balance: toRupees(t.balance),
      source_row: t.rowNumber,
      dup_hash: t.dupHash,
    }));
    const inserted = await bulkInsert(run, 'bank_transactions', TXN_COLUMNS, rows, { ignore: true });
    const duplicates = rows.length - inserted - rows.filter((r) => kept.has(r.dup_hash)).length;

    const issues = buildIssues({ parsed, balance, inserted, duplicates, fy });
    if (issues.length) {
      await bulkInsert(run, 'validation_results', ['case_id', 'document_id', 'severity', 'message'], issues.map((i) => ({ case_id: doc.case_id, document_id: doc.id, ...i })));
    }

    const warnings = issues.filter((i) => i.severity !== 'info');
    await run('UPDATE documents SET status = :status, error_message = :message WHERE id = :id', {
      id: doc.id,
      status: warnings.length ? 'needs_review' : 'extracted',
      message: warnings[0]?.message.slice(0, 255) ?? null,
    });
    return { inserted, duplicates, issues, balance };
  });
};

export const processDocument = async (userId, documentId, ip) => {
  const doc = await findOwnedDocument(userId, documentId);
  if (doc.doc_type !== 'bank_statement') {
    throw AppError.badRequest('Only bank statements can be processed right now.', 'UNSUPPORTED_DOC_TYPE');
  }

  const claim = await query("UPDATE documents SET status = 'processing', error_message = NULL WHERE id = :id AND status <> 'processing'", { id: doc.id });
  if (!claim.affectedRows) throw AppError.conflict('This document is already being processed.', 'ALREADY_PROCESSING');

  try {
    const { assessment_year: assessmentYear } = await queryOne('SELECT assessment_year FROM itr_cases WHERE id = :id', { id: doc.case_id });
    const parsed = await parseStatement(await readStoredFile(doc), doc.mime_type);
    const result = await persist(doc, parsed, { ...financialYear(assessmentYear), assessmentYear });
    await classifyCase(doc.case_id);
    await recordAudit({ caseId: doc.case_id, userId, action: 'document_process', detail: { documentId: doc.id, transactions: parsed.transactions.length, inserted: result.inserted }, ip });

    await notify(userId, { type: 'document_processed', title: `${doc.original_name} was processed`, body: `${parsed.transactions.length} transactions read, ${result.inserted} added.`, link: `/cases/${doc.case_id}/transactions`, caseId: doc.case_id });
    const dates = parsed.transactions.map((t) => t.date).sort();
    return {
      status: result.issues.some((i) => i.severity !== 'info') ? 'needs_review' : 'extracted',
      bankName: parsed.bankName ?? UNKNOWN_BANK,
      accountLast4: parsed.accountLast4 ?? UNKNOWN_LAST4,
      transactions: parsed.transactions.length,
      added: result.inserted,
      duplicates: result.duplicates,
      period: { from: dates[0], to: dates.at(-1) },
      issues: result.issues,
    };
  } catch (err) {
    const parserRejected = err instanceof AppError && ['NO_TRANSACTIONS', 'UNREADABLE_FILE'].includes(err.code);
    await markFailed(doc.id, parserRejected ? 'rejected' : 'uploaded', err instanceof AppError ? err.message : 'Processing failed. Please try again.');
    throw err;
  }
};

const assertCaseOwner = async (userId, caseId) => {
  const row = await queryOne('SELECT id, assessment_year FROM itr_cases WHERE id = :caseId AND user_id = :userId', { caseId, userId });
  if (!row) throw AppError.notFound('Return not found');
  return row;
};

const escapeLike = (text) => text.replace(/[\\%_]/g, '\\$&');

const LIST_FILTERS = {
  all: '1 = 1',
  review: NEEDS_REVIEW_SQL,
  reviewed: "t.user_status IN ('confirmed','corrected')",
  ignored: "t.user_status = 'ignored'",
};

export const listTransactions = async (userId, caseId, { page, pageSize, q, filter, category }) => {
  await assertCaseOwner(userId, caseId);
  const params = { caseId, q: q ? `%${escapeLike(q)}%` : null, category: category ?? null };
  const from = 'FROM bank_transactions t LEFT JOIN categories c ON c.id = t.category_id';
  const where = `WHERE t.case_id = :caseId AND (:q IS NULL OR t.description LIKE :q) AND (:category IS NULL OR c.code = :category) AND ${LIST_FILTERS[filter]}`;

  const { total } = await queryOne(`SELECT COUNT(*) AS total ${from} ${where}`, params);
  // page/pageSize are validated integers, so inlining them is safe (LIMIT can't be a bound parameter here).
  const rows = await query(
    `SELECT t.*, c.code AS category_code, c.label AS category_label, c.tax_head, a.bank_name, a.account_last4, d.original_name,
            ${NEEDS_REVIEW_SQL} AS needs_review
       ${from}
       JOIN bank_accounts a ON a.id = t.account_id
       JOIN documents d ON d.id = t.document_id
       ${where}
      ORDER BY t.txn_date DESC, t.id DESC
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
    params,
  );

  return {
    total: Number(total),
    page,
    pageSize,
    items: rows.map((r) => ({
      id: r.id,
      date: r.txn_date,
      description: r.description,
      debit: Number(r.debit),
      credit: Number(r.credit),
      balance: r.balance === null ? null : Number(r.balance),
      account: { bankName: r.bank_name, last4: r.account_last4 },
      source: { documentId: r.document_id, name: r.original_name, row: r.source_row },
      category: { code: r.category_code ?? 'unknown', label: r.category_label ?? 'Unclassified', taxHead: r.tax_head ?? 'not_taxable' },
      confidence: r.ai_confidence === null ? null : Number(r.ai_confidence),
      classifiedBy: r.classified_by,
      reason: r.class_reason,
      status: r.user_status,
      needsReview: Boolean(Number(r.needs_review)),
    })),
  };
};

export const getLedgerSummary = async (userId, caseId) => {
  const { assessment_year: assessmentYear } = await assertCaseOwner(userId, caseId);

  const totals = await queryOne(
    'SELECT COUNT(*) AS count, COALESCE(SUM(credit),0) AS credits, COALESCE(SUM(debit),0) AS debits, MIN(txn_date) AS first, MAX(txn_date) AS last FROM bank_transactions WHERE case_id = :caseId',
    { caseId },
  );
  const monthly = await query("SELECT DATE_FORMAT(txn_date,'%Y-%m') AS ym, COUNT(*) AS count FROM bank_transactions WHERE case_id = :caseId GROUP BY ym", { caseId });
  const accounts = await query(
    `SELECT a.id, a.bank_name, a.account_last4, COUNT(t.id) AS count
       FROM bank_accounts a LEFT JOIN bank_transactions t ON t.account_id = a.id
      WHERE a.case_id = :caseId GROUP BY a.id HAVING count > 0`,
    { caseId },
  );
  const issues = await query(
    `SELECT v.id, v.severity, v.message, d.original_name
       FROM validation_results v LEFT JOIN documents d ON d.id = v.document_id
      WHERE v.case_id = :caseId AND v.resolved = 0
      ORDER BY FIELD(v.severity,'error','warning','info'), v.id`,
    { caseId },
  );

  const counts = new Map(monthly.map((m) => [m.ym, Number(m.count)]));
  const fyMonths = financialYear(assessmentYear).months;
  const coverage = fyMonths.map((month) => ({ month, count: counts.get(month) ?? 0 }));
  const outsideYear = [...counts].filter(([ym]) => !fyMonths.includes(ym)).reduce((sum, [, n]) => sum + n, 0);

  return {
    count: Number(totals.count),
    credits: Number(totals.credits),
    debits: Number(totals.debits),
    period: totals.first ? { from: totals.first, to: totals.last } : null,
    accounts: accounts.map((a) => ({ id: a.id, bankName: a.bank_name, last4: a.account_last4, count: Number(a.count) })),
    coverage,
    outsideYear,
    issues: issues.map((i) => ({ id: i.id, severity: i.severity, message: i.message, document: i.original_name })),
    review: await getReviewStats(caseId),
  };
};
