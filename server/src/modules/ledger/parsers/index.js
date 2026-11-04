import { parse as parseCsvText } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { AppError } from '../../../utils/AppError.js';
import { parseTable } from './tabular.js';

const MAX_ROWS = 100_000;

const plainValue = (value) => {
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    if ('result' in value) return plainValue(value.result);
    if ('richText' in value) return value.richText.map((part) => part.text).join('');
    if ('text' in value) return value.text;
    return '';
  }
  return value;
};

const readCsv = async (buffer) =>
  parseCsvText(buffer, {
    bom: true,
    delimiter: [',', ';', '\t', '|'],
    relax_column_count: true,
    relax_quotes: true,
    skip_empty_lines: true,
    to: MAX_ROWS,
  });

const readXlsxSheets = async (buffer) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  return workbook.worksheets.map((sheet) => {
    const rows = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      if (rows.length < MAX_ROWS) rows.push(row.values.slice(1).map(plainValue));
    });
    return rows;
  });
};

const parseXlsx = async (buffer) => {
  let lastError;
  for (const rows of await readXlsxSheets(buffer)) {
    try {
      return parseTable(rows);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new AppError(422, 'NO_TRANSACTIONS', 'The workbook has no readable sheets.');
};

const PARSERS = {
  'text/csv': async (buffer) => parseTable(await readCsv(buffer)),
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': parseXlsx,
};

const UNAVAILABLE = {
  'application/pdf': 'PDF statements are not supported yet. Download the statement as CSV or Excel (.xlsx) from your net banking for now.',
  'application/vnd.ms-excel': 'Old Excel (.xls) files are not supported. Save the file as .xlsx or CSV and upload again.',
};

export const parseStatement = async (buffer, mimeType) => {
  const parser = PARSERS[mimeType];
  if (!parser) {
    throw new AppError(422, 'PARSER_UNAVAILABLE', UNAVAILABLE[mimeType] ?? 'This file type cannot be read as a bank statement yet.');
  }
  try {
    return await parser(buffer);
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(422, 'UNREADABLE_FILE', 'The file could not be read. It may be corrupted or password-protected.');
  }
};
