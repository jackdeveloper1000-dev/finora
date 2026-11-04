// Single source of truth for which values we collect from each tax document (served to the client).
export const FACT_SOURCES = {
  form16: {
    label: 'Form 16',
    hint: 'From your employer. Part A has TDS, Part B has salary and deductions.',
    docType: 'form16',
    facts: [
      { key: 'gross_salary', label: 'Gross salary' },
      { key: 'tds_salary', label: 'Tax deducted (TDS) on salary' },
      { key: 'deduction_80c', label: 'Deduction under 80C' },
      { key: 'deduction_80d', label: 'Deduction under 80D' },
    ],
  },
  ais: {
    label: 'AIS / TIS',
    hint: 'Annual Information Statement from the income tax portal.',
    docType: 'ais',
    facts: [
      { key: 'ais_interest', label: 'Interest income reported' },
      { key: 'ais_dividend', label: 'Dividend income reported' },
    ],
  },
  form26as: {
    label: 'Form 26AS',
    hint: 'Tax credit statement from the income tax portal.',
    docType: 'form26as',
    facts: [
      { key: 'tds_total_26as', label: 'Total TDS credited' },
      { key: 'tax_challans', label: 'Advance / self-assessment tax paid' },
    ],
  },
};

export const factKeysOf = (source) => FACT_SOURCES[source].facts.map((f) => f.key);
