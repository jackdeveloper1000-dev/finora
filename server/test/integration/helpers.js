import { outbox } from '../../src/utils/mailer.js';

// Completes email verification the way a user would: read the code from the email, then submit it.
export const verifyEmail = async (base, email) => {
  const mail = [...outbox].reverse().find((m) => m.to === email && /verification code/.test(m.subject));
  const code = /^(\d{6})/.exec(mail?.subject ?? '')?.[1];
  const res = await fetch(`${base}/api/auth/verify-email`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, code }) });
  const body = await res.json();
  return { status: res.status, body, cookie: /finora_rt=([^;]+)/.exec(res.headers.get('set-cookie') ?? '')?.[0] };
};
