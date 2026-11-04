// Pure reconciliation rules. All inputs are integer paise; `undefined`/0 means "not available".
export const TOLERANCE = {
  absolutePaise: 10_000, // ₹100
  relative: 0.02,
  challanPaise: 100, // ₹1
  // Take-home pay is gross minus TDS, PF, professional tax etc.
  salaryTakeHomeMin: 0.65,
};

const rupees = (paise) => `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const present = (value) => value !== undefined && value !== null && value > 0;
const close = (a, b) => Math.abs(a - b) <= Math.max(TOLERANCE.absolutePaise, Math.round(Math.max(a, b) * TOLERANCE.relative));

const build = (ruleKey, title, [sourceA, a], [sourceB, b], verdict) => ({
  ruleKey,
  title,
  sourceA,
  sourceB,
  valueA: present(a) ? a : null,
  valueB: present(b) ? b : null,
  ...verdict,
});

const missingVerdict = (a, b, nameA, nameB) => ({
  status: 'missing',
  message: present(a)
    ? `${nameA} shows ${rupees(a)} but ${nameB} has nothing to compare. Add the ${nameB} figure or upload that document.`
    : `${nameB} shows ${rupees(b)} but we found nothing in ${nameA}. A statement or month may be missing.`,
});

// Runs `compare` only when both sides exist; emits a "missing" item when exactly one does; nothing when neither does.
const rule = (ruleKey, title, left, right, compare) => {
  const [nameA, a] = left;
  const [nameB, b] = right;
  if (!present(a) && !present(b)) return null;
  return build(ruleKey, title, left, right, present(a) && present(b) ? compare(a, b) : missingVerdict(a, b, nameA, nameB));
};

const matched = (message) => ({ status: 'matched', message });
const mismatch = (message) => ({ status: 'mismatch', message });

export const reconcile = ({ bank, facts }) =>
  [
    rule('salary_vs_form16', 'Salary: bank credits vs Form 16', ['Bank statements', bank.salary], ['Form 16', facts.gross_salary], (a, b) => {
      if (a > b + TOLERANCE.absolutePaise) {
        return mismatch(`Salary credited (${rupees(a)}) is more than Form 16 gross salary (${rupees(b)}). Check for bonus, arrears or a second employer.`);
      }
      if (a < b * TOLERANCE.salaryTakeHomeMin) {
        return mismatch(`Salary credited (${rupees(a)}) is much lower than Form 16 gross salary (${rupees(b)}). Another bank account or a missing statement month is likely.`);
      }
      return matched('Salary credits are consistent with Form 16 after TDS and other deductions.');
    }),

    rule('interest_vs_ais', 'Interest: bank credits vs AIS', ['Bank statements', bank.interest], ['AIS', facts.ais_interest], (a, b) => {
      if (close(a, b)) return matched('Interest matches what AIS reports.');
      return mismatch(
        a < b
          ? `AIS reports ${rupees(b - a)} more interest than your statements. It probably includes other accounts or fixed deposits; upload those statements.`
          : `Your statements show ${rupees(a - b)} more interest than AIS reports. AIS may not include it yet.`,
      );
    }),

    rule('dividend_vs_ais', 'Dividend: bank credits vs AIS', ['Bank statements', bank.dividend], ['AIS', facts.ais_dividend], (a, b) =>
      close(a, b)
        ? matched('Dividends match what AIS reports.')
        : mismatch(`Dividends differ by ${rupees(Math.abs(a - b))}. Dividends may be paid to a demat-linked account that is not uploaded.`),
    ),

    rule('tds_form16_vs_26as', 'TDS: Form 16 vs Form 26AS', ['Form 16', facts.tds_salary], ['Form 26AS', facts.tds_total_26as], (a, b) =>
      b + TOLERANCE.challanPaise >= a
        ? matched('TDS on salary is fully credited in Form 26AS.')
        : mismatch(`Form 16 shows ${rupees(a)} TDS but Form 26AS credits only ${rupees(b)}. Claim only the TDS that appears in Form 26AS.`),
    ),

    rule('advance_tax_vs_challan', 'Advance tax: bank debits vs Form 26AS', ['Bank statements', bank.taxPaid], ['Form 26AS', facts.tax_challans], (a, b) =>
      Math.abs(a - b) <= TOLERANCE.challanPaise
        ? matched('Tax payments in your bank match the challans in Form 26AS.')
        : mismatch(`Bank shows ${rupees(a)} paid as tax but Form 26AS shows ${rupees(b)}. Check the challan details.`),
    ),
  ].filter(Boolean);

export const isOpen = (status) => status === 'mismatch' || status === 'missing';
