import { AppError } from '../../../utils/AppError.js';
import { cellText, parseAmount, parseDate, parseSide } from './cellParsers.js';

const HEADER_SCAN_ROWS = 60;

// Order matters: more specific patterns first (e.g. "value date" before "date", "dr/cr" before "dr").
const HEADER_PATTERNS = [
  ['valueDate', /^value\s*(date|dt)$/],
  ['type', /^(dr\s*\/\s*cr|cr\s*\/\s*dr|credit\s*\/\s*debit|debit\s*\/\s*credit|type|txn type|transaction type)$/],
  ['date', /^(txn|transaction|tran|posting)?\s*date$/],
  ['balance', /balance|^bal$/],
  ['debit', /withdraw|debit|^dr\b|paid out/],
  ['credit', /deposit|credit|^cr\b|paid in/],
  ['amount', /^(transaction\s*)?amount/],
  ['description', /narration|description|particulars|remarks|details/],
];

const KNOWN_BANKS = [
  ['HDFC Bank', /hdfc/i], ['ICICI Bank', /icici/i], ['State Bank of India', /state bank|\bsbi\b/i],
  ['Axis Bank', /axis bank/i], ['Kotak Mahindra Bank', /kotak/i], ['Punjab National Bank', /punjab national|\bpnb\b/i],
  ['Bank of Baroda', /bank of baroda/i], ['IDFC FIRST Bank', /idfc/i], ['Yes Bank', /yes bank/i],
  ['IndusInd Bank', /indusind/i], ['Canara Bank', /canara/i], ['Union Bank of India', /union bank/i],
];

const classifyHeader = (cell) => {
  const text = cellText(cell).toLowerCase().replace(/[^a-z/ ]/g, ' ').replace(/\s+/g, ' ').trim();
  return text ? HEADER_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0] ?? null : null;
};

const findHeader = (rows) => {
  for (let index = 0; index < Math.min(rows.length, HEADER_SCAN_ROWS); index++) {
    const columns = {};
    rows[index].forEach((cell, col) => {
      const key = classifyHeader(cell);
      if (key && columns[key] === undefined) columns[key] = col;
    });
    if (columns.date !== undefined && (columns.debit !== undefined || columns.credit !== undefined || columns.amount !== undefined)) {
      return { index, columns };
    }
  }
  return null;
};

const detectAccount = (rows) => {
  const text = rows.map((r) => r.map(cellText).join(' ')).join('\n');
  const bankName = KNOWN_BANKS.find(([, pattern]) => pattern.test(text))?.[0] ?? null;
  const account = text.match(/(?:a\/c|account)\s*(?:no|number|#)?\.?\s*[:-]?\s*([xX*\d][xX*\d\s-]{5,})/i);
  const digits = account?.[1].replace(/\D/g, '') ?? '';
  return { bankName, accountLast4: digits.length >= 4 ? digits.slice(-4) : null };
};

const readAmounts = (row, columns) => {
  const at = (key) => (columns[key] === undefined ? null : parseAmount(row[columns[key]]));

  if (columns.debit !== undefined || columns.credit !== undefined) {
    return { debit: Math.abs(at('debit')?.paise ?? 0), credit: Math.abs(at('credit')?.paise ?? 0), assumed: false };
  }
  const amount = at('amount');
  if (!amount) return { debit: 0, credit: 0, assumed: false };

  const side = amount.side ?? (columns.type === undefined ? null : parseSide(row[columns.type]));
  if (side === 'dr') return { debit: Math.abs(amount.paise), credit: 0, assumed: false };
  if (side === 'cr') return { debit: 0, credit: Math.abs(amount.paise), assumed: false };
  return amount.paise < 0
    ? { debit: -amount.paise, credit: 0, assumed: true }
    : { debit: 0, credit: amount.paise, assumed: true };
};

/**
 * Converts a 2-D grid of cells into normalized transactions (amounts in integer paise).
 * Format-specific readers (CSV, XLSX, later PDF) only need to produce the grid.
 */
export const parseTable = (rows) => {
  const header = findHeader(rows);
  if (!header) {
    throw new AppError(422, 'NO_TRANSACTIONS', 'Could not find a transaction table. Make sure the file has Date, Description and Debit/Credit (or Amount) columns.');
  }

  const { columns } = header;
  const transactions = [];
  let skippedRows = 0;
  let signConventionAssumed = false;

  for (let i = header.index + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row.some((c) => cellText(c))) continue;

    const date = parseDate(row[columns.date]);
    const description = columns.description === undefined ? '' : cellText(row[columns.description]);
    const { debit, credit, assumed } = readAmounts(row, columns);
    const hasAmount = debit > 0 || credit > 0;

    if (!date) {
      const last = transactions.at(-1);
      const isContinuation = last && description && !hasAmount && row.filter((c) => cellText(c)).length === 1;
      if (isContinuation) last.description = `${last.description} ${description}`.trim();
      else skippedRows++;
      continue;
    }
    if (!hasAmount) {
      skippedRows++;
      continue;
    }

    signConventionAssumed ||= assumed;
    const balance = columns.balance === undefined ? null : parseAmount(row[columns.balance]);
    transactions.push({
      rowNumber: i + 1,
      date,
      valueDate: columns.valueDate === undefined ? null : parseDate(row[columns.valueDate]),
      description: description || '(no description)',
      debit,
      credit,
      balance: balance ? balance.paise : null,
    });
  }

  if (!transactions.length) {
    throw new AppError(422, 'NO_TRANSACTIONS', 'Found the table headers but no valid transaction rows.');
  }
  return { transactions, skippedRows, signConventionAssumed, ...detectAccount(rows.slice(0, header.index)) };
};
