// End-to-end: boots the real app against the dev database and walks one taxpayer from sign-up to an approved return.
// Cleans up every user and file it creates. Run with: npm run test:integration (MySQL must be running).
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { verifyEmail } from './helpers.js';
import { createApp } from '../../src/app.js';
import { pool, query } from '../../src/config/db.js';
import { env } from '../../src/config/env.js';
import { ensureRulesets } from '../../src/modules/tax/rulesets.js';

const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
const STATEMENT = [
  'Date,Narration,Withdrawal Amt.,Deposit Amt.',
  '01/04/25,NEFT-ACME TECHNOLOGIES-SALARY,,85000.00',
  '01/05/25,NEFT-ACME TECHNOLOGIES-SALARY,,85000.00',
  '28/06/25,INT.PD:01-04-2025 TO 30-06-2025,,412.35',
  '05/06/25,NEFT-RAHUL SHARMA-9921,,7000.00',
  '09/06/25,UPI-SWIGGY-FOOD,640.50,',
].join('\n');

let dbUp = true;
try {
  await pool.query('SELECT 1');
  await ensureRulesets();
} catch {
  dbUp = false;
}

describe('taxpayer lifecycle', { skip: dbUp ? false : 'MySQL is not reachable' }, () => {
  let server;
  let base;
  const emails = [];
  const state = {};

  const call = async (method, url, { token, json, form, raw } = {}) => {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    if (json) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${base}${url}`, { method, headers, body: json ? JSON.stringify(json) : form });
    const text = await res.text();
    return { status: res.status, body: raw ? text : text ? JSON.parse(text) : null, headers: res.headers };
  };

  const register = async (name) => {
    const email = `it-${randomUUID().slice(0, 8)}@example.com`;
    emails.push(email);
    const res = await call('POST', '/api/auth/register', { json: { name, email, password: 'abc12345' } });
    assert.equal(res.status, 201);
    assert.equal(res.body.verificationRequired, true);
    const verified = await verifyEmail(base, email);
    return { token: verified.body.accessToken, email };
  };

  const upload = (token, caseId, content, name, docType = 'bank_statement') => {
    const form = new FormData();
    form.append('docType', docType);
    form.append('file', new Blob([content], { type: 'text/csv' }), name);
    return call('POST', `/api/cases/${caseId}/documents`, { token, form });
  };

  before(async () => {
    server = createApp().listen(0);
    base = `http://127.0.0.1:${server.address().port}`;
    const me = await register('Integration Tester');
    state.token = me.token;
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

  it('prepares a profile and a return', async () => {
    const badPan = await call('PUT', '/api/profile', { token: state.token, json: { fullName: 'Integration Tester', pan: 'ABCDE1234F', dob: '1992-04-18', residentialStatus: 'resident', occupation: 'salaried' } });
    assert.equal(badPan.status, 400, 'the 4th PAN letter must be a valid holder type');
    assert.match(badPan.body.error.details[0].message, /holder type/);

    const profile = await call('PUT', '/api/profile', { token: state.token, json: { fullName: 'Integration Tester', pan: 'ABCPE1234F', dob: '1992-04-18', residentialStatus: 'resident', occupation: 'salaried', address: '12 MG Road, Pune' } });
    assert.equal(profile.status, 200);
    assert.equal(profile.body.profile.panMasked, 'XXXXXX234F');

    const created = await call('POST', '/api/cases', { token: state.token, json: { assessmentYear: '2026-27' } });
    assert.equal(created.status, 201);
    state.caseId = created.body.case.id;
    assert.equal((await call('POST', '/api/cases', { token: state.token, json: { assessmentYear: '2026-27' } })).status, 409);
  });

  it('blocks malware and stores accepted files encrypted', async () => {
    const infected = await upload(state.token, state.caseId, EICAR, 'bad.csv');
    assert.equal(infected.status, 422);
    assert.equal(infected.body.error.code, 'MALWARE_DETECTED');

    const ok = await upload(state.token, state.caseId, STATEMENT, 'statement.csv');
    assert.equal(ok.status, 201);
    state.documentId = ok.body.document.id;
    assert.equal((await upload(state.token, state.caseId, STATEMENT, 'again.csv')).body.error.code, 'DUPLICATE_DOCUMENT');

    const [{ id: userId }] = await query('SELECT id FROM users WHERE email = :email', { email: emails[0] });
    const [{ storage_path: stored }] = await query('SELECT storage_path FROM documents WHERE id = :id', { id: state.documentId });
    const onDisk = await readFile(path.join(env.uploadDir, stored));
    assert.ok(stored.startsWith(String(userId)));
    assert.ok(!onDisk.includes('SALARY'), 'file content must not be readable on disk');
    assert.equal(onDisk.subarray(0, 4).toString(), 'FNR1');
  });

  it('serves documents only through short-lived links that cannot double as login tokens', async () => {
    const link = await call('POST', `/api/documents/${state.documentId}/link`, { token: state.token });
    assert.equal(link.status, 200);
    const file = await call('GET', link.body.url, { raw: true });
    assert.equal(file.status, 200);
    assert.equal(file.body, STATEMENT);

    const linkToken = new URL(link.body.url, base).searchParams.get('t');
    assert.equal((await call('GET', '/api/cases', { token: linkToken })).status, 401);
    assert.equal((await call('GET', '/api/documents/file?t=garbage.token.value')).status, 401);
  });

  it('reads the statement, classifies it and queues unknown income for review', async () => {
    const processed = await call('POST', `/api/documents/${state.documentId}/process`, { token: state.token });
    assert.equal(processed.status, 200);
    assert.equal(processed.body.result.transactions, 5);

    const list = await call('GET', `/api/cases/${state.caseId}/transactions?pageSize=50`, { token: state.token });
    const byText = (needle) => list.body.items.find((t) => t.description.includes(needle));
    assert.equal(byText('SALARY').category.code, 'salary');
    assert.equal(byText('INT.PD').category.code, 'interest');
    assert.equal(byText('RAHUL').category.code, 'unknown');
    assert.equal(byText('RAHUL').needsReview, true);
    state.unknownId = byText('RAHUL').id;

    assert.equal((await call('PATCH', `/api/transactions/${state.unknownId}`, { token: state.token, json: { action: 'confirm' } })).status, 400);
    const fixed = await call('PATCH', `/api/transactions/${state.unknownId}`, { token: state.token, json: { action: 'categorize', categoryCode: 'refund_reversal' } });
    assert.equal(fixed.status, 200);
    await call('POST', `/api/cases/${state.caseId}/transactions/confirm-high-confidence`, { token: state.token });

    const ledger = await call('GET', `/api/cases/${state.caseId}/ledger`, { token: state.token });
    assert.equal(ledger.body.ledger.review.needsReview, 0);
  });

  it('keeps a return blocked until tax is calculated, differences are resolved and a regime is chosen', async () => {
    const early = await call('GET', `/api/cases/${state.caseId}/itr`, { token: state.token });
    assert.equal(early.body.canApprove, false);
    assert.ok(early.body.validation.errors.some((e) => e.code === 'no_calculation'));

    const answers = Object.fromEntries(['business_income', 'capital_gains', 'house_property', 'foreign', 'director', 'agriculture', 'losses'].map((k) => [k, 'no']));
    assert.equal((await call('PUT', `/api/cases/${state.caseId}/eligibility`, { token: state.token, json: { answers } })).body.supported, true);
    await call('PUT', `/api/cases/${state.caseId}/tax-facts/form16`, { token: state.token, json: { values: { gross_salary: 1150000, tds_salary: 120000 } } });
    await call('PUT', `/api/cases/${state.caseId}/tax-facts/ais`, { token: state.token, json: { values: { ais_interest: 412.35 } } });
    await call('PUT', `/api/cases/${state.caseId}/tax-facts/form26as`, { token: state.token, json: { values: { tds_total_26as: 120000 } } });

    const calc = await call('POST', `/api/cases/${state.caseId}/tax-calculation`, { token: state.token });
    assert.equal(calc.status, 201);
    assert.equal(calc.body.calculation.recommended, 'new');
    assert.equal(calc.body.calculation.regimes.new.steps.at(-1).key, 'net_payable');

    const blocked = await call('GET', `/api/cases/${state.caseId}/itr`, { token: state.token });
    const codes = blocked.body.validation.errors.map((e) => e.code);
    assert.ok(codes.includes('no_regime'));
    assert.ok(codes.includes('open_reconciliation')); // bank salary is far below Form 16 gross

    await call('PUT', `/api/cases/${state.caseId}/tax-regime`, { token: state.token, json: { regime: 'new' } });
    const recon = await call('GET', `/api/cases/${state.caseId}/reconciliation`, { token: state.token });
    for (const item of recon.body.items.filter((i) => ['mismatch', 'missing'].includes(i.status))) {
      assert.equal((await call('PATCH', `/api/reconciliation/${item.id}`, { token: state.token, json: { action: 'resolve' } })).status, 400, 'a note is required');
      assert.equal((await call('PATCH', `/api/reconciliation/${item.id}`, { token: state.token, json: { action: 'resolve', note: 'Other account not uploaded' } })).status, 204);
    }
  });

  it('approves, exports and then withdraws approval when figures change', async () => {
    const ready = await call('GET', `/api/cases/${state.caseId}/itr`, { token: state.token });
    assert.equal(ready.body.status, 'ready', JSON.stringify(ready.body.validation.errors));
    assert.equal(ready.body.canApprove, true);

    const partial = await call('POST', `/api/cases/${state.caseId}/itr/approve`, { token: state.token, json: { confirmations: ['details_correct'] } });
    assert.equal(partial.body.error.code, 'CONFIRMATION_REQUIRED');
    assert.equal((await call('GET', `/api/cases/${state.caseId}/itr/export`, { token: state.token })).status, 409);

    const keys = ready.body.confirmations.map((c) => c.key);
    const beforeApproval = await call('GET', `/api/cases/${state.caseId}/filing`, { token: state.token });
    assert.equal(beforeApproval.body.readiness.score, 90, 'everything but approval is done');
    assert.equal(beforeApproval.body.next.key, 'return');
    assert.equal(beforeApproval.body.insights.advanceTax.refund, true);
    assert.equal(beforeApproval.body.insights.noticeRisk.level, 'low');

    const approved = await call('POST', `/api/cases/${state.caseId}/itr/approve`, { token: state.token, json: { confirmations: keys } });
    assert.equal(approved.body.status, 'approved');
    assert.equal((await call('GET', `/api/cases/${state.caseId}/filing`, { token: state.token })).body.readiness.score, 100);

    const exported = await call('GET', `/api/cases/${state.caseId}/itr/export`, { token: state.token });
    assert.equal(exported.status, 200);
    assert.equal(exported.body.meta.official, false);
    assert.equal(exported.body.taxpayer.pan, 'ABCPE1234F');
    assert.match(exported.headers.get('content-disposition'), /attachment/);

    await call('PUT', `/api/cases/${state.caseId}/tax-facts/ais`, { token: state.token, json: { values: { ais_interest: 9999 } } });
    const after = await call('GET', `/api/cases/${state.caseId}/itr`, { token: state.token });
    assert.equal(after.body.status, 'needs_review');
    assert.equal(after.body.approvalRevoked, true);
    const reopened = await call('GET', `/api/cases/${state.caseId}/filing`, { token: state.token });
    assert.ok(reopened.body.readiness.score < 100);
    assert.ok(reopened.body.readiness.blocking > 0);
    assert.equal(reopened.body.next.key, 'reconcile', 'the new interest difference must be resolved first');
    assert.equal((await call('GET', `/api/cases/${state.caseId}/itr/export`, { token: state.token })).status, 409);
  });

  it('keeps every taxpayer’s data private', async () => {
    const other = await register('Other Person');
    const paths = [
      ['GET', `/api/cases/${state.caseId}`], ['GET', `/api/cases/${state.caseId}/documents`], ['GET', `/api/cases/${state.caseId}/transactions`],
      ['GET', `/api/cases/${state.caseId}/ledger`], ['GET', `/api/cases/${state.caseId}/reconciliation`], ['GET', `/api/cases/${state.caseId}/tax-calculation`],
      ['GET', `/api/cases/${state.caseId}/itr`], ['GET', `/api/cases/${state.caseId}/filing`], ['GET', `/api/cases/${state.caseId}/itr/export`], ['POST', `/api/documents/${state.documentId}/link`],
      ['POST', `/api/documents/${state.documentId}/process`], ['DELETE', `/api/documents/${state.documentId}`], ['PATCH', `/api/transactions/${state.unknownId}`],
    ];
    for (const [method, url] of paths) {
      const res = await call(method, url, { token: other.token, json: method === 'PATCH' ? { action: 'ignore' } : undefined });
      assert.equal(res.status, 404, `${method} ${url} leaked (${res.status})`);
    }
    assert.equal((await call('GET', '/api/cases', { token: other.token })).body.cases.length, 0);
  });

  it('rejects bad credentials generically and locks the account after repeated failures', async () => {
    const victim = await register('Lock Tester');
    const attempt = () => call('POST', '/api/auth/login', { json: { identifier: victim.email, password: 'wrong-password1' } });
    const unknown = await call('POST', '/api/auth/login', { json: { identifier: 'nobody@example.com', password: 'wrong-password1' } });
    const first = await attempt();
    assert.equal(first.status, 401);
    assert.equal(first.body.error.message, unknown.body.error.message, 'must not reveal whether the account exists');

    for (let i = 0; i < 4; i++) await attempt();
    assert.equal((await attempt()).status, 423);
    const good = await call('POST', '/api/auth/login', { json: { identifier: victim.email, password: 'abc12345' } });
    assert.equal(good.status, 423, 'correct password is also refused while locked');
  });
});
