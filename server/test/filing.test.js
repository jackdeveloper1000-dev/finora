import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { STEPS, advanceTax, deductionGap, noticeRisk, readinessScore } from '../src/modules/filing/insights.js';

const CAPS = { section80C: 150_000, section80D: { general: 25_000, senior: 50_000 } };

describe('readinessScore', () => {
  it('weights add up to 100', () => {
    assert.equal(STEPS.reduce((s, x) => s + x.weight, 0), 100);
  });

  it('scores completed steps only', () => {
    assert.equal(readinessScore({}), 0);
    assert.equal(readinessScore({ start: true, documents: true }), 30);
    assert.equal(readinessScore(Object.fromEntries(STEPS.map((s) => [s.key, true]))), 100);
  });
});

describe('noticeRisk', () => {
  it('is unscored until there is data', () => {
    assert.deepEqual(noticeRisk({ hasData: false }), { level: null, score: null, reasons: [] });
  });

  it('is low and reassuring when everything lines up', () => {
    const r = noticeRisk({ hasData: true });
    assert.equal(r.level, 'low');
    assert.match(r.reasons[0], /line up/);
  });

  it('rises with unresolved differences, escalations, unreviewed rows and stale figures', () => {
    assert.equal(noticeRisk({ hasData: true, mismatches: 1 }).level, 'medium');
    assert.equal(noticeRisk({ hasData: true, mismatches: 2 }).level, 'high');
    assert.equal(noticeRisk({ hasData: true, pendingReview: 2, stale: true }).level, 'medium');
  });

  it('caps the score at 100 and explains each factor', () => {
    const r = noticeRisk({ hasData: true, mismatches: 9, missing: 9, escalated: 9, pendingReview: 99, stale: true });
    assert.equal(r.score, 100);
    assert.equal(r.reasons.length, 5);
  });
});

describe('noticeRisk with missing documents', () => {
  it('does not treat figures you have not added yet as a mismatch', () => {
    const r = noticeRisk({ hasData: true, missing: 2 });
    assert.equal(r.level, 'low');
    assert.match(r.reasons[0], /could not be made yet/);
  });
});

describe('deductionGap', () => {
  it('shows unused room and never goes negative', () => {
    const r = deductionGap({ claimed80c: 100_000, claimed80d: 40_000, caps: CAPS });
    assert.equal(r.section80C.gap, 50_000);
    assert.equal(r.section80D.gap, 0);
  });

  it('uses the senior 80D limit', () => {
    assert.equal(deductionGap({ claimed80d: 0, ageCategory: 'senior', caps: CAPS }).section80D.limit, 50_000);
  });
});

describe('advanceTax', () => {
  it('applies from ₹10,000 payable after TDS', () => {
    assert.equal(advanceTax({ netPayable: 10_000 }).applicable, true);
    assert.equal(advanceTax({ netPayable: 9_999 }).applicable, false);
    assert.equal(advanceTax({ netPayable: -500 }).refund, true);
  });
});
