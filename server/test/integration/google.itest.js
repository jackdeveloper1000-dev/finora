// Google sign-in with Google's verification stubbed: account creation, linking by email, two-factor and rejection.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { after, before, describe, it } from 'node:test';
import { verifyEmail } from './helpers.js';
import { createApp } from '../../src/app.js';
import { pool, query } from '../../src/config/db.js';
import { env } from '../../src/config/env.js';
import { totpCode } from '../../src/utils/totp.js';

let dbUp = true;
try {
  await pool.query('SELECT 1');
} catch {
  dbUp = false;
}

describe('google sign-in', { skip: dbUp ? false : 'MySQL is not reachable' }, () => {
  let server;
  let base;
  let payload;
  const original = OAuth2Client.prototype.verifyIdToken;
  const tag = randomUUID().slice(0, 8);
  const email = `gg-${tag}@example.com`;
  const sub = `sub${tag}`;
  const CREDENTIAL = 'x'.repeat(40);

  const call = async (method, url, json, token) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${base}${url}`, { method, headers, body: json && JSON.stringify(json) });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };

  before(() => {
    env.google.clientId ||= 'test-client-id';
    OAuth2Client.prototype.verifyIdToken = async ({ idToken }) => {
      if (idToken === 'bad'.padEnd(40, '!')) throw new Error('bad token');
      return { getPayload: () => payload };
    };
    server = createApp().listen(0);
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    OAuth2Client.prototype.verifyIdToken = original;
    server?.close();
    const [user] = await query('SELECT id FROM users WHERE email = :email', { email });
    if (user) {
      await query('DELETE FROM audit_events WHERE user_id = :id', { id: user.id });
      await query('DELETE FROM users WHERE id = :id', { id: user.id });
    }
    await pool.end();
  });

  it('exposes only the public client id', async () => {
    const res = await call('GET', '/api/auth/config');
    assert.equal(res.status, 200);
    assert.deepEqual(Object.keys(res.body), ['googleClientId']);
  });

  it('creates an account on first sign-in and recognises it afterwards', async () => {
    payload = { sub, email, email_verified: true, name: 'Gita Google' };
    const first = await call('POST', '/api/auth/google', { credential: CREDENTIAL });
    assert.equal(first.status, 201);
    assert.equal(first.body.user.email, email);
    assert.equal(first.body.user.role, 'customer');
    assert.ok(first.body.accessToken);

    const again = await call('POST', '/api/auth/google', { credential: CREDENTIAL });
    assert.equal(again.status, 200);
    assert.equal(again.body.user.id, first.body.user.id);
    assert.equal((await call('POST', '/api/auth/login', { identifier: email, password: 'anything123' })).status, 401, 'no password login without a password');
    state.token = first.body.accessToken;
  });

  it('rejects tokens Google would not vouch for', async () => {
    assert.equal((await call('POST', '/api/auth/google', { credential: 'bad'.padEnd(40, '!') })).body.error.code, 'GOOGLE_INVALID');
    payload = { sub: 'other', email: `un-${tag}@example.com`, email_verified: false, name: 'Unverified' };
    assert.equal((await call('POST', '/api/auth/google', { credential: CREDENTIAL })).status, 401);
    assert.equal((await call('POST', '/api/auth/google', { credential: 'short' })).status, 400);
  });

  it('still asks for the second factor when two-factor is on', async () => {
    const setup = await call('POST', '/api/auth/mfa/setup', null, state.token);
    await call('POST', '/api/auth/mfa/enable', { code: totpCode(setup.body.secret) }, state.token);

    payload = { sub, email, email_verified: true, name: 'Gita Google' };
    const login = await call('POST', '/api/auth/google', { credential: CREDENTIAL });
    assert.equal(login.body.mfaRequired, true);
    assert.equal(login.body.accessToken, undefined);
    const done = await call('POST', '/api/auth/mfa/verify', { mfaToken: login.body.mfaToken, code: totpCode(setup.body.secret) });
    assert.equal(done.status, 200);
  });

  it('links to an existing password account with the same verified email', async () => {
    const other = `gl-${tag}@example.com`;
    await call('POST', '/api/auth/register', { name: 'Linked User', email: other, password: 'abc12345' });
    const reg = await verifyEmail(base, other);
    payload = { sub: `link${tag}`, email: other, email_verified: true, name: 'Linked G' };
    const res = await call('POST', '/api/auth/google', { credential: CREDENTIAL });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.id, reg.body.user.id);
    assert.equal((await call('POST', '/api/auth/login', { identifier: other, password: 'abc12345' })).status, 200, 'password still works');
    const [user] = await query('SELECT id FROM users WHERE email = :email', { email: other });
    await query('DELETE FROM audit_events WHERE user_id = :id', { id: user.id });
    await query('DELETE FROM users WHERE id = :id', { id: user.id });
  });
});

const state = {};
