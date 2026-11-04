import { query } from '../../config/db.js';

const toPaise = (value) => Math.round(Number(value) * 100);

// Ledger totals (integer paise) used by reconciliation and the tax calculation. Ignored rows never count.
export const loadBankTotals = async (caseId) => {
  const rows = await query(
    `SELECT c.code, COALESCE(SUM(t.credit),0) AS credits, COALESCE(SUM(t.debit),0) AS debits
       FROM bank_transactions t JOIN categories c ON c.id = t.category_id
      WHERE t.case_id = :caseId AND t.user_status <> 'ignored' AND c.code IN ('salary','interest','dividend','tax_paid')
      GROUP BY c.code`,
    { caseId },
  );
  const sum = (code, column) => toPaise(rows.find((r) => r.code === code)?.[column] ?? 0);
  return { salary: sum('salary', 'credits'), interest: sum('interest', 'credits'), dividend: sum('dividend', 'credits'), taxPaid: sum('tax_paid', 'debits') };
};

export const loadTaxFacts = async (caseId) => {
  const rows = await query('SELECT fact_key, amount FROM tax_facts WHERE case_id = :caseId', { caseId });
  return Object.fromEntries(rows.map((r) => [r.fact_key, toPaise(r.amount)]));
};

export const countByCategory = async (caseId) => {
  const rows = await query(
    `SELECT c.code, COUNT(*) AS total FROM bank_transactions t JOIN categories c ON c.id = t.category_id
      WHERE t.case_id = :caseId AND t.user_status <> 'ignored' GROUP BY c.code`,
    { caseId },
  );
  return Object.fromEntries(rows.map((r) => [r.code, Number(r.total)]));
};
