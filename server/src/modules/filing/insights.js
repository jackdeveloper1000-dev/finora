// Pure scoring helpers for the filing progress header and dashboard insights. No I/O.
export const STEPS = [
  { key: 'start', label: 'Start', path: 'start', weight: 10 },
  { key: 'documents', label: 'Documents', path: 'documents', weight: 20 },
  { key: 'review', label: 'Categorize', path: 'transactions', weight: 20 },
  { key: 'reconcile', label: 'Reconcile', path: 'reconcile', weight: 20 },
  { key: 'tax', label: 'Tax', path: 'tax', weight: 20 },
  { key: 'return', label: 'Return', path: 'itr', weight: 10 },
];

export const readinessScore = (done) => STEPS.reduce((total, s) => total + (done[s.key] ? s.weight : 0), 0);

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// A rough, explainable signal of how likely mismatches are to draw a notice. Not a prediction by the tax department.
export const noticeRisk = ({ hasData, mismatches = 0, missing = 0, escalated = 0, pendingReview = 0, stale = false }) => {
  if (!hasData) return { level: null, score: null, reasons: [] };

  const reasons = [];
  let score = 0;
  if (mismatches > 0) {
    score += Math.min(60, mismatches * 25);
    reasons.push(`${plural(mismatches, 'difference')} between your documents ${mismatches === 1 ? 'is' : 'are'} unresolved.`);
  }
  // Missing figures only mean a check could not be made yet, so they weigh far less than a real mismatch.
  if (missing > 0) {
    score += Math.min(10, missing * 5);
    reasons.push(`${plural(missing, 'check')} could not be made yet. Add the matching document figures to cross-check.`);
  }
  if (escalated > 0) {
    score += Math.min(20, escalated * 10);
    reasons.push(`${plural(escalated, 'item')} waiting for expert review.`);
  }
  if (pendingReview > 0) {
    score += Math.min(20, pendingReview * 5);
    reasons.push(`${plural(pendingReview, 'transaction')} not yet reviewed, so not counted as income.`);
  }
  if (stale) {
    score += 20;
    reasons.push('Your figures changed since the last tax calculation.');
  }

  score = Math.min(100, score);
  if (!reasons.length) reasons.push('Your figures line up across your documents.');
  return { level: score >= 50 ? 'high' : score >= 20 ? 'medium' : 'low', score, reasons };
};

// Unused room under the deduction limits (old regime only). Amounts in rupees.
export const deductionGap = ({ claimed80c = 0, claimed80d = 0, ageCategory = 'general', caps }) => {
  const limit80d = ageCategory === 'general' ? caps.section80D.general : caps.section80D.senior;
  const room = (claimed, limit) => ({ claimed, limit, gap: Math.max(0, limit - claimed) });
  return { section80C: room(claimed80c, caps.section80C), section80D: room(claimed80d, limit80d) };
};

// Section 208: advance tax applies when the estimated liability after TDS is ₹10,000 or more.
export const ADVANCE_TAX_THRESHOLD = 10_000;
export const advanceTax = ({ netPayable }) => ({
  netPayable,
  refund: netPayable < 0,
  applicable: netPayable >= ADVANCE_TAX_THRESHOLD,
});
