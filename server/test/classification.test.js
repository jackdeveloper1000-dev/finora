import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HIGH_CONFIDENCE, classifyTransaction } from '../src/modules/classification/rules.js';
import { similarKey } from '../src/modules/classification/similarity.js';

const debit = (description) => classifyTransaction({ description, debit: 100, credit: 0 });
const credit = (description) => classifyTransaction({ description, debit: 0, credit: 100 });

describe('classifyTransaction — money in', () => {
  it('recognises salary, interest and dividends with high confidence', () => {
    assert.equal(credit('NEFT-ACME TECHNOLOGIES-SALARY').code, 'salary');
    assert.equal(credit('INT.PD:01-01-2026 TO 31-03-2026').code, 'interest');
    assert.equal(credit('ACH C- INFOSYS LTD DIVIDEND').code, 'dividend');
    for (const d of ['NEFT-ACME-SALARY', 'INT.PD:01-01-2026', 'DIVIDEND INFY']) {
      assert.ok(credit(d).confidence >= HIGH_CONFIDENCE, d);
    }
  });

  it('keeps capital-gain, rent and business receipts below the auto threshold', () => {
    for (const d of ['ZERODHA BROKING REDEMPTION', 'UPI-TENANT-RENT MARCH', 'NEFT-INVOICE 204 CLIENT PAYMENT']) {
      assert.ok(credit(d).confidence < HIGH_CONFIDENCE, d);
    }
    assert.equal(credit('ZERODHA BROKING REDEMPTION').code, 'capital_gain');
    assert.equal(credit('UPI-TENANT-RENT MARCH').code, 'rent_received');
    assert.equal(credit('NEFT-INVOICE 204 CLIENT PAYMENT').code, 'business_receipt');
  });

  it('never guesses for unrecognised income', () => {
    const result = credit('NEFT-RAHUL SHARMA-9921');
    assert.equal(result.code, 'unknown');
    assert.equal(result.confidence, 0);
  });

  it('does not treat a word merely containing "sal" as salary', () => {
    assert.notEqual(credit('UPI-SALON BEAUTY-REFUND').code, 'salary');
  });
});

describe('classifyTransaction — money out', () => {
  it('maps tax-relevant payments', () => {
    assert.equal(debit('ADVANCE TAX CHALLAN 280 OLTAS').code, 'tax_paid');
    assert.equal(debit('LIC OF INDIA PREMIUM').code, 'invest_80c');
    assert.equal(debit('PPF DEPOSIT SBI').code, 'invest_80c');
    assert.equal(debit('STAR HEALTH INSURANCE').code, 'health_ins');
  });

  it('maps investments, loans, cash and spending', () => {
    assert.equal(debit('ECS-SIP-HDFC MUTUAL FUND').code, 'investment_purchase');
    assert.equal(debit('NACH HOME LOAN EMI').code, 'loan');
    assert.equal(debit('ATM WDL MUMBAI').code, 'cash_txn');
    assert.equal(debit('UPI-SWIGGY-FOOD').code, 'personal');
  });

  it('treats unmatched spending as ordinary, not as something to review', () => {
    const result = debit('UPI-RAMESH KUMAR-4821');
    assert.equal(result.code, 'personal');
    assert.ok(result.confidence >= HIGH_CONFIDENCE - 0.1);
  });

  it('does not use credit rules on debits', () => {
    assert.notEqual(debit('NEFT-ACME-SALARY').code, 'salary');
  });

  it('explains every decision', () => {
    assert.match(debit('UPI-SWIGGY-FOOD').reason, /swiggy/i);
    assert.ok(credit('NEFT-RAHUL-9921').reason.length > 0);
  });
});

describe('similarKey', () => {
  it('groups the same payee regardless of reference numbers', () => {
    assert.equal(similarKey('UPI-SWIGGY-FOOD 4821'), similarKey('UPI/SWIGGY/FOOD 9930'));
    assert.equal(similarKey('NEFT-RAHUL SHARMA-9921'), 'rahul sharma');
  });

  it('separates different payees', () => {
    assert.notEqual(similarKey('UPI-SWIGGY-FOOD'), similarKey('UPI-ZOMATO-FOOD'));
  });

  it('returns empty for narrations with no words', () => {
    assert.equal(similarKey('12345 67890'), '');
  });
});
