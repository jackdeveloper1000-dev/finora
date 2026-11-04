import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { reconcile } from '../src/modules/reconciliation/rules.js';

const inr = (rupees) => rupees * 100;
const run = (bank = {}, facts = {}) => Object.fromEntries(reconcile({ bank, facts }).map((i) => [i.ruleKey, i]));

describe('reconcile', () => {
  it('produces nothing when neither side has data', () => {
    assert.deepEqual(reconcile({ bank: {}, facts: {} }), []);
  });

  it('accepts take-home salary below Form 16 gross', () => {
    assert.equal(run({ salary: inr(850_000) }, { gross_salary: inr(1_100_000) }).salary_vs_form16.status, 'matched');
  });

  it('flags salary far below gross and salary above gross', () => {
    assert.equal(run({ salary: inr(400_000) }, { gross_salary: inr(1_100_000) }).salary_vs_form16.status, 'mismatch');
    assert.equal(run({ salary: inr(1_300_000) }, { gross_salary: inr(1_100_000) }).salary_vs_form16.status, 'mismatch');
  });

  it('marks salary missing when only one side exists, in both directions', () => {
    const noForm16 = run({ salary: inr(500_000) }, {}).salary_vs_form16;
    assert.equal(noForm16.status, 'missing');
    assert.equal(noForm16.valueB, null);
    assert.equal(run({}, { gross_salary: inr(500_000) }).salary_vs_form16.status, 'missing');
  });

  it('matches interest within tolerance and explains the direction of a gap', () => {
    assert.equal(run({ interest: inr(10_000) }, { ais_interest: inr(10_150) }).interest_vs_ais.status, 'matched');
    assert.match(run({ interest: inr(10_000) }, { ais_interest: inr(30_000) }).interest_vs_ais.message, /other accounts or fixed deposits/);
    assert.match(run({ interest: inr(30_000) }, { ais_interest: inr(10_000) }).interest_vs_ais.message, /more interest than AIS/);
  });

  it('flags Form 16 TDS exceeding what Form 26AS credits', () => {
    assert.equal(run({}, { tds_salary: inr(120_000), tds_total_26as: inr(150_000) }).tds_form16_vs_26as.status, 'matched');
    assert.equal(run({}, { tds_salary: inr(120_000), tds_total_26as: inr(100_000) }).tds_form16_vs_26as.status, 'mismatch');
  });

  it('requires advance tax to match challans within ₹1', () => {
    assert.equal(run({ taxPaid: inr(20_000) }, { tax_challans: inr(20_000) }).advance_tax_vs_challan.status, 'matched');
    assert.equal(run({ taxPaid: inr(20_000) }, { tax_challans: inr(15_000) }).advance_tax_vs_challan.status, 'mismatch');
  });

  it('exposes rupee values for storage', () => {
    const item = run({ interest: inr(1_000) }, { ais_interest: inr(1_000) }).interest_vs_ais;
    assert.equal(item.valueA, 100_000);
    assert.equal(item.valueB, 100_000);
  });
});
