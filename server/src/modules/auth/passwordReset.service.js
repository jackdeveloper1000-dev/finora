import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { query, queryOne, transaction } from '../../config/db.js';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { recordAudit } from '../../utils/audit.js';
import { sha256 } from '../../utils/crypto.js';
import { resetEmail } from '../../utils/emailTemplates.js';
import { sendMail } from '../../utils/mailer.js';
import { revokeAllSessions } from './auth.service.js';

const TOKEN_MINUTES = 30;

// Always succeeds from the caller's point of view, so the form cannot be used to find out who has an account.
export const requestReset = async (email, ip) => {
  const user = await queryOne('SELECT id, name, is_active FROM users WHERE email = :email', { email });
  if (!user?.is_active) return;

  const token = randomBytes(32).toString('base64url');
  await query('UPDATE password_resets SET used_at = NOW() WHERE user_id = :id AND used_at IS NULL', { id: user.id });
  await query(
    'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (:id, :hash, DATE_ADD(NOW(), INTERVAL :minutes MINUTE))',
    { id: user.id, hash: sha256(token), minutes: TOKEN_MINUTES },
  );
  await recordAudit({ userId: user.id, action: 'password_reset_request', ip });
  await sendMail({ to: email, ...resetEmail({ name: user.name, token, minutes: TOKEN_MINUTES }) });
};

export const resetPassword = async (token, password, ip) => {
  const hash = sha256(token);
  const reset = await queryOne('SELECT id, user_id FROM password_resets WHERE token_hash = :hash AND used_at IS NULL AND expires_at > NOW()', { hash });
  if (!reset) throw AppError.badRequest('This reset link is invalid or has expired. Request a new one.', 'RESET_LINK_INVALID');

  const passwordHash = await bcrypt.hash(password, 12);
  const claimed = await transaction(async (run) => {
    const marked = await run('UPDATE password_resets SET used_at = NOW() WHERE id = :id AND used_at IS NULL', { id: reset.id });
    if (!marked.affectedRows) return false;
    await run('UPDATE users SET password_hash = :passwordHash, failed_otp_count = 0, locked_until = NULL WHERE id = :id', { passwordHash, id: reset.user_id });
    return true;
  });
  if (!claimed) throw AppError.badRequest('This reset link is invalid or has expired. Request a new one.', 'RESET_LINK_INVALID');

  await revokeAllSessions(reset.user_id);
  await recordAudit({ userId: reset.user_id, action: 'password_reset', ip });
};
