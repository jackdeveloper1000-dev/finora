// Expert review: request, claim, discuss, decide, plus the access rules around experts.
// Cleans up every user and file it creates. Run with: npm run test:integration (MySQL must be running).
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { verifyEmail } from './helpers.js';
import { createApp } from '../../src/app.js';
import { pool, query } from '../../src/config/db.js';
import { env } from '../../src/config/env.js';
import { ensureRulesets } from '../../src/modules/tax/rulesets.js';
import { totpCode } from '../../src/utils/totp.js';

const STATEMENT = [
  'Date,Narration,Withdrawal Amt.,Deposit Amt.',
  '01/04/25,NEFT-ACME TECHNOLOGIES-SALARY,,85000.00',
  '28/06/25,INT.PD:01-04-2025 TO 30-06-2025,,412.35',
  '09/06/25,UPI-SWIGGY-FOOD,640.50,',
].join('\n');

let dbUp = true;
try {
  await pool.query('SELECT 1');
  await ensureRulesets();
} catch {
  dbUp = false;
}

describe('expert review', { skip: dbUp ? false : 'MySQL is not reachable' }, () => {
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

  const newEmail = () => {
    const email = `rv-${randomUUID().slice(0, 8)}@example.com`;
    emails.push(email);
    return email;
  };

  const createStaff = async (role) => {
    const email = newEmail();
    await query('INSERT INTO users (name, email, password_hash, role, is_verified, email_verified) VALUES (:name, :email, :hash, :role, 1, 1)', { name: `Test ${role}`, email, hash: await bcrypt.hash('abc12345', 4), role });
    const login = await call('POST', '/api/auth/login', { json: { identifier: email, password: 'abc12345' } });
    return { email, token: login.body.accessToken };
  };

  const enableMfa = async (token) => {
    const { body } = await call('POST', '/api/auth/mfa/setup', { token });
    await call('POST', '/api/auth/mfa/enable', { token, json: { code: totpCode(body.secret) } });
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

  it('sets up a customer with a calculated return', async () => {
    const email = newEmail();
    const reg = await call('POST', '/api/auth/register', { json: { name: 'Review Customer', email, password: 'abc12345' } });
    s.customer = (await verifyEmail(base, email)).body.accessToken;
    const t = s.customer;
    await call('PUT', '/api/profile', { token: t, json: { fullName: 'Review Customer', pan: 'ABCPE1234F', dob: '1992-04-18', residentialStatus: 'resident', occupation: 'salaried', address: 'Pune' } });
    s.caseId = (await call('POST', '/api/cases', { token: t, json: { assessmentYear: '2026-27' } })).body.case.id;
    const form = new FormData();
    form.append('docType', 'bank_statement');
    form.append('file', new Blob([STATEMENT], { type: 'text/csv' }), 'statement.csv');
    const up = await call('POST', `/api/cases/${s.caseId}/documents`, { token: t, form });
    assert.equal(up.status, 201, JSON.stringify(up.body));
    await call('POST', `/api/documents/${up.body.document.id}/process`, { token: t });
    await call('POST', `/api/cases/${s.caseId}/transactions/confirm-high-confidence`, { token: t });
    const answers = Object.fromEntries(['business_income', 'capital_gains', 'house_property', 'foreign', 'director', 'agriculture', 'losses'].map((k) => [k, 'no']));
    await call('PUT', `/api/cases/${s.caseId}/eligibility`, { token: t, json: { answers } });
    await call('PUT', `/api/cases/${s.caseId}/tax-facts/form16`, { token: t, json: { values: { gross_salary: 85000, tds_salary: 0 } } });
    await call('PUT', `/api/cases/${s.caseId}/tax-facts/ais`, { token: t, json: { values: { ais_interest: 412.35 } } });
    await call('PUT', `/api/cases/${s.caseId}/tax-facts/form26as`, { token: t, json: { values: { tds_total_26as: 0 } } });
    assert.equal((await call('POST', `/api/cases/${s.caseId}/tax-calculation`, { token: t })).status, 201);
    await call('PUT', `/api/cases/${s.caseId}/tax-regime`, { token: t, json: { regime: 'new' } });
  });

  it('only accepts a review request once, and only for the owner', async () => {
    const first = await call('POST', `/api/cases/${s.caseId}/review`, { token: s.customer, json: { note: 'Please check my HRA' } });
    assert.equal(first.status, 201, JSON.stringify(first.body));
    assert.equal(first.body.review.status, 'requested');
    assert.equal((await call('POST', `/api/cases/${s.caseId}/review`, { token: s.customer, json: {} })).body.error.code, 'REVIEW_EXISTS');

    const strangerEmail = newEmail();
    await call('POST', '/api/auth/register', { json: { name: 'Other', email: strangerEmail, password: 'abc12345' } });
    const stranger = await verifyEmail(base, strangerEmail);
    assert.equal((await call('GET', `/api/cases/${s.caseId}/review`, { token: stranger.body.accessToken })).status, 404);
  });

  it('stops the customer approving while an expert is reviewing', async () => {
    const res = await call('POST', `/api/cases/${s.caseId}/itr/approve`, { token: s.customer, json: { confirmations: [] } });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'REVIEW_OPEN');
  });

  it('keeps customer data away from customers and from experts without two-factor sign-in', async () => {
    assert.equal((await call('GET', '/api/expert/reviews', { token: s.customer })).status, 403);
    assert.equal((await call('GET', '/api/expert/reviews')).status, 401);

    s.expert = await createStaff('expert');
    const blocked = await call('GET', '/api/expert/reviews', { token: s.expert.token });
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.error.code, 'MFA_REQUIRED');

    assert.equal((await call('POST', `/api/cases/${s.caseId}/review`, { token: s.expert.token, json: {} })).status, 403, 'experts are not customers');
    await enableMfa(s.expert.token);
  });

  it('lets a verified expert claim the review exactly once', async () => {
    const queue = await call('GET', '/api/expert/reviews', { token: s.expert.token });
    assert.equal(queue.status, 200);
    const mine = queue.body.reviews.find((r) => r.caseId === s.caseId);
    assert.ok(mine);
    s.reviewId = mine.id;

    const claimed = await call('POST', `/api/expert/reviews/${s.reviewId}/claim`, { token: s.expert.token });
    assert.equal(claimed.status, 200, JSON.stringify(claimed.body));
    assert.equal(claimed.body.review.status, 'in_review');
    assert.ok(claimed.body.return.sections.length > 0);
    assert.match(claimed.body.taxpayer.pan, /^XXXXXX/, 'the full PAN is never shown to experts');
    assert.equal(JSON.stringify(claimed.body).includes('ABCPE1234F'), false);

    s.other = await createStaff('expert');
    await enableMfa(s.other.token);
    assert.equal((await call('POST', `/api/expert/reviews/${s.reviewId}/claim`, { token: s.other.token })).body.error.code, 'REVIEW_TAKEN');
    assert.equal((await call('GET', `/api/expert/reviews/${s.reviewId}`, { token: s.other.token })).status, 403);
  });

  it('records the conversation and requires a reason when asking for changes', async () => {
    const asked = await call('POST', `/api/expert/reviews/${s.reviewId}/messages`, { token: s.expert.token, json: { body: 'Is the interest from a joint account?' } });
    assert.equal(asked.status, 201);
    const reply = await call('POST', `/api/cases/${s.caseId}/review/messages`, { token: s.customer, json: { body: 'No, it is mine alone.' } });
    assert.deepEqual(reply.body.messages.map((m) => m.role), ['expert', 'customer']);

    const noReason = await call('POST', `/api/expert/reviews/${s.reviewId}/decision`, { token: s.expert.token, json: { decision: 'changes_needed' } });
    assert.equal(noReason.status, 400);
    assert.equal(noReason.body.error.code, 'MESSAGE_REQUIRED');
  });

  it('hands the review back to the expert when the customer replies to a change request', async () => {
    const asked = await call('POST', `/api/expert/reviews/${s.reviewId}/decision`, { token: s.expert.token, json: { decision: 'changes_needed', message: 'Please add the savings interest.' } });
    assert.equal(asked.body.review.status, 'changes_needed');
    const reply = await call('POST', `/api/cases/${s.caseId}/review/messages`, { token: s.customer, json: { body: 'Added it.' } });
    assert.equal(reply.body.review.status, 'in_review');
  });

  it('approves, and marks the approval out of date when the figures change', async () => {
    const done = await call('POST', `/api/expert/reviews/${s.reviewId}/decision`, { token: s.expert.token, json: { decision: 'approved', message: 'Looks right.' } });
    assert.equal(done.status, 200, JSON.stringify(done.body));
    assert.equal(done.body.review.status, 'approved');
    assert.equal(done.body.changedSinceApproval, false);
    assert.equal((await call('POST', `/api/expert/reviews/${s.reviewId}/messages`, { token: s.expert.token, json: { body: 'late' } })).body.error.code, 'REVIEW_CLOSED');

    const seen = await call('GET', `/api/cases/${s.caseId}/review`, { token: s.customer });
    assert.equal(seen.body.review.status, 'approved');
    assert.equal(seen.body.current, true);

    await call('PUT', `/api/cases/${s.caseId}/tax-facts/ais`, { token: s.customer, json: { values: { ais_interest: 9999 } } });
    await call('POST', `/api/cases/${s.caseId}/tax-calculation`, { token: s.customer });
    assert.equal((await call('GET', `/api/cases/${s.caseId}/review`, { token: s.customer })).body.current, false, 'the approval no longer matches the return');
  });

  it('lets the customer cancel a waiting request and logs expert access', async () => {
    const second = await call('POST', `/api/cases/${s.caseId}/review`, { token: s.customer, json: {} });
    assert.equal(second.status, 201);
    const cancelled = await call('POST', `/api/cases/${s.caseId}/review/cancel`, { token: s.customer });
    assert.equal(cancelled.body.review.status, 'cancelled');

    const [{ total }] = await query("SELECT COUNT(*) AS total FROM audit_events WHERE case_id = :caseId AND action IN ('expert_view','review_claim','review_approved')", { caseId: s.caseId });
    assert.ok(Number(total) >= 3);
  });
});
