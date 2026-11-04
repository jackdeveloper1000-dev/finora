// Deterministic eligibility decision tree (never inferred by AI). Versioned with the ruleset year.
export const ITR1_INCOME_LIMIT_PAISE = 5_000_000 * 100;

export const QUESTIONS = [
  { key: 'business_income', topic: 'income', question: 'Did you earn income from a business, profession or freelancing?', why: 'Business or professional income needs ITR-3 or ITR-4.', form: 'ITR-3', hintCategory: 'business_receipt' },
  { key: 'capital_gains', topic: 'investments', question: 'Did you sell shares, mutual funds, property, crypto or other assets?', why: 'Capital gains cannot be reported in ITR-1 and need ITR-2.', form: 'ITR-2', hintCategory: 'capital_gain' },
  { key: 'house_property', topic: 'income', question: 'Do you receive rent, or claim home-loan interest?', why: 'Income from house property is not calculated in this version of Finora.', form: null, hintCategory: 'rent_received' },
  { key: 'foreign', topic: 'other', question: 'Do you hold foreign assets, or have income from outside India?', why: 'Foreign assets and income need ITR-2.', form: 'ITR-2', hintCategory: null },
  { key: 'director', topic: 'other', question: 'Are you a director of a company, or do you hold unlisted shares?', why: 'Directors and unlisted-share holders need ITR-2.', form: 'ITR-2', hintCategory: null },
  { key: 'agriculture', topic: 'income', question: 'Is your agricultural income more than ₹5,000?', why: 'Agricultural income above ₹5,000 needs ITR-2.', form: 'ITR-2', hintCategory: null },
  { key: 'losses', topic: 'other', question: 'Do you have losses from earlier years to carry forward?', why: 'Carried-forward losses need ITR-2.', form: 'ITR-2', hintCategory: null },
];

export const evaluateEligibility = ({ answers, residentialStatus, grossTotalIncome = null }) => {
  const reasons = [];

  if (residentialStatus !== 'resident') {
    reasons.push({ code: 'non_resident', message: 'Non-resident and RNOR taxpayers need ITR-2 and different rules.', form: 'ITR-2' });
  }
  for (const q of QUESTIONS) {
    if (answers[q.key] === 'yes') reasons.push({ code: q.key, message: q.why, form: q.form });
  }
  if (grossTotalIncome !== null && grossTotalIncome > ITR1_INCOME_LIMIT_PAISE) {
    reasons.push({ code: 'income_over_limit', message: 'Total income above ₹50 lakh is not eligible for ITR-1 and attracts surcharge.', form: 'ITR-2' });
  }

  const complete = QUESTIONS.every((q) => answers[q.key] === 'yes' || answers[q.key] === 'no');
  const forms = reasons.map((r) => r.form);
  const suggestedForm = forms.includes('ITR-3') ? 'ITR-3' : forms.includes('ITR-2') ? 'ITR-2' : null;

  return { complete, supported: complete && reasons.length === 0, itrForm: complete && reasons.length === 0 ? 'ITR-1' : null, suggestedForm, reasons };
};

// A "No" that contradicts the bank statements should be questioned, not silently accepted.
export const contradictionWarnings = (answers, categoryCounts) =>
  QUESTIONS.filter((q) => q.hintCategory && answers[q.key] === 'no' && (categoryCounts[q.hintCategory] ?? 0) > 0).map(
    (q) => `You answered No to “${q.question}” but ${categoryCounts[q.hintCategory]} transaction(s) in your statements look related. Please double-check.`,
  );
