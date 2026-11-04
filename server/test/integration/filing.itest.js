// Filing hand-off: only an approved return can be marked filed, once, with a valid acknowledgement.
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

const STATEMENT = ['Date,Narration,Withdrawal Amt.,Deposit Amt.', '01/04/25,NEFT-ACME TECHNOLOGIES-SALARY,,85000.00', '28/06/25,INT.PD:01-04-2025 TO 30-06-2025,,412.35'].join('\n');

let dbUp = true;
try {
  await pool.query('SELECT 1');
  await ensureRulesets();
} catch {
  dbUp = false;
}

describe('filing hand-off', { skip: dbUp ? false : 'MySQL is not reachable' }, () => {
  let server;
  let base;
  const emails = [];
  const s = {};

  const call = async (method, url, { token, json, form } = {}) => {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    if (json) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${base}${url}`, { method, headers, body: json ? JSON.stringify(json) : form });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };

  const customer = async () => {
    const email = `fl-${randomUUID().slice(0, 8)}@example.com`;
    emails.push(email);
    await call('POST', '/api/auth/register', { json: { name: 'Filing Tester', email, password: 'abc12345' } });
    const token = (await verifyEmail(base, email)).body.accessToken;
    await call('PUT', '/api/profile', { token, json: { fullName: 'Filing Tester', pan: 'ABCPE1234F', dob: '1992-04-18', residentialStatus: 'resident', occupation: 'salaried', address: 'Pune' } });
    return token;
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

  it('prepares a return and keeps filing closed until it is approved', async () => {
    s.token = await customer();
    s.caseId = (await call('POST', '/api/cases', { token: s.token, json: { assessmentYear: '2026-27' } })).body.case.id;
    const form = new FormData();
    form.append('docType', 'bank_statement');
    form.append('file', new Blob([STATEMENT], { type: 'text/csv' }), 'statement.csv');
    await call('POST', `/api/cases/${s.caseId}/documents`, { token: s.token, form });
    const prepared = await call('POST', `/api/cases/${s.caseId}/quick-prepare`, { token: s.token });
    assert.equal(prepared.body.status, 'ready');
    s.confirmations = prepared.body.return.confirmations.map((c) => c.key);

    const before = await call('GET', `/api/cases/${s.caseId}/filing-submission`, { token: s.token });
    assert.equal(before.status, 200);
    assert.equal(before.body.canFile, false);
    assert.equal(before.body.provider.directFiling, false);
    assert.match(before.body.provider.portalUrl, /^https:\/\/www\.incometax\.gov\.in\//);

    const early = await call('POST', `/api/cases/${s.caseId}/filing-submission`, { token: s.token, json: { ackNumber: '123456789012345', filedOn: '2026-11-01', eVerified: true } });
    assert.equal(early.status, 409);
    assert.equal(early.body.error.code, 'NOT_APPROVED');
  });

  it('rejects a bad acknowledgement number or a future date', async () => {
    await call('POST', `/api/cases/${s.caseId}/itr/approve`, { token: s.token, json: { confirmations: s.confirmations } });
    assert.equal((await call('GET', `/api/cases/${s.caseId}/filing-submission`, { token: s.token })).body.canFile, true);

    const bad = await call('POST', `/api/cases/${s.caseId}/filing-submission`, { token: s.token, json: { ackNumber: 'abc', filedOn: '2026-11-01' } });
    assert.equal(bad.status, 400);
    const future = await call('POST', `/api/cases/${s.caseId}/filing-submission`, { token: s.token, json: { ackNumber: '123456789012345', filedOn: '2999-01-01' } });
    assert.equal(future.status, 400);
  });

  it('marks the return as filed once, and keeps the package downloadable', async () => {
    const done = await call('POST', `/api/cases/${s.caseId}/filing-submission`, { token: s.token, json: { ackNumber: '123456789012345', filedOn: '2026-11-01', eVerified: true } });
    assert.equal(done.status, 201, JSON.stringify(done.body));
    assert.equal(done.body.status, 'filed');
    assert.equal(done.body.submission.ackNumber, '123456789012345');
    assert.equal(done.body.submission.eVerified, true);
    assert.equal(done.body.canFile, false);

    const again = await call('POST', `/api/cases/${s.caseId}/filing-submission`, { token: s.token, json: { ackNumber: '999999999999999', filedOn: '2026-11-02' } });
    assert.equal(again.body.error.code, 'ALREADY_FILED');

    const itr = await call('GET', `/api/cases/${s.caseId}/itr`, { token: s.token });
    assert.equal(itr.body.status, 'filed');
    assert.equal(itr.body.canApprove, false);
    assert.equal(itr.body.canExport, true);
    assert.equal((await call('GET', `/api/cases/${s.caseId}/itr/export`, { token: s.token })).status, 200);
  });

  it('keeps other people out', async () => {
    const other = await customer();
    assert.equal((await call('GET', `/api/cases/${s.caseId}/filing-submission`, { token: other })).status, 404);
    assert.equal((await call('POST', `/api/cases/${s.caseId}/filing-submission`, { token: other, json: { ackNumber: '123456789012345', filedOn: '2026-11-01' } })).status, 404);
    assert.equal((await call('GET', `/api/cases/${s.caseId}/filing-submission`)).status, 401);
  });
});
