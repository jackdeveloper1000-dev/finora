// Email verification: no session until the emailed code is confirmed.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createApp } from '../../src/app.js';
import { pool, query } from '../../src/config/db.js';
import { outbox } from '../../src/utils/mailer.js';

let dbUp = true;
try {
  await pool.query('SELECT 1');
} catch {
  dbUp = false;
}

describe('email verification', { skip: dbUp ? false : 'MySQL is not reachable' }, () => {
  let server;
  let base;
  const email = `ev-${randomUUID().slice(0, 8)}@example.com`;
  const NAME = 'Vera <b>Fy</b>';

  const call = async (method, url, json) => {
    const res = await fetch(`${base}${url}`, { method, headers: { 'Content-Type': 'application/json' }, body: json && JSON.stringify(json) });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
  const lastMail = () => [...outbox].reverse().find((m) => m.to === email);
  const lastCode = () => /^(\d{6})/.exec(lastMail().subject)[1];
  const wrongCode = () => (lastCode() === '000000' ? '111111' : '000000');
  const expireCooldown = () => query("UPDATE email_verifications SET created_at = DATE_SUB(NOW(), INTERVAL 2 MINUTE) WHERE user_id = (SELECT id FROM users WHERE email = :email)", { email });

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

  it('registers without signing in and emails a branded code', async () => {
    const res = await call('POST', '/api/auth/register', { name: NAME, email, password: 'abc12345' });
    assert.equal(res.status, 201);
    assert.deepEqual(res.body, { verificationRequired: true, email });

    const mail = lastMail();
    assert.match(mail.subject, /^\d{6} is your Finora verification code$/);
    assert.ok(mail.html.includes(lastCode()), 'the code is in the HTML body');
    assert.ok(mail.html.includes('Vera &lt;b&gt;Fy&lt;/b&gt;'), 'the name is escaped');
    assert.ok(!mail.html.includes('<b>Fy</b>'));
    const [row] = await query('SELECT code_hash FROM email_verifications ORDER BY id DESC LIMIT 1');
    assert.ok(!row.code_hash.includes(lastCode()) && row.code_hash.length === 64, 'only a hash is stored');
  });

  it('refuses sign-in until the email is verified', async () => {
    const login = await call('POST', '/api/auth/login', { identifier: email, password: 'abc12345' });
    assert.equal(login.status, 403);
    assert.equal(login.body.error.code, 'EMAIL_NOT_VERIFIED');
    assert.equal(login.body.error.details.email, email);
    assert.equal(login.body.accessToken, undefined);
    assert.equal((await call('POST', '/api/auth/login', { identifier: email, password: 'wrong-pass1' })).status, 401, 'a wrong password is still just a wrong password');
  });

  it('rejects wrong codes and locks the code after five attempts', async () => {
    assert.equal((await call('POST', '/api/auth/verify-email', { email, code: 'abc' })).status, 400);
    for (let i = 0; i < 5; i += 1) {
      assert.equal((await call('POST', '/api/auth/verify-email', { email, code: wrongCode() })).body.error.code, 'INVALID_CODE');
    }
    const locked = await call('POST', '/api/auth/verify-email', { email, code: lastCode() });
    assert.equal(locked.body.error.code, 'CODE_EXPIRED', 'even the right code is refused after too many tries');
  });

  it('sends a new code on request, no more than once a minute', async () => {
    const before = outbox.length;
    await call('POST', '/api/auth/resend-code', { email });
    assert.equal(outbox.length, before, 'nothing is sent within a minute of the last code');

    await expireCooldown();
    assert.equal((await call('POST', '/api/auth/resend-code', { email })).status, 204);
    assert.ok(outbox.length > before, 'a new code goes out after the cooldown');
    const count = outbox.length;
    await call('POST', '/api/auth/resend-code', { email });
    assert.equal(outbox.length, count, 'a second request within a minute sends nothing');
    assert.equal((await call('POST', '/api/auth/resend-code', { email: 'nobody@example.com' })).status, 204, 'unknown addresses look the same');
  });

  it('rejects an expired code', async () => {
    await query("UPDATE email_verifications SET expires_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE used_at IS NULL AND user_id = (SELECT id FROM users WHERE email = :email)", { email });
    assert.equal((await call('POST', '/api/auth/verify-email', { email, code: lastCode() })).body.error.code, 'CODE_EXPIRED');
    await expireCooldown();
    await call('POST', '/api/auth/resend-code', { email });
  });

  it('signs in with the right code, once', async () => {
    const code = lastCode();
    const done = await call('POST', '/api/auth/verify-email', { email, code });
    assert.equal(done.status, 200);
    assert.ok(done.body.accessToken);
    assert.equal(done.body.user.email, email);

    assert.equal((await call('POST', '/api/auth/verify-email', { email, code })).status, 400, 'a code works once');
    assert.equal((await call('POST', '/api/auth/login', { identifier: email, password: 'abc12345' })).status, 200, 'normal sign-in works afterwards');
  });
});
