// Deterministic tax calculation. Pure: no I/O, no AI. Amounts are integer paise.
const PAISE = 100;
const TEN_RUPEES = 10 * PAISE;

// Sections 288A / 288B: income and tax are rounded to the nearest ₹10.
const roundToTen = (paise) => Math.round(paise / TEN_RUPEES) * TEN_RUPEES;

export const slabsFor = (regimeConfig, ageCategory) =>
  Array.isArray(regimeConfig.slabs) ? regimeConfig.slabs : regimeConfig.slabs[ageCategory];

export const slabTax = (taxablePaise, slabs) => {
  let tax = 0;
  let lower = 0;
  for (const { upTo, rate } of slabs) {
    const upper = upTo === null ? Infinity : upTo * PAISE;
    tax += (Math.max(0, Math.min(taxablePaise, upper) - lower) * rate) / 100;
    if (taxablePaise <= upper) break;
    lower = upper;
  }
  return tax;
};

const section80DCap = (caps, ageCategory) => (ageCategory === 'general' ? caps.general : caps.senior) * PAISE;

const applyRebate = (tax, taxable, rebate) => {
  if (!rebate) return { amount: 0, note: null };
  const limit = rebate.limit * PAISE;
  if (taxable <= limit) return { amount: Math.min(tax, rebate.max * PAISE), note: 'Section 87A rebate' };
  if (rebate.marginalRelief) {
    // Tax above the limit may not exceed the income earned above the limit.
    const relief = Math.max(0, tax - (taxable - limit));
    if (relief > 0) return { amount: relief, note: 'Section 87A marginal relief' };
  }
  return { amount: 0, note: null };
};

/**
 * income: { salaryGross, interest, dividend }   deductions: { section80C, section80D }
 * credits: { tds, advanceTax }                  sources: optional labels per input for the trace
 */
export const calculateRegime = ({ ruleset, regime, ageCategory, income, deductions, credits, sources = {} }) => {
  const config = ruleset.config.regimes[regime];
  const steps = [];
  const add = (key, label, amount, note = null, source = null) => steps.push({ key, label, amount: Math.round(amount), note, source });

  add('gross_salary', 'Gross salary', income.salaryGross, null, sources.salary);
  const standardDeduction = income.salaryGross > 0 ? Math.min(config.standardDeduction * PAISE, income.salaryGross) : 0;
  add('standard_deduction', 'Standard deduction', -standardDeduction, 'Section 16(ia)');
  const salaryIncome = income.salaryGross - standardDeduction;
  add('salary_income', 'Income from salary', salaryIncome);
  add('house_property', 'Income from house property', 0, 'Not supported in this version');
  add('capital_gains', 'Capital gains', 0, 'Not supported in this version');
  add('interest', 'Interest income', income.interest, null, sources.interest);
  add('dividend', 'Dividend income', income.dividend, null, sources.dividend);
  const grossTotal = salaryIncome + income.interest + income.dividend;
  add('gross_total_income', 'Gross total income', grossTotal);

  let deductionTotal = 0;
  if (config.allowsDeductions) {
    const caps = ruleset.config.deductionCaps;
    const d80c = Math.min(deductions.section80C, caps.section80C * PAISE);
    const d80d = Math.min(deductions.section80D, section80DCap(caps.section80D, ageCategory));
    add('deduction_80c', 'Deduction under 80C', -d80c, d80c < deductions.section80C ? `Capped at ₹${caps.section80C.toLocaleString('en-IN')}` : null, sources.section80C);
    add('deduction_80d', 'Deduction under 80D', -d80d, d80d < deductions.section80D ? 'Capped at the section limit' : null, sources.section80D);
    deductionTotal = d80c + d80d;
  } else {
    add('deductions', 'Chapter VI-A deductions', 0, 'Not available in the new regime');
  }

  const taxable = roundToTen(Math.max(0, grossTotal - deductionTotal));
  add('taxable_income', 'Taxable income', taxable, 'Rounded to the nearest ₹10');

  const slabTaxAmount = slabTax(taxable, slabsFor(config, ageCategory));
  add('slab_tax', 'Tax on taxable income', slabTaxAmount, 'As per slab rates');

  const rebate = applyRebate(slabTaxAmount, taxable, config.rebate);
  if (rebate.amount > 0) add('rebate', rebate.note, -rebate.amount);
  const afterRebate = slabTaxAmount - rebate.amount;

  const cess = (afterRebate * ruleset.config.cessPercent) / 100;
  add('cess', `Health and education cess (${ruleset.config.cessPercent}%)`, cess);
  const totalTax = roundToTen(afterRebate + cess);
  add('total_tax', 'Total tax liability', totalTax, 'Rounded to the nearest ₹10');

  add('tds', 'TDS credited', -credits.tds, null, sources.tds);
  add('advance_tax', 'Advance / self-assessment tax paid', -credits.advanceTax, null, sources.advanceTax);
  const net = totalTax - credits.tds - credits.advanceTax;
  add('net_payable', net >= 0 ? 'Net tax payable' : 'Refund due', net);

  return { regime, label: config.label, grossTotalIncome: grossTotal, deductions: deductionTotal, taxableIncome: taxable, totalTax, netPayable: net, steps };
};

export const compareRegimes = (inputs) => {
  const results = { old: calculateRegime({ ...inputs, regime: 'old' }), new: calculateRegime({ ...inputs, regime: 'new' }) };
  const recommended = results.new.totalTax <= results.old.totalTax ? 'new' : 'old';
  return { ...results, recommended, savings: Math.abs(results.new.totalTax - results.old.totalTax) };
};
