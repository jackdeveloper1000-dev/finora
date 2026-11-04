import { fieldIndex } from './mapper.js';

// Validation levels follow the PRD (15.2). Any issue with severity "error" blocks approval and export.
const TEN_RUPEES = 10;

export const FIX_PATHS = {
  profile: 'profile',
  documents: 'documents',
  transactions: 'transactions',
  reconcile: 'reconcile',
  tax: 'tax',
};

const issue = (level, severity, code, message, fix = null) => ({ level, severity, code, message, fix });
const near = (a, b) => Math.abs(a - b) < 0.5; // rupee amounts, half a rupee of float slack
const roundTen = (n) => Math.round(n / TEN_RUPEES) * TEN_RUPEES;

const structural = ({ model, kase, profile }) => {
  const out = [];
  const required = [
    [profile.fullName, 'full_name', 'Name is missing from your profile.'],
    [profile.dob, 'dob', 'Date of birth is missing from your profile.'],
    [profile.address, 'address', 'Address is required on the return. Add it to your profile.'],
  ];
  for (const [value, code, message] of required) if (!value) out.push(issue('structural', 'error', `missing_${code}`, message, FIX_PATHS.profile));
  if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(profile.pan ?? '') && !/^X{6}\d{3}[A-Z]$/.test(profile.pan ?? '')) {
    out.push(issue('structural', 'error', 'invalid_pan', 'PAN is not in a valid format.', FIX_PATHS.profile));
  }
  if (!kase.assessmentYear) out.push(issue('structural', 'error', 'missing_ay', 'Assessment year is missing.'));
  for (const field of Object.values(fieldIndex(model))) {
    if (field.kind === 'amount' && (!Number.isFinite(field.value) || field.value < 0)) {
      out.push(issue('structural', 'error', 'bad_amount', `${field.label} has an invalid amount.`, FIX_PATHS.tax));
    }
  }
  return out;
};

const arithmetic = ({ model }) => {
  const f = Object.fromEntries(Object.entries(fieldIndex(model)).map(([code, field]) => [code, field.value]));
  const checks = [
    ['salary', f['ScheduleS.GrossSalary'] - f['ScheduleS.StandardDeduction'], f['ScheduleS.IncomeFromSalary'], 'Income from salary does not equal gross salary minus the standard deduction.'],
    ['gti', f['ScheduleS.IncomeFromSalary'] + f['ScheduleOS.Interest'] + f['ScheduleOS.Dividend'], f['PartBTI.GrossTotalIncome'], 'Gross total income does not equal the sum of its parts.'],
    ['total_income', roundTen(Math.max(0, f['PartBTI.GrossTotalIncome'] - f['PartBTI.Deduction80C'] - f['PartBTI.Deduction80D'])), f['PartBTI.TotalIncome'], 'Total income does not equal gross total income minus deductions.'],
    ['tax', roundTen(f['PartBTTI.TaxOnTotalIncome'] - f['PartBTTI.Rebate87A'] + f['PartBTTI.Cess']), f['PartBTTI.TotalTaxLiability'], 'Total tax liability does not follow from tax, rebate and cess.'],
  ];
  const out = checks.filter(([, expected, actual]) => !near(expected, actual)).map(([code, , , message]) => issue('arithmetic', 'error', `arith_${code}`, message, FIX_PATHS.tax));

  const net = f['PartBTTI.TotalTaxLiability'] - f['PartBTTI.TDS'] - f['PartBTTI.AdvanceTax'];
  if (!near(Math.abs(net), f['PartBTTI.NetPayable'])) out.push(issue('arithmetic', 'error', 'arith_net', 'Net payable does not equal tax liability minus tax already paid.', FIX_PATHS.tax));
  return out;
};

const businessRules = ({ context }) => {
  const out = [];
  if (!context.hasCalculation) out.push(issue('business', 'error', 'no_calculation', 'Calculate your tax before preparing the return.', FIX_PATHS.tax));
  else if (!context.regimeChosen) out.push(issue('business', 'error', 'no_regime', 'Choose the old or new regime on the Tax page.', FIX_PATHS.tax));
  if (context.hasCalculation && context.stale) out.push(issue('business', 'error', 'stale_calculation', 'Your figures changed after the last calculation. Recalculate your tax.', FIX_PATHS.tax));
  if (!context.eligibility.complete) out.push(issue('business', 'error', 'eligibility_incomplete', 'Answer the eligibility questions.', FIX_PATHS.tax));
  else if (!context.eligibility.supported) out.push(issue('business', 'error', 'not_eligible', 'This return needs a form or situation Finora does not support yet.', FIX_PATHS.tax));
  if (context.regime === 'new' && context.ignoredDeductions) {
    out.push(issue('business', 'warning', 'deductions_ignored', 'You entered 80C/80D deductions, which are not allowed in the new regime and were not applied.', FIX_PATHS.tax));
  }
  if (context.hasCalculation && !context.rulesetVerified) out.push(issue('business', 'warning', 'rules_unverified', 'The tax rules used have not been verified by a tax professional.'));
  return out;
};

const crossDocument = ({ context }) => {
  const out = [];
  if (context.openReconciliation > 0) out.push(issue('cross_document', 'error', 'open_reconciliation', `${context.openReconciliation} difference(s) between your documents are unresolved.`, FIX_PATHS.reconcile));
  if (context.escalated > 0) out.push(issue('cross_document', 'error', 'escalated_items', `${context.escalated} item(s) are waiting for expert review. Resolve or reopen them to continue.`, FIX_PATHS.reconcile));
  if (context.pendingReview > 0) out.push(issue('cross_document', 'error', 'pending_review', `${context.pendingReview} transaction(s) still need review and are not counted as income.`, FIX_PATHS.transactions));
  if (context.salaryEstimated) out.push(issue('cross_document', 'warning', 'salary_estimated', 'Salary is estimated from bank credits. Add your Form 16 gross salary for an accurate return.', FIX_PATHS.reconcile));
  return out;
};

export const validateReturn = (input) => {
  // Without a return model (nothing calculated yet) only process-level checks apply.
  const fieldChecks = input.model ? [...structural(input), ...arithmetic(input)] : [];
  const issues = [...fieldChecks, ...businessRules(input), ...crossDocument(input)];
  return {
    issues,
    errors: issues.filter((i) => i.severity === 'error'),
    warnings: issues.filter((i) => i.severity === 'warning'),
    blocking: issues.some((i) => i.severity === 'error'),
  };
};

// "User confirmation" level: material assumptions the taxpayer must explicitly accept.
export const requiredConfirmations = ({ rulesetVerified }) => [
  { key: 'details_correct', label: 'My name, PAN, date of birth and address are correct.' },
  { key: 'income_complete', label: 'I have reported all my income. I have no income other than salary, interest and dividends.' },
  ...(rulesetVerified ? [] : [{ key: 'rules_unverified', label: 'I understand the tax rules used are not yet verified by a tax professional.' }]),
  { key: 'responsibility', label: 'I am responsible for the accuracy of this return and will review it before filing.' },
];
