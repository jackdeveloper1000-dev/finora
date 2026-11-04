// Maps a stored tax calculation + taxpayer profile to ITR-1 style sections.
// Field codes are Finora's own, mirroring the ITR-1 structure; they are NOT the official government schema.
export const FORM = 'ITR-1';

const text = (code, label, value, evidence = null) => ({ code, label, value: value ?? '', kind: 'text', evidence });
const amount = (code, label, value, evidence = null) => ({ code, label, value: Number(value) || 0, kind: 'amount', evidence });

const step = (steps, key) => steps.find((s) => s.key === key)?.amount ?? 0;
const stepSource = (steps, key) => steps.find((s) => s.key === key)?.source ?? null;

// evidenceOf('Form 16') -> "Form 16 — form16.pdf" when the figure was attached to a document.
const evidenceFor = (steps, key, docNames) => {
  const source = stepSource(steps, key);
  if (!source) return 'Calculated';
  const doc = docNames[source];
  return doc ? `${source} — ${doc}` : source;
};

export const buildReturnModel = ({ assessmentYear, regime, profile, calc, docNames = {}, panDisplay }) => {
  const s = calc.steps;
  const ev = (key) => evidenceFor(s, key, docNames);
  const rebate = -step(s, 'rebate');

  return [
    {
      key: 'part_a',
      title: 'Part A — General information',
      fields: [
        text('PartA.Form', 'Return form', FORM),
        text('PartA.AssessmentYear', 'Assessment year', assessmentYear),
        text('PartA.Name', 'Name', profile.fullName, 'Your profile'),
        text('PartA.PAN', 'PAN', panDisplay, 'Your profile'),
        text('PartA.DateOfBirth', 'Date of birth', profile.dob, 'Your profile'),
        text('PartA.ResidentialStatus', 'Residential status', profile.residentialStatus, 'Your profile'),
        text('PartA.Address', 'Address', profile.address, 'Your profile'),
        text('PartA.Regime', 'Tax regime', regime === 'new' ? 'New regime (115BAC)' : 'Old regime', 'Your choice'),
      ],
    },
    {
      key: 'schedule_s',
      title: 'Schedule S — Salary',
      fields: [
        amount('ScheduleS.GrossSalary', 'Gross salary', step(s, 'gross_salary'), ev('gross_salary')),
        amount('ScheduleS.StandardDeduction', 'Standard deduction u/s 16(ia)', -step(s, 'standard_deduction'), 'Calculated'),
        amount('ScheduleS.IncomeFromSalary', 'Income from salary', step(s, 'salary_income'), 'Calculated'),
      ],
    },
    {
      key: 'schedule_os',
      title: 'Schedule OS — Other sources',
      fields: [
        amount('ScheduleOS.Interest', 'Interest income', step(s, 'interest'), ev('interest')),
        amount('ScheduleOS.Dividend', 'Dividend income', step(s, 'dividend'), ev('dividend')),
      ],
    },
    {
      key: 'part_b_ti',
      title: 'Part B-TI — Total income',
      fields: [
        amount('PartBTI.GrossTotalIncome', 'Gross total income', step(s, 'gross_total_income'), 'Calculated'),
        amount('PartBTI.Deduction80C', 'Deduction under 80C', -step(s, 'deduction_80c'), ev('deduction_80c')),
        amount('PartBTI.Deduction80D', 'Deduction under 80D', -step(s, 'deduction_80d'), ev('deduction_80d')),
        amount('PartBTI.TotalIncome', 'Total income', step(s, 'taxable_income'), 'Calculated'),
      ],
    },
    {
      key: 'part_b_tti',
      title: 'Part B-TTI — Tax computation',
      fields: [
        amount('PartBTTI.TaxOnTotalIncome', 'Tax on total income', step(s, 'slab_tax'), 'Calculated'),
        amount('PartBTTI.Rebate87A', 'Rebate u/s 87A', rebate, 'Calculated'),
        amount('PartBTTI.Cess', 'Health and education cess', step(s, 'cess'), 'Calculated'),
        amount('PartBTTI.TotalTaxLiability', 'Total tax liability', step(s, 'total_tax'), 'Calculated'),
        amount('PartBTTI.TDS', 'TDS credited', -step(s, 'tds'), ev('tds')),
        amount('PartBTTI.AdvanceTax', 'Advance / self-assessment tax paid', -step(s, 'advance_tax'), ev('advance_tax')),
        amount('PartBTTI.NetPayable', step(s, 'net_payable') >= 0 ? 'Tax payable' : 'Refund due', Math.abs(step(s, 'net_payable')), 'Calculated'),
      ],
    },
  ];
};

export const fieldIndex = (sections) => Object.fromEntries(sections.flatMap((sec) => sec.fields.map((f) => [f.code, f])));
