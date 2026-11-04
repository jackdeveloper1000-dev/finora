// Quick file: upload a statement, one call prepares everything, one approval finishes the return.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { createApp } from '../../src/app.js';
import { pool, query } from '../../src/config/db.js';
import { env } from '../../src/config/env.js';
import { ensureRulesets } from '../../src/modules/tax/rulesets.js';
import { verifyEmail } from './helpers.js';

const STATEMENT = [
  'Date,Narration,Withdrawal Amt.,Deposit Amt.',
  '01/04/25,NEFT-ACME TECHNOLOGIES-SALARY,,85000.00',
  '01/05/25,NEFT-ACME TECHNOLOGIES-SALARY,,85000.00',
  '28/06/25,INT.PD:01-04-2025 TO 30-06-2025,,412.35',
  '05/06/25,NEFT-RAHUL SHARMA-9921,,7000.00',
  '09/06/25,UPI-SWIGGY-FOOD,640.50,',
].join('\n');
const DEBITS_ONLY = ['Date,Narration,Withdrawal Amt.,Deposit Amt.', '09/06/25,UPI-SWIGGY-FOOD,640.50,'].join('\n');

let dbUp = true;
try {
  await pool.query('SELECT 1');
  await ensureRulesets();
} catch {
  dbUp = false;
}

describe('quick file', { skip: dbUp ? false : 'MySQL is not reachable' }, () => {
  let server;
  let base;
  const emails = [];

  const call = async (method, url, { token, json, form } = {}) => {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    if (json) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${base}${url}`, { method, headers, body: json ? JSON.stringify(json) : form });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };

  const newCustomer = async (assessmentYear) => {
    const email = `qk-${randomUUID().slice(0, 8)}@example.com`;
    emails.push(email);
    await call('POST', '/api/auth/register', { json: { name: 'Quick Tester', email, password: 'abc12345' } });
    const { body } = await verifyEmail(base, email);
    const token = body.accessToken;
    await call('PUT', '/api/profile', { token, json: { fullName: 'Quick Tester', pan: 'ABCPE1234F', dob: '1992-04-18', residentialStatus: 'resident', occupation: 'salaried', address: '12 MG Road, Pune' } });
    const kase = (await call('POST', '/api/cases', { token, json: { assessmentYear } })).body.case;
    return { token, caseId: kase.id };
  };

  const upload = (token, caseId, content) => {
    const form = new FormData();
    form.append('docType', 'bank_statement');
    form.append('file', new Blob([content], { type: 'text/csv' }), `${randomUUID().slice(0, 6)}.csv`);
    return call('POST', `/api/cases/${caseId}/documents`, { token, form });
  };

  before(() => {
    server = createApp().listen(0);
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    server?.close();
    for (const email of emails) {
      const [user] = await query('SELECT id FROM users WHERE email = :email', { email });
      if (user) {
        await rm(path.join(env.uploadDir, String(user.id)), { recursive: true, force: true });
        await query('DELETE FROM audit_events WHERE user_id = :id', { id: user.id });
        await query('DELETE FROM users WHERE id = :id', { id: user.id });
      }
    }
    await pool.end();
  });

  it('prepares a complete return from one upload and one call', async () => {
    const { token, caseId } = await newCustomer('2026-27');
    assert.equal((await upload(token, caseId, STATEMENT)).status, 201);

    const prepared = await call('POST', `/api/cases/${caseId}/quick-prepare`, { token });
    assert.equal(prepared.status, 200, JSON.stringify(prepared.body));
    assert.equal(prepared.body.status, 'ready');
    assert.equal(prepared.body.files.read, 1);
    assert.equal(prepared.body.setAside, 1, 'the unknown deposit is left out of income, not blocking');
    assert.ok(['old', 'new'].includes(prepared.body.summary.regime));
    assert.equal(prepared.body.return.validation.errors.length, 0, JSON.stringify(prepared.body.return.validation.errors));
    assert.equal(prepared.body.return.canApprove, true);

    const keys = prepared.body.return.confirmations.map((c) => c.key);
    const approved = await call('POST', `/api/cases/${caseId}/itr/approve`, { token, json: { confirmations: keys } });
    assert.equal(approved.body.status, 'approved');
    assert.equal((await call('GET', `/api/cases/${caseId}/itr/export`, { token })).status, 200);
  });

  it('can be run again safely', async () => {
    const { token, caseId } = await newCustomer('2025-26');
    await upload(token, caseId, STATEMENT);
    const first = await call('POST', `/api/cases/${caseId}/quick-prepare`, { token });
    const again = await call('POST', `/api/cases/${caseId}/quick-prepare`, { token });
    assert.equal(again.status, 200);
    assert.equal(again.body.files.read, 0, 'nothing is read twice');
    assert.equal(again.body.summary.netPayable, first.body.summary.netPayable);
  });

  it('says so plainly when there is no income to report', async () => {
    const { token, caseId } = await newCustomer('2026-27');
    await upload(token, caseId, DEBITS_ONLY);
    const res = await call('POST', `/api/cases/${caseId}/quick-prepare`, { token });
    assert.equal(res.body.status, 'no_income');
  });

  it('only prepares your own return', async () => {
    const owner = await newCustomer('2026-27');
    const other = await newCustomer('2026-27');
    assert.equal((await call('POST', `/api/cases/${owner.caseId}/quick-prepare`, { token: other.token })).status, 404);
    assert.equal((await call('POST', `/api/cases/${owner.caseId}/quick-prepare`)).status, 401);
  });
});
