import { randomInt } from 'node:crypto';
import { query, queryOne } from '../../config/db.js';
import { AppError } from '../../utils/AppError.js';
import { recordAudit } from '../../utils/audit.js';
import { sha256 } from '../../utils/crypto.js';
import { verificationEmail } from '../../utils/emailTemplates.js';
import { sendMail } from '../../utils/mailer.js';
import { createSession } from './auth.service.js';

const CODE_MINUTES = 10;
const RESEND_SECONDS = 60;
const MAX_ATTEMPTS = 5;
const INVALID = 'That code is not correct.';

const hashCode = (userId, code) => sha256(`${userId}:${code}`);

// Sends a fresh code unless one went out in the last minute. Returns whether a message was sent.
export const issueCode = async (user) => {
  const recent = await queryOne(
    'SELECT id FROM email_verifications WHERE user_id = :id AND used_at IS NULL AND created_at > DATE_SUB(NOW(), INTERVAL :seconds SECOND) LIMIT 1',
    { id: user.id, seconds: RESEND_SECONDS },
  );
  if (recent) return false;

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await query('UPDATE email_verifications SET used_at = NOW() WHERE user_id = :id AND used_at IS NULL', { id: user.id });
  await query(
    'INSERT INTO email_verifications (user_id, code_hash, expires_at) VALUES (:id, :hash, DATE_ADD(NOW(), INTERVAL :minutes MINUTE))',
    { id: user.id, hash: hashCode(user.id, code), minutes: CODE_MINUTES },
  );
  await sendMail({ to: user.email, ...verificationEmail({ name: user.name, code, minutes: CODE_MINUTES }) });
  return true;
};

const findPendingUser = (email) => queryOne('SELECT * FROM users WHERE email = :email AND email_verified = 0 AND is_active = 1', { email });

// Same answer whether or not the address exists, so this cannot be used to look up accounts.
export const resendCode = async (email) => {
  const user = await findPendingUser(email);
  if (user) await issueCode(user);
};

export const verifyEmail = async ({ email, code }, meta) => {
  const user = await findPendingUser(email);
  const record = user && (await queryOne('SELECT *, expires_at < NOW() AS is_expired FROM email_verifications WHERE user_id = :id AND used_at IS NULL ORDER BY id DESC LIMIT 1', { id: user.id }));
  if (!record) throw AppError.badRequest(INVALID, 'INVALID_CODE');

  if (record.is_expired) throw AppError.badRequest('This code has expired. Request a new one.', 'CODE_EXPIRED');
  if (record.attempts >= MAX_ATTEMPTS) throw AppError.badRequest('Too many wrong attempts. Request a new code.', 'CODE_EXPIRED');

  if (record.code_hash !== hashCode(user.id, code)) {
    await query('UPDATE email_verifications SET attempts = attempts + 1 WHERE id = :id', { id: record.id });
    throw AppError.badRequest(INVALID, 'INVALID_CODE');
  }

  await query('UPDATE email_verifications SET used_at = NOW() WHERE id = :id', { id: record.id });
  await query('UPDATE users SET email_verified = 1, last_login_at = NOW(), last_login_ip = :ip WHERE id = :id', { id: user.id, ip: meta.ip || null });
  await recordAudit({ userId: user.id, action: 'email_verified', ip: meta.ip });
  return createSession({ ...user, email_verified: 1 }, meta);
};
