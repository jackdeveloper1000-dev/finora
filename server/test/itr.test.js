import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { stableStringify } from '../src/utils/stableStringify.js';
import { buildReturnModel, fieldIndex } from '../src/modules/itr/mapper.js';
import { requiredConfirmations, validateReturn } from '../src/modules/itr/validator.js';

const steps = [
  { key: 'gross_salary', amount: 1150000, source: 'Form 16' },
  { key: 'standard_deduction', amount: -75000 },
  { key: 'salary_income', amount: 1075000 },
  { key: 'interest', amount: 1649.4, source: 'AIS' },
  { key: 'dividend', amount: 500, source: 'AIS' },
  { key: 'gross_total_income', amount: 1077149.4 },
  { key: 'deductions', amount: 0 },
  { key: 'taxable_income', amount: 1077150 },
  { key: 'slab_tax', amount: 47715 },
  { key: 'rebate', amount: -47715 },
  { key: 'cess', amount: 0 },
  { key: 'total_tax', amount: 0 },
  { key: 'tds', amount: -100000, source: 'Form 26AS' },
  { key: 'advance_tax', amount: -20000, source: 'Form 26AS' },
  { key: 'net_payable', amount: -120000 },
];
const profile = { fullName: 'Asha Verma', pan: 'XXXXXX234F', dob: '1992-04-18', residentialStatus: 'resident', address: 'Pune' };
const build = (over = {}) => buildReturnModel({ assessmentYear: '2026-27', regime: 'new', profile, calc: { steps: over.steps ?? steps }, docNames: { 'Form 16': 'form16.pdf' }, panDisplay: profile.pan });

const cleanContext = { hasCalculation: true, regimeChosen: true, stale: false, regime: 'new', eligibility: { complete: true, supported: true }, openReconciliation: 0, escalated: 0, pendingReview: 0, salaryEstimated: false, rulesetVerified: true };
const check = (over = {}, model = build(), p = profile) => validateReturn({ model, kase: { assessmentYear: '2026-27' }, profile: p, context: { ...cleanContext, ...over } });
const codes = (r) => r.issues.map((i) => i.code);

describe('buildReturnModel', () => {
  it('maps amounts with positive values and a refund as a positive "Refund due"', () => {
    const f = fieldIndex(build());
    assert.equal(f['ScheduleS.StandardDeduction'].value, 75000);
    assert.equal(f['PartBTTI.TDS'].value, 100000);
    assert.equal(f['PartBTTI.NetPayable'].value, 120000);
    assert.equal(f['PartBTTI.NetPayable'].label, 'Refund due');
    assert.equal(f['PartBTTI.Rebate87A'].value, 47715);
  });

  it('records evidence for every amount, naming the attached document', () => {
    const f = fieldIndex(build());
    assert.equal(f['ScheduleS.GrossSalary'].evidence, 'Form 16 — form16.pdf');
    assert.equal(f['ScheduleOS.Interest'].evidence, 'AIS');
    assert.equal(f['PartBTI.TotalIncome'].evidence, 'Calculated');
  });
});

describe('validateReturn', () => {
  it('passes a consistent, fully reviewed return', () => {
    const r = check();
    assert.equal(r.blocking, false);
    assert.deepEqual(r.errors, []);
  });

  it('blocks on a missing address and invalid PAN (structural)', () => {
    const r = check({}, build(), { ...profile, address: '', pan: 'BAD' });
    assert.ok(codes(r).includes('missing_address'));
    assert.ok(codes(r).includes('invalid_pan'));
    assert.equal(r.blocking, true);
  });

  it('catches a tampered or inconsistent figure (arithmetic)', () => {
    const tampered = steps.map((s) => (s.key === 'gross_total_income' ? { ...s, amount: 999999 } : s));
    assert.ok(codes(check({}, build({ steps: tampered }))).includes('arith_gti'));
    const badNet = steps.map((s) => (s.key === 'net_payable' ? { ...s, amount: -1 } : s));
    assert.ok(codes(check({}, build({ steps: badNet }))).includes('arith_net'));
  });

  it('blocks when no regime is chosen or the calculation is stale (business rules)', () => {
    assert.ok(codes(check({ regimeChosen: false })).includes('no_regime'));
    assert.ok(codes(check({ stale: true })).includes('stale_calculation'));
    assert.ok(codes(check({ hasCalculation: false })).includes('no_calculation'));
  });

  it('blocks on ineligible returns', () => {
    assert.ok(codes(check({ eligibility: { complete: true, supported: false } })).includes('not_eligible'));
  });

  it('blocks on unresolved reconciliation, escalations and unreviewed transactions (cross-document)', () => {
    const r = check({ openReconciliation: 2, escalated: 1, pendingReview: 3 });
    for (const c of ['open_reconciliation', 'escalated_items', 'pending_review']) assert.ok(codes(r).includes(c), c);
  });

  it('only warns about estimated salary and unverified rules, and points to where to fix', () => {
    const r = check({ salaryEstimated: true, rulesetVerified: false });
    assert.equal(r.blocking, false);
    assert.equal(r.warnings.length, 2);
    assert.equal(check({ pendingReview: 1 }).errors[0].fix, 'transactions');
  });
});

describe('requiredConfirmations', () => {
  it('adds the unverified-rules acknowledgement only when needed', () => {
    assert.equal(requiredConfirmations({ rulesetVerified: true }).some((c) => c.key === 'rules_unverified'), false);
    assert.equal(requiredConfirmations({ rulesetVerified: false }).some((c) => c.key === 'rules_unverified'), true);
  });
});

describe('stableStringify', () => {
  it('is independent of key order', () => {
    assert.equal(stableStringify({ b: 1, a: [{ d: 1, c: 2 }] }), stableStringify({ a: [{ c: 2, d: 1 }], b: 1 }));
  });
});
