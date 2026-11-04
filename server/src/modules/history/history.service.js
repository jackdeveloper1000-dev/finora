import { query, queryOne } from '../../config/db.js';

const latest = (caseId, regime) =>
  queryOne('SELECT gross_income, deductions, taxable_income, tax_payable, net_payable FROM tax_calculations WHERE case_id = :caseId AND regime = :regime ORDER BY id DESC LIMIT 1', { caseId, regime });

const toTax = (regime, row) => ({
  regime,
  grossIncome: Number(row.gross_income),
  deductions: Number(row.deductions),
  taxableIncome: Number(row.taxable_income),
  totalTax: Number(row.tax_payable),
  netPayable: Number(row.net_payable),
});

// One row per return, with the numbers for the regime the user chose (or the cheaper one if none chosen yet).
export const getHistory = async (userId) => {
  const cases = await query('SELECT * FROM itr_cases WHERE user_id = :userId ORDER BY assessment_year DESC', { userId });

  return Promise.all(
    cases.map(async (c) => {
      const [oldRow, newRow] = await Promise.all([latest(c.id, 'old'), latest(c.id, 'new')]);
      let tax = null;
      if (oldRow && newRow) {
        const regime = c.tax_regime ?? (Number(newRow.tax_payable) <= Number(oldRow.tax_payable) ? 'new' : 'old');
        tax = toTax(regime, regime === 'new' ? newRow : oldRow);
      }
      return {
        id: c.id,
        assessmentYear: c.assessment_year,
        status: c.status,
        itrForm: c.itr_form,
        regimeChosen: c.tax_regime,
        approvedAt: c.approved_at,
        createdAt: c.created_at,
        tax,
      };
    }),
  );
};
