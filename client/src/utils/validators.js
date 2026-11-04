const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE = /^[6-9]\d{9}$/;
const PAN = /^[A-Z]{5}\d{4}[A-Z]$/;
const PAN_HOLDER_TYPES = 'PCHFATBELJG';

// Optional money field: '' -> null, '1,23,456.50' -> 123456.5, anything else -> NaN.
export const parseAmountInput = (text) => {
  const cleaned = String(text ?? '').replace(/[₹,\s]/g, '');
  if (!cleaned) return null;
  return /^\d+(\.\d{1,2})?$/.test(cleaned) ? Number(cleaned) : NaN;
};

export const rules = {
  optionalAmount: (v) => (Number.isNaN(parseAmountInput(v)) ? 'Enter a valid amount, e.g. 1,25,000.50' : ''),
  required: (message) => (v) => (String(v ?? '').trim() ? '' : message),
  email: (v) => (!v || EMAIL.test(v.trim()) ? '' : 'Enter a valid email'),
  mobile: (v) => (!v || MOBILE.test(v.trim()) ? '' : 'Enter a valid 10-digit mobile number'),
  pan: (v) => {
    const pan = (v ?? '').trim().toUpperCase();
    if (!pan) return '';
    if (!PAN.test(pan)) return 'PAN must look like ABCPE1234F';
    return PAN_HOLDER_TYPES.includes(pan[3]) ? '' : `The 4th letter “${pan[3]}” is not a valid holder type. Expected P (individual), H, F, C, A, B, E, G, J, L or T.`;
  },
  password: (v) => {
    if (!v || v.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Za-z]/.test(v)) return 'Password must include a letter';
    if (!/\d/.test(v)) return 'Password must include a number';
    return '';
  },
  adult: (v) => {
    if (!v) return 'Enter your date of birth';
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 18);
    return new Date(v) <= cutoff ? '' : 'You must be at least 18 years old';
  },
};

// Builds a validate(values) fn from { field: [rule, rule] }; first failing rule wins.
export const createValidator = (schema) => (values) =>
  Object.fromEntries(
    Object.entries(schema).map(([field, fieldRules]) => [
      field,
      fieldRules.map((rule) => rule(values[field])).find(Boolean) || '',
    ]),
  );
