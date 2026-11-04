const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const EXCEL_EPOCH_OFFSET_DAYS = 25569;

const pad = (n) => String(n).padStart(2, '0');

const toIso = (year, month, day) => {
  const fullYear = year < 100 ? 2000 + year : year;
  const date = new Date(Date.UTC(fullYear, month - 1, day));
  const valid = date.getUTCFullYear() === fullYear && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return valid ? `${fullYear}-${pad(month)}-${pad(day)}` : null;
};

// Indian statements are day-first: 05/04/2025 is 5 April.
export const parseDate = (value) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : toIso(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  }
  if (typeof value === 'number') {
    return value > 20000 && value < 80000 ? parseDate(new Date(Math.round((value - EXCEL_EPOCH_OFFSET_DAYS) * 86_400_000))) : null;
  }
  const text = String(value ?? '').trim();

  let m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (m) return toIso(Number(m[1]), Number(m[2]), Number(m[3]));

  m = text.match(/^(\d{1,2})[/\-. ](\d{1,2})[/\-. ](\d{2}|\d{4})(?:\s.*)?$/);
  if (m) return toIso(Number(m[3]), Number(m[2]), Number(m[1]));

  m = text.match(/^(\d{1,2})[/\-. ]([A-Za-z]{3,9})[/\-. ,]*(\d{2}|\d{4})(?:\s.*)?$/);
  if (m) {
    const month = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1;
    return month ? toIso(Number(m[3]), month, Number(m[1])) : null;
  }
  return null;
};

// Returns { paise, side } or null. Money is kept as integer paise to avoid float drift.
export const parseAmount = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? { paise: Math.round(value * 100), side: null } : null;

  let text = String(value ?? '').trim();
  if (!text) return null;

  let negative = /^\(.*\)$/.test(text);
  let side = null;
  const marker = text.match(/(?:^|\s)(dr|cr)\.?$|^(dr|cr)\.?\s/i);
  if (marker) {
    side = (marker[1] || marker[2]).toLowerCase();
    text = text.replace(marker[0], '');
  }
  text = text.replace(/[₹,\s()]|rs\.?|inr/gi, '');
  if (text.startsWith('-')) {
    negative = true;
    text = text.slice(1);
  }
  if (!/^\d+(\.\d+)?$/.test(text)) return null;

  const paise = Math.round(Number(text) * 100);
  return { paise: negative ? -paise : paise, side };
};

export const parseSide = (value) => {
  const text = String(value ?? '').trim().toLowerCase();
  if (/^(dr|debit|d|withdrawal)\.?$/.test(text)) return 'dr';
  if (/^(cr|credit|c|deposit)\.?$/.test(text)) return 'cr';
  return null;
};

export const cellText = (value) => (value == null ? '' : String(value).replace(/\s+/g, ' ').trim());
