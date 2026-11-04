import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { reconcileBalances } from '../src/modules/ledger/integrity.js';
import { parseAmount, parseDate } from '../src/modules/ledger/parsers/cellParsers.js';
import { parseTable } from '../src/modules/ledger/parsers/tabular.js';

describe('parseDate', () => {
  it('reads common Indian formats day-first', () => {
    assert.equal(parseDate('05/04/2025'), '2025-04-05');
    assert.equal(parseDate('05-04-25'), '2025-04-05');
    assert.equal(parseDate('5 Apr 2025'), '2025-04-05');
    assert.equal(parseDate('05-Apr-2025'), '2025-04-05');
    assert.equal(parseDate('2025-04-05'), '2025-04-05');
    assert.equal(parseDate(new Date(Date.UTC(2025, 3, 5))), '2025-04-05');
    assert.equal(parseDate(45752), '2025-04-05');
  });
  it('rejects impossible dates and text', () => {
    assert.equal(parseDate('31/02/2025'), null);
    assert.equal(parseDate('Total'), null);
    assert.equal(parseDate(''), null);
  });
});

describe('parseAmount', () => {
  it('handles separators, symbols and markers', () => {
    assert.deepEqual(parseAmount('1,23,456.78'), { paise: 12345678, side: null });
    assert.deepEqual(parseAmount('₹ 500'), { paise: 50000, side: null });
    assert.deepEqual(parseAmount('2,500.00 Dr'), { paise: 250000, side: 'dr' });
    assert.deepEqual(parseAmount('(750.50)'), { paise: -75050, side: null });
    assert.deepEqual(parseAmount(-10.1), { paise: -1010, side: null });
  });
  it('avoids float drift', () => {
    assert.equal(parseAmount('0.1').paise + parseAmount('0.2').paise, 30);
  });
  it('returns null for blanks and text', () => {
    assert.equal(parseAmount(''), null);
    assert.equal(parseAmount('n/a'), null);
  });
});

describe('parseTable', () => {
  const hdfc = [
    ['HDFC BANK LTD', '', '', '', '', '', ''],
    ['Account No : 50100123456789', '', '', '', '', '', ''],
    ['Date', 'Narration', 'Chq./Ref.No.', 'Value Dt', 'Withdrawal Amt.', 'Deposit Amt.', 'Closing Balance'],
    ['01/04/25', 'UPI-SWIGGY', '123', '01/04/25', '450.00', '', '9,550.00'],
    ['02/04/25', 'NEFT-ACME CORP-SALARY', '124', '02/04/25', '', '50,000.00', '59,550.00'],
    ['', 'MARCH 2025', '', '', '', '', ''],
    ['Total', '', '', '', '450.00', '50,000.00', ''],
  ];

  it('detects columns, account, bank and multi-line narration', () => {
    const out = parseTable(hdfc);
    assert.equal(out.bankName, 'HDFC Bank');
    assert.equal(out.accountLast4, '6789');
    assert.equal(out.transactions.length, 2);
    assert.equal(out.transactions[0].debit, 45000);
    assert.equal(out.transactions[1].credit, 5000000);
    assert.equal(out.transactions[1].description, 'NEFT-ACME CORP-SALARY MARCH 2025');
    assert.equal(out.transactions[1].valueDate, '2025-04-02');
    assert.equal(out.skippedRows, 1);
  });

  it('supports a single Amount column with a Dr/Cr column', () => {
    const out = parseTable([
      ['Txn Date', 'Description', 'Amount', 'Dr/Cr', 'Balance'],
      ['01-Apr-2025', 'ATM WDL', '2,000.00', 'DR', '8,000.00'],
      ['02-Apr-2025', 'Interest', '45.00', 'CR', '8,045.00'],
    ]);
    assert.equal(out.transactions[0].debit, 200000);
    assert.equal(out.transactions[1].credit, 4500);
    assert.equal(out.signConventionAssumed, false);
  });

  it('flags an assumed sign convention when no Dr/Cr info exists', () => {
    const out = parseTable([
      ['Date', 'Description', 'Amount'],
      ['01/04/2025', 'Shop', '-300'],
      ['02/04/2025', 'Refund', '100'],
    ]);
    assert.equal(out.transactions[0].debit, 30000);
    assert.equal(out.transactions[1].credit, 10000);
    assert.equal(out.signConventionAssumed, true);
  });

  it('throws a clear error when there is no transaction table', () => {
    assert.throws(() => parseTable([['hello', 'world'], ['1', '2']]), { code: 'NO_TRANSACTIONS' });
  });
});

describe('reconcileBalances', () => {
  const t = (rowNumber, debit, credit, balance) => ({ rowNumber, debit, credit, balance });

  it('passes for oldest-first statements', () => {
    const out = reconcileBalances([t(2, 100, 0, 900), t(3, 0, 50, 950)]);
    assert.deepEqual(out.breaks, []);
    assert.equal(out.opening, 1000);
    assert.equal(out.closing, 950);
  });

  it('passes for newest-first statements', () => {
    const out = reconcileBalances([t(2, 0, 50, 950), t(3, 100, 0, 900)]);
    assert.deepEqual(out.breaks, []);
    assert.equal(out.opening, 1000);
    assert.equal(out.closing, 950);
  });

  it('reports rows where the chain breaks', () => {
    const out = reconcileBalances([t(2, 100, 0, 900), t(3, 0, 50, 999)]);
    assert.deepEqual(out.breaks, [3]);
  });

  it('skips the check when balances are absent', () => {
    assert.equal(reconcileBalances([t(2, 100, 0, null), t(3, 0, 50, null)]).checked, false);
  });
});
