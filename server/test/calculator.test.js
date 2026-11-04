import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateRegime, compareRegimes, slabTax, slabsFor } from '../src/modules/tax/calculator.js';

// Mirrors the AY 2026-27 ruleset (Finance Act 2025).
const AY2627 = {
  config: {
    cessPercent: 4,
    deductionCaps: { section80C: 150_000, section80D: { general: 25_000, senior: 50_000 } },
    regimes: {
      new: {
        label: 'New regime', standardDeduction: 75_000, allowsDeductions: false,
        slabs: [{ upTo: 400_000, rate: 0 }, { upTo: 800_000, rate: 5 }, { upTo: 1_200_000, rate: 10 }, { upTo: 1_600_000, rate: 15 }, { upTo: 2_000_000, rate: 20 }, { upTo: 2_400_000, rate: 25 }, { upTo: null, rate: 30 }],
        rebate: { limit: 1_200_000, max: 60_000, marginalRelief: true },
      },
      old: {
        label: 'Old regime', standardDeduction: 50_000, allowsDeductions: true,
        slabs: {
          general: [{ upTo: 250_000, rate: 0 }, { upTo: 500_000, rate: 5 }, { upTo: 1_000_000, rate: 20 }, { upTo: null, rate: 30 }],
          senior: [{ upTo: 300_000, rate: 0 }, { upTo: 500_000, rate: 5 }, { upTo: 1_000_000, rate: 20 }, { upTo: null, rate: 30 }],
          superSenior: [{ upTo: 500_000, rate: 0 }, { upTo: 1_000_000, rate: 20 }, { upTo: null, rate: 30 }],
        },
        rebate: { limit: 500_000, max: 12_500, marginalRelief: false },
      },
    },
  },
};

const inr = (rupees) => rupees * 100;
const run = (regime, { salary = 0, interest = 0, dividend = 0, c80 = 0, d80 = 0, tds = 0, advance = 0, age = 'general' } = {}) =>
  calculateRegime({
    ruleset: AY2627,
    regime,
    ageCategory: age,
    income: { salaryGross: inr(salary), interest: inr(interest), dividend: inr(dividend) },
    deductions: { section80C: inr(c80), section80D: inr(d80) },
    credits: { tds: inr(tds), advanceTax: inr(advance) },
  });
const tax = (result) => result.totalTax / 100;

describe('slabTax', () => {
  it('applies each slab to its own band only', () => {
    // 4–8L @5% = 20,000 ; 8–12L @10% = 40,000
    assert.equal(slabTax(inr(1_200_000), slabsFor(AY2627.config.regimes.new, 'general')) / 100, 60_000);
  });
});

describe('new regime (AY 2026-27)', () => {
  it('is nil up to ₹12.75L salary: 87A rebate after the ₹75k standard deduction', () => {
    const r = run('new', { salary: 1_275_000 });
    assert.equal(r.taxableIncome / 100, 1_200_000);
    assert.equal(tax(r), 0);
  });

  it('charges normal tax above the rebate zone', () => {
    // taxable 14,25,000: 20,000 + 40,000 + 15% of 2,25,000 = 93,750 ; + 4% cess = 97,500
    assert.equal(tax(run('new', { salary: 1_500_000 })), 97_500);
  });

  it('gives marginal relief just above ₹12L', () => {
    // taxable 12,10,000: slab tax 61,500, relief caps tax at 10,000 ; + cess = 10,400
    assert.equal(tax(run('new', { salary: 1_285_000 })), 10_400);
  });

  it('ignores 80C/80D', () => {
    assert.equal(tax(run('new', { salary: 1_500_000, c80: 150_000 })), 97_500);
  });
});

describe('old regime', () => {
  it('applies 80C, 80D and the ₹50k standard deduction', () => {
    // 10L - 50k - 1.5L = 8L ; 12,500 + 60,000 = 72,500 ; + cess = 75,400
    assert.equal(tax(run('old', { salary: 1_000_000, c80: 150_000 })), 75_400);
  });

  it('caps 80C at ₹1.5L and 80D at the general limit', () => {
    const r = run('old', { salary: 1_000_000, c80: 400_000, d80: 90_000 });
    assert.equal(r.deductions / 100, 175_000);
  });

  it('gives the 87A rebate at ₹5L taxable income', () => {
    assert.equal(tax(run('old', { salary: 550_000 })), 0);
  });

  it('has no marginal relief above ₹5L', () => {
    // taxable 5,10,000: 12,500 + 20% of 10,000 = 14,500 ; + cess = 15,080
    assert.equal(tax(run('old', { salary: 560_000 })), 15_080);
  });

  it('uses the higher exemption for senior citizens', () => {
    assert.ok(tax(run('old', { salary: 800_000, age: 'senior' })) < tax(run('old', { salary: 800_000 })));
  });
});

describe('credits, other income and rounding', () => {
  it('taxes interest and dividends at slab rates', () => {
    assert.ok(tax(run('new', { salary: 1_500_000, interest: 50_000, dividend: 10_000 })) > 97_500);
  });

  it('computes net payable and refunds', () => {
    assert.equal(run('new', { salary: 1_500_000, tds: 100_000 }).netPayable / 100, -2_500);
    assert.equal(run('new', { salary: 1_500_000, tds: 50_000, advance: 10_000 }).netPayable / 100, 37_500);
  });

  it('rounds taxable income to the nearest ten rupees', () => {
    assert.equal(run('new', { salary: 1_500_004 }).taxableIncome % 1000, 0);
  });

  it('records every step of the trace', () => {
    const keys = run('old', { salary: 1_000_000, c80: 100_000 }).steps.map((s) => s.key);
    for (const k of ['gross_salary', 'standard_deduction', 'gross_total_income', 'deduction_80c', 'taxable_income', 'slab_tax', 'cess', 'total_tax', 'net_payable']) {
      assert.ok(keys.includes(k), k);
    }
  });
});

describe('compareRegimes', () => {
  it('recommends the lower-tax regime and reports the saving', () => {
    const inputs = { ruleset: AY2627, ageCategory: 'general', income: { salaryGross: inr(1_000_000), interest: 0, dividend: 0 }, deductions: { section80C: inr(150_000), section80D: inr(25_000) }, credits: { tds: 0, advanceTax: 0 } };
    const cmp = compareRegimes(inputs);
    assert.equal(cmp.recommended, 'new'); // 10L salary is nil under the new regime
    assert.equal(cmp.savings, cmp.old.totalTax - cmp.new.totalTax);
  });
});
