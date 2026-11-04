// Forgot-password flow: single-use links, session revocation and no account enumeration.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { verifyEmail } from './helpers.js';
import { createApp } from '../../src/app.js';
import { pool, query } from '../../src/config/db.js';
import { outbox } from '../../src/utils/mailer.js';

let dbUp = true;
try {
  await pool.query('SELECT 1');
} catch {
  dbUp = false;
}

describe('password reset', { skip: dbUp ? false : 'MySQL is not reachable' }, () => {
  let server;
  let base;
  const email = `pr-${randomUUID().slice(0, 8)}@example.com`;

  const call = async (method, url, json, cookie) => {
    const headers = { 'Content-Type': 'application/json' };
    if (cookie) headers.Cookie = cookie;
    const res = await fetch(`${base}${url}`, { method, headers, body: json && JSON.stringify(json) });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null, cookie: /finora_rt=([^;]+)/.exec(res.headers.get('set-cookie') ?? '')?.[0] };
  };
  const tokenFromMail = () => /token=([\w-]+)/.exec(outbox.at(-1).text)[1];

  before(() => {
    server = createApp().listen(0);
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    server?.close();
    const [user] = await query('SELECT id FROM users WHERE email = :email', { email });
    if (user) {
      await query('DELETE FROM audit_events WHERE user_id = :id', { id: user.id });
      await query('DELETE FROM users WHERE id = :id', { id: user.id });
    }
    await pool.end();
  });

  it('answers the same way whether or not the account exists', async () => {
    const before = outbox.length;
    assert.equal((await call('POST', '/api/auth/forgot-password', { email: 'nobody-here@example.com' })).status, 204);
    assert.equal(outbox.length, before, 'no email for unknown addresses');
    assert.equal((await call('POST', '/api/auth/forgot-password', { email: 'not-an-email' })).status, 400);
  });

  it('resets the password once, signs out other sessions and unlocks the account', async () => {
    assert.equal((await call('POST', '/api/auth/register', { name: 'Reset Tester', email, password: 'oldpass123' })).status, 201);
    const reg = await verifyEmail(base, email);

    await call('POST', '/api/auth/forgot-password', { email });
    const token = tokenFromMail();
    assert.equal((await call('POST', '/api/auth/reset-password', { token, password: 'short' })).status, 400);
    assert.equal((await call('POST', '/api/auth/reset-password', { token: 'x'.repeat(43), password: 'newpass123' })).body.error.code, 'RESET_LINK_INVALID');

    assert.equal((await call('POST', '/api/auth/reset-password', { token, password: 'newpass123' })).status, 204);
    assert.equal((await call('POST', '/api/auth/reset-password', { token, password: 'another123' })).body.error.code, 'RESET_LINK_INVALID', 'a link works once');

    assert.equal((await call('POST', '/api/auth/refresh', null, reg.cookie)).status, 401, 'old sessions are signed out');
    assert.equal((await call('POST', '/api/auth/login', { identifier: email, password: 'oldpass123' })).status, 401);
    assert.equal((await call('POST', '/api/auth/login', { identifier: email, password: 'newpass123' })).status, 200);
  });

  it('only honours the newest link', async () => {
    await call('POST', '/api/auth/forgot-password', { email });
    const first = tokenFromMail();
    await call('POST', '/api/auth/forgot-password', { email });
    const second = tokenFromMail();
    assert.equal((await call('POST', '/api/auth/reset-password', { token: first, password: 'newpass456' })).status, 400);
    assert.equal((await call('POST', '/api/auth/reset-password', { token: second, password: 'newpass456' })).status, 204);
  });

  it('rejects an expired link', async () => {
    await call('POST', '/api/auth/forgot-password', { email });
    const token = tokenFromMail();
    await query('UPDATE password_resets SET expires_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE used_at IS NULL');
    assert.equal((await call('POST', '/api/auth/reset-password', { token, password: 'newpass789' })).body.error.code, 'RESET_LINK_INVALID');
  });
});
