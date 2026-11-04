const STOP_WORDS = new Set(['upi', 'neft', 'imps', 'rtgs', 'ecs', 'nach', 'pos', 'ach', 'ref', 'txn', 'the', 'and', 'bank', 'ltd']);

// Reduces a narration to its counterparty words ("UPI-SWIGGY-FOOD 4821" -> "swiggy food"),
// so a correction can be applied to the same payee's other transactions.
export const similarKey = (description) =>
  description
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word))
    .slice(0, 3)
    .join(' ');
