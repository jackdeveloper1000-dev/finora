// Account features end to end: two-factor sign-in, password and sessions, notifications, export, erase and history.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { access, rm } from 'node:fs/promises';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { verifyEmail } from './helpers.js';
import { createApp } from '../../src/app.js';
import { pool, query } from '../../src/config/db.js';
import { env } from '../../src/config/env.js';
import { totpCode } from '../../src/utils/totp.js';

const STATEMENT = ['Date,Narration,Withdrawal Amt.,Deposit Amt.', '01/04/25,NEFT-ACME-SALARY,,85000.00', '09/06/25,UPI-SWIGGY-FOOD,640.50,'].join('\n');

let dbUp = true;
try {
  await pool.query('SELECT 1');
} catch {
  dbUp = false;
}

describe('account features', { skip: dbUp ? false : 'MySQL is not reachable' }, () => {
  let server;
  let base;
  const emails = [];
  const state = {};

  const call = async (method, url, { token, cookie, json, form, raw } = {}) => {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (cookie) headers.Cookie = cookie;
    if (json) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${base}${url}`, { method, headers, body: json ? JSON.stringify(json) : form });
    const text = await res.text();
    const refresh = /finora_rt=([^;]+)/.exec(res.headers.get('set-cookie') ?? '')?.[1];
    return { status: res.status, body: raw ? text : text ? JSON.parse(text) : null, headers: res.headers, cookie: refresh && `finora_rt=${refresh}` };
  };

  const register = async (name) => {
    const email = `ac-${randomUUID().slice(0, 8)}@example.com`;
    emails.push(email);
    const res = await call('POST', '/api/auth/register', { json: { name, email, password: 'abc12345' } });
    assert.equal(res.status, 201);
    const verified = await verifyEmail(base, email);
    return { email, token: verified.body.accessToken, cookie: verified.cookie };
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

  it('turns on two-factor sign-in and requires the second step at login', async () => {
    const me = await register('Mfa Tester');
    Object.assign(state, me);

    const setup = await call('POST', '/api/auth/mfa/setup', { token: me.token });
    assert.equal(setup.status, 200);
    assert.match(setup.body.qr, /^data:image\/png;base64,/);
    state.secret = setup.body.secret;

    assert.equal((await call('POST', '/api/auth/mfa/enable', { token: me.token, json: { code: '000000' } })).body.error.code, 'INVALID_CODE');
    const enabled = await call('POST', '/api/auth/mfa/enable', { token: me.token, json: { code: totpCode(state.secret) } });
    assert.equal(enabled.status, 200);
    assert.equal(enabled.body.backupCodes.length, 8);
    state.backup = enabled.body.backupCodes;

    const login = await call('POST', '/api/auth/login', { json: { identifier: me.email, password: 'abc12345' } });
    assert.equal(login.body.mfaRequired, true);
    assert.equal(login.body.accessToken, undefined, 'no session until the second step');
    assert.equal(login.cookie, undefined);
    assert.equal((await call('GET', '/api/cases', { token: login.body.mfaToken })).status, 401, 'an MFA token is not an access token');

    assert.equal((await call('POST', '/api/auth/mfa/verify', { json: { mfaToken: login.body.mfaToken, code: '123456' } })).body.error.code, 'INVALID_CODE');
    const done = await call('POST', '/api/auth/mfa/verify', { json: { mfaToken: login.body.mfaToken, code: totpCode(state.secret) } });
    assert.equal(done.status, 200);
    assert.ok(done.body.accessToken);
    state.token = done.body.accessToken;
    state.cookie = done.cookie;
  });

  it('accepts each backup code once', async () => {
    const attempt = async (code) => {
      const login = await call('POST', '/api/auth/login', { json: { identifier: state.email, password: 'abc12345' } });
      return call('POST', '/api/auth/mfa/verify', { json: { mfaToken: login.body.mfaToken, code } });
    };
    assert.equal((await attempt(state.backup[0])).status, 200);
    assert.equal((await attempt(state.backup[0])).status, 401, 'a used backup code stops working');
    assert.equal((await attempt(state.backup[1].toUpperCase())).status, 200, 'codes are case-insensitive');
  });

  it('changes the password, ends other sessions and keeps this one', async () => {
    const other = await call('POST', '/api/auth/login', { json: { identifier: state.email, password: 'abc12345' } });
    const second = await call('POST', '/api/auth/mfa/verify', { json: { mfaToken: other.body.mfaToken, code: totpCode(state.secret, Date.now() + 30_000) } });
    assert.equal(second.status, 200, JSON.stringify(second.body));

    const sessions = await call('GET', '/api/auth/sessions', { token: state.token, cookie: state.cookie });
    assert.ok(sessions.body.sessions.length >= 2);
    assert.equal(sessions.body.sessions.filter((s) => s.current).length, 1);

    assert.equal((await call('POST', '/api/auth/password', { token: state.token, cookie: state.cookie, json: { currentPassword: 'wrong-pass1', newPassword: 'newpass123' } })).body.error.code, 'INVALID_PASSWORD');
    assert.equal((await call('POST', '/api/auth/password', { token: state.token, cookie: state.cookie, json: { currentPassword: 'abc12345', newPassword: 'short' } })).status, 400);
    assert.equal((await call('POST', '/api/auth/password', { token: state.token, cookie: state.cookie, json: { currentPassword: 'abc12345', newPassword: 'newpass123' } })).status, 204);

    assert.equal((await call('POST', '/api/auth/refresh', { cookie: second.cookie })).status, 401, 'the other session is signed out');
    assert.equal((await call('POST', '/api/auth/refresh', { cookie: state.cookie })).status, 200, 'this session stays');
    state.password = 'newpass123';
  });

  it('keeps a deliberately signed-out session signed out, without ending the others', async () => {
    const a = await register('Session Tester');
    const login = await call('POST', '/api/auth/login', { json: { identifier: a.email, password: 'abc12345' } });
    assert.equal((await call('POST', '/api/auth/logout', { cookie: login.cookie })).status, 204);
    const replay = await call('POST', '/api/auth/refresh', { cookie: login.cookie });
    assert.equal(replay.status, 401, 'no grace period for a session that was signed out on purpose');
    assert.equal((await call('POST', '/api/auth/refresh', { cookie: a.cookie })).status, 200, 'other sessions are not affected');
  });

  it('turns two-factor off with the password and a code', async () => {
    assert.equal((await call('POST', '/api/auth/mfa/disable', { token: state.token, json: { password: 'wrong-pass1', code: totpCode(state.secret) } })).status, 403);
    assert.equal((await call('POST', '/api/auth/mfa/disable', { token: state.token, json: { password: state.password, code: totpCode(state.secret) } })).status, 204);
    const login = await call('POST', '/api/auth/login', { json: { identifier: state.email, password: state.password } });
    assert.ok(login.body.accessToken, 'plain password login works again');
    state.token = login.body.accessToken;
  });

  it('delivers notifications and honours preferences', async () => {
    await call('PUT', '/api/profile', { token: state.token, json: { fullName: 'Mfa Tester', pan: 'ABCPE1234F', dob: '1992-04-18', residentialStatus: 'resident', occupation: 'salaried', address: 'Pune' } });
    const created = await call('POST', '/api/cases', { token: state.token, json: { assessmentYear: '2026-27' } });
    state.caseId = created.body.case.id;

    const upload = (name, content) => {
      const form = new FormData();
      form.append('docType', 'bank_statement');
      form.append('file', new Blob([content], { type: 'text/csv' }), name);
      return call('POST', `/api/cases/${state.caseId}/documents`, { token: state.token, form });
    };
    const first = await upload('one.csv', STATEMENT);
    await call('POST', `/api/documents/${first.body.document.id}/process`, { token: state.token });

    const inbox = await call('GET', '/api/notifications', { token: state.token });
    assert.equal(inbox.body.unread, 1);
    assert.match(inbox.body.notifications[0].title, /one\.csv was processed/);
    assert.equal((await call('GET', '/api/notifications/unread-count', { token: state.token })).body.unread, 1);

    await call('PATCH', `/api/notifications/${inbox.body.notifications[0].id}/read`, { token: state.token });
    assert.equal((await call('GET', '/api/notifications/unread-count', { token: state.token })).body.unread, 0);

    assert.equal((await call('PUT', '/api/account/preferences', { token: state.token, json: { notifyProcessed: false } })).body.preferences.notifyProcessed, false);
    const second = await upload('two.csv', `${STATEMENT}\n10/06/25,UPI-ZOMATO,100.00,`);
    await call('POST', `/api/documents/${second.body.document.id}/process`, { token: state.token });
    assert.equal((await call('GET', '/api/notifications/unread-count', { token: state.token })).body.unread, 0, 'switched-off alerts are not created');

    assert.equal((await call('POST', '/api/notifications/read-all', { token: state.token })).status, 204);
  });

  it('shows history and deletes a single return with its files', async () => {
    const history = await call('GET', '/api/history', { token: state.token });
    assert.equal(history.body.returns.length, 1);
    assert.equal(history.body.returns[0].assessmentYear, '2026-27');

    const folder = path.join(env.uploadDir, String(await userId(state.email)), String(state.caseId));
    await access(folder);
    assert.equal((await call('DELETE', `/api/cases/${state.caseId}`, { token: state.token })).status, 204);
    await assert.rejects(access(folder), 'uploaded files are removed with the return');
    assert.equal((await call('GET', '/api/history', { token: state.token })).body.returns.length, 0);

    const stranger = await register('Stranger');
    assert.equal((await call('DELETE', `/api/cases/${state.caseId}`, { token: stranger.token })).status, 404);
  });

  it('exports everything held about the user', async () => {
    await call('POST', '/api/cases', { token: state.token, json: { assessmentYear: '2025-26' } });
    const exported = await call('GET', '/api/account/export', { token: state.token });
    assert.equal(exported.status, 200);
    assert.match(exported.headers.get('content-disposition'), /attachment; filename="finora-my-data\.json"/);
    assert.equal(exported.body.account.email, state.email);
    assert.equal(exported.body.account.passwordHash, undefined, 'password hashes never leave the server');
    assert.equal(exported.body.taxpayerProfile.pan, 'ABCPE1234F');
    assert.equal(exported.body.returns.length, 1);
    assert.ok(exported.body.activity.some((a) => a.action === 'account_export'));
  });

  it('erases data only with the password: clear data keeps the account, delete removes it', async () => {
    assert.equal((await call('POST', '/api/account/clear-data', { token: state.token, json: { password: 'wrong-pass1' } })).status, 403);
    assert.equal((await call('POST', '/api/account/clear-data', { token: state.token, json: { password: state.password } })).status, 204);
    assert.equal((await call('GET', '/api/cases', { token: state.token })).body.cases.length, 0);
    assert.equal((await call('GET', '/api/profile', { token: state.token })).body.profile.fullName, 'Mfa Tester', 'the profile is kept');

    assert.equal((await call('POST', '/api/account/delete', { token: state.token, json: { password: 'wrong-pass1' } })).status, 403);
    assert.equal((await call('POST', '/api/account/delete', { token: state.token, json: { password: state.password } })).status, 204);
    const [left] = await query('SELECT id FROM users WHERE email = :email', { email: state.email });
    assert.equal(left, undefined, 'the account is gone');
    assert.equal((await call('POST', '/api/auth/login', { json: { identifier: state.email, password: state.password } })).status, 401);
  });
});

async function userId(email) {
  const [row] = await query('SELECT id FROM users WHERE email = :email', { email });
  return row.id;
}
