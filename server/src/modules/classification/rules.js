// Ordered rules: the first match wins, so specific patterns come before general ones.
// Confidence bands (PRD 8.3): >= 0.85 high, 0.6–0.85 medium, below 0.6 low.
export const HIGH_CONFIDENCE = 0.85;

const RULES = [
  // Money out
  { code: 'tax_paid', side: 'debit', confidence: 0.92, pattern: /\b(income\s*tax|advance\s*tax|self[\s-]?assessment|cbdt|oltas|tin[\s-]?nsdl|challan)\b/i },
  { code: 'health_ins', side: 'debit', confidence: 0.85, pattern: /(health\s*ins(urance)?|mediclaim|star\s*health|niva\s*bupa|care\s*health|religare\s*health)/i },
  { code: 'invest_80c', side: 'debit', confidence: 0.85, pattern: /\b(ppf|elss|nps|sukanya|ssy|epf|vpf|lic|life\s*insurance|term\s*plan|tax\s*saver)\b/i },
  { code: 'investment_purchase', side: 'debit', confidence: 0.85, pattern: /\b(sip|mutual\s*fund|mf|zerodha|groww|upstox|kuvera|coin|demat|nse|bse|bonds?)\b/i },
  { code: 'loan', side: 'debit', confidence: 0.85, pattern: /\b(emi|loan|nach|bajaj\s*fin\w*)\b/i },
  { code: 'own_transfer', side: 'debit', confidence: 0.75, pattern: /\b(self|own\s*acc(ount)?|to\s*self)\b/i },
  { code: 'cash_txn', side: 'debit', confidence: 0.85, pattern: /\b(atm|cash\s*(wdl|withdrawal)|nwd)\b/i },
  {
    code: 'personal',
    side: 'debit',
    confidence: 0.85,
    pattern: /\b(swiggy|zomato|amazon|flipkart|bigbasket|blinkit|zepto|netflix|spotify|uber|ola|irctc|makemytrip|recharge|electricity|jio|airtel|petrol|fuel|restaurant|cafe|hotel|rent|landlord|grocery|pharmacy)\b/i,
  },

  // Money in
  { code: 'salary', side: 'credit', confidence: 0.95, pattern: /\b(salary|sal|payroll|wages)\b/i },
  { code: 'interest', side: 'credit', confidence: 0.95, pattern: /\b(int\.?\s*pd|int\.?\s*cr(edit)?|interest)\b/i },
  { code: 'dividend', side: 'credit', confidence: 0.9, pattern: /\b(dividend|div|dvd)\b/i },
  { code: 'refund_reversal', side: 'credit', confidence: 0.8, pattern: /\b(refund|reversal|reversed|chargeback|cashback)\b/i },
  { code: 'own_transfer', side: 'credit', confidence: 0.75, pattern: /\b(self|own\s*acc(ount)?)\b/i },
  { code: 'capital_gain', side: 'credit', confidence: 0.65, pattern: /\b(redemption|redeem|sale\s*proceeds|zerodha|groww|upstox|kuvera|mutual\s*fund|mf|nse|bse)\b/i },
  { code: 'loan', side: 'credit', confidence: 0.8, pattern: /\b(loan|disb\w*)\b/i },
  { code: 'rent_received', side: 'credit', confidence: 0.7, pattern: /\brent\b/i },
  { code: 'business_receipt', side: 'credit', confidence: 0.6, pattern: /\b(invoice|inv\s*no|consulting|professional\s*fee|freelance|client)\b/i },
  { code: 'cash_txn', side: 'credit', confidence: 0.85, pattern: /\b(cash\s*dep(osit)?|cdm)\b/i },
];

const sideOf = (txn) => (txn.credit > 0 ? 'credit' : 'debit');

export const classifyTransaction = (txn) => {
  const side = sideOf(txn);
  for (const rule of RULES) {
    if (rule.side !== side) continue;
    const match = txn.description.match(rule.pattern);
    if (match) return { code: rule.code, confidence: rule.confidence, reason: `Narration contains "${match[0].trim()}"` };
  }
  // Unmatched spending is not tax-relevant; unmatched income must be looked at by a person.
  return side === 'debit'
    ? { code: 'personal', confidence: 0.8, reason: 'Ordinary spending (no tax-relevant pattern found)' }
    : { code: 'unknown', confidence: 0, reason: 'Money received that we could not recognise' };
};
