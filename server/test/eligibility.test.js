import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { QUESTIONS, contradictionWarnings, evaluateEligibility } from '../src/modules/tax/eligibility.js';

const allNo = Object.fromEntries(QUESTIONS.map((q) => [q.key, 'no']));
const check = (over = {}, rest = {}) => evaluateEligibility({ answers: { ...allNo, ...over }, residentialStatus: 'resident', ...rest });

describe('evaluateEligibility', () => {
  it('supports a resident salaried taxpayer with all "No" answers as ITR-1', () => {
    const r = check();
    assert.equal(r.supported, true);
    assert.equal(r.itrForm, 'ITR-1');
    assert.deepEqual(r.reasons, []);
  });

  it('is incomplete until every question is answered, and never supported meanwhile', () => {
    const r = evaluateEligibility({ answers: { business_income: 'no' }, residentialStatus: 'resident' });
    assert.equal(r.complete, false);
    assert.equal(r.supported, false);
  });

  it('routes capital gains to ITR-2 and business income to ITR-3', () => {
    assert.equal(check({ capital_gains: 'yes' }).suggestedForm, 'ITR-2');
    assert.equal(check({ business_income: 'yes' }).suggestedForm, 'ITR-3');
    assert.equal(check({ business_income: 'yes', capital_gains: 'yes' }).suggestedForm, 'ITR-3');
  });

  it('treats house property as unsupported without guessing a form', () => {
    const r = check({ house_property: 'yes' });
    assert.equal(r.supported, false);
    assert.equal(r.suggestedForm, null);
  });

  it('rejects non-residents and income above ₹50 lakh', () => {
    assert.equal(check({}, { residentialStatus: 'nri' }).supported, false);
    assert.equal(check({}, { grossTotalIncome: 5_000_001 * 100 }).supported, false);
    assert.equal(check({}, { grossTotalIncome: 5_000_000 * 100 }).supported, true);
  });

  it('lists every reason', () => {
    assert.equal(check({ foreign: 'yes', losses: 'yes' }).reasons.length, 2);
  });
});

describe('contradictionWarnings', () => {
  it('flags a "No" that the ledger contradicts', () => {
    const warnings = contradictionWarnings(allNo, { capital_gain: 2 });
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /shares, mutual funds/);
  });

  it('stays quiet when answers and ledger agree', () => {
    assert.deepEqual(contradictionWarnings(allNo, {}), []);
    assert.deepEqual(contradictionWarnings({ ...allNo, capital_gains: 'yes' }, { capital_gain: 2 }), []);
  });
});
