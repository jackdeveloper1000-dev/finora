import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import { randomBytes } from 'node:crypto';
import { env } from '../../config/env.js';
import { query, queryOne } from '../../config/db.js';
import { AppError } from '../../utils/AppError.js';
import { recordAudit } from '../../utils/audit.js';
import { decrypt, encrypt, sha256 } from '../../utils/crypto.js';
import { generateSecret, otpauthUrl, verifyTotp } from '../../utils/totp.js';
import { verifyPassword } from '../account/account.service.js';
import { createSession, recordFailedLogin } from './auth.service.js';

const MFA_TOKEN_TTL = '5m';
const BACKUP_CODE_COUNT = 8;

/* ---------- password & sessions ---------- */

export const changePassword = async (userId, currentRefreshToken, { currentPassword, newPassword }, ip) => {
  await verifyPassword(userId, currentPassword);
  if (currentPassword === newPassword) throw AppError.badRequest('Choose a password you have not used just now.', 'VALIDATION_ERROR', [{ field: 'newPassword', message: 'Must differ from the current password' }]);

  await query('UPDATE users SET password_hash = :hash WHERE id = :userId', { userId, hash: await bcrypt.hash(newPassword, 12) });
  // A changed password ends every other session; this one stays signed in.
  await query(
    'UPDATE login_sessions SET revoked_at = NOW() WHERE user_id = :userId AND revoked_at IS NULL AND refresh_hash <> :current',
    { userId, current: currentRefreshToken ? sha256(currentRefreshToken) : '' },
  );
  await recordAudit({ userId, action: 'password_change', ip });
};

export const listSessions = async (userId, currentRefreshToken) => {
  const currentHash = currentRefreshToken ? sha256(currentRefreshToken) : null;
  const rows = await query(
    `SELECT id, refresh_hash, device_info, ip_address, created_at, last_used_at FROM login_sessions
      WHERE user_id = :userId AND revoked_at IS NULL AND expires_at > NOW() ORDER BY id DESC`,
    { userId },
  );
  return rows.map((r) => ({ id: r.id, device: r.device_info, ip: r.ip_address, signedInAt: r.created_at, current: r.refresh_hash === currentHash }));
};

export const revokeSession = async (userId, id) => {
  const result = await query('UPDATE login_sessions SET revoked_at = NOW() WHERE id = :id AND user_id = :userId AND revoked_at IS NULL', { id, userId });
  if (!result.affectedRows) throw AppError.notFound('Session not found');
};

/* ---------- two-factor authentication ---------- */

const normalizeBackup = (code) => code.replace(/[\s-]/g, '').toLowerCase();

const newBackupCodes = () => Array.from({ length: BACKUP_CODE_COUNT }, () => {
  const hex = randomBytes(5).toString('hex');
  return `${hex.slice(0, 5)}-${hex.slice(5)}`;
});

const findUser = async (userId) => {
  const user = await queryOne('SELECT * FROM users WHERE id = :userId AND is_active = 1', { userId });
  if (!user) throw AppError.unauthorized('Account not found', 'NO_ACCOUNT');
  return user;
};

// Accepts an authenticator code or a one-time backup code (which is then used up).
const checkSecondFactor = async (user, code) => {
  const secret = user.mfa_secret && decrypt(user.mfa_secret);
  if (secret && /^\d{6}$/.test(code)) return verifyTotp(secret, code);

  const hashes = user.mfa_backup_hashes ? JSON.parse(user.mfa_backup_hashes) : [];
  const hash = sha256(normalizeBackup(code));
  if (!hashes.includes(hash)) return false;
  await query('UPDATE users SET mfa_backup_hashes = :hashes WHERE id = :id', { id: user.id, hashes: JSON.stringify(hashes.filter((h) => h !== hash)) });
  return true;
};

export const signMfaToken = (userId) => jwt.sign({ typ: 'mfa' }, env.jwtSecret, { subject: String(userId), expiresIn: MFA_TOKEN_TTL });

export const setupMfa = async (userId) => {
  const user = await findUser(userId);
  if (user.mfa_enabled) throw AppError.conflict('Two-factor sign-in is already on.', 'MFA_ALREADY_ENABLED');

  const secret = generateSecret();
  await query('UPDATE users SET mfa_secret = :secret WHERE id = :userId', { userId, secret: encrypt(secret) });
  const url = otpauthUrl({ secret, account: user.email || user.mobile || `user-${user.id}` });
  return { secret, otpauthUrl: url, qr: await QRCode.toDataURL(url, { margin: 1, width: 220 }) };
};

export const enableMfa = async (userId, code, ip) => {
  const user = await findUser(userId);
  if (user.mfa_enabled) throw AppError.conflict('Two-factor sign-in is already on.', 'MFA_ALREADY_ENABLED');
  if (!user.mfa_secret) throw AppError.badRequest('Start the setup first.', 'MFA_NOT_STARTED');
  if (!verifyTotp(decrypt(user.mfa_secret), code)) throw AppError.badRequest('That code is not correct. Check your authenticator app and try again.', 'INVALID_CODE');

  const codes = newBackupCodes();
  await query('UPDATE users SET mfa_enabled = 1, mfa_backup_hashes = :hashes WHERE id = :userId', { userId, hashes: JSON.stringify(codes.map((c) => sha256(normalizeBackup(c)))) });
  await recordAudit({ userId, action: 'mfa_enabled', ip });
  return { backupCodes: codes };
};

export const disableMfa = async (userId, { password, code }, ip) => {
  await verifyPassword(userId, password);
  const user = await findUser(userId);
  if (!user.mfa_enabled) throw AppError.badRequest('Two-factor sign-in is not on.', 'MFA_NOT_ENABLED');
  if (!(await checkSecondFactor(user, code))) throw AppError.badRequest('That code is not correct.', 'INVALID_CODE');

  await query('UPDATE users SET mfa_enabled = 0, mfa_secret = NULL, mfa_backup_hashes = NULL WHERE id = :userId', { userId });
  await recordAudit({ userId, action: 'mfa_disabled', ip });
};

export const completeMfaLogin = async ({ mfaToken, code }, meta) => {
  let payload;
  try {
    payload = jwt.verify(mfaToken, env.jwtSecret);
  } catch {
    throw AppError.unauthorized('Sign-in timed out. Please start again.', 'MFA_EXPIRED');
  }
  if (payload.typ !== 'mfa') throw AppError.unauthorized('Invalid sign-in attempt', 'MFA_EXPIRED');

  const user = await queryOne('SELECT *, (locked_until IS NOT NULL AND locked_until > NOW()) AS is_locked FROM users WHERE id = :id AND is_active = 1', { id: Number(payload.sub) });
  if (!user?.mfa_enabled) throw AppError.unauthorized('Sign-in timed out. Please start again.', 'MFA_EXPIRED');
  if (user.is_locked) throw AppError.locked(`Too many failed attempts. Try again in ${env.lockMinutes} minutes.`);

  if (!(await checkSecondFactor(user, code.trim()))) {
    await recordFailedLogin(user.id);
    throw AppError.unauthorized('That code is not correct.', 'INVALID_CODE');
  }

  await query('UPDATE users SET failed_otp_count = 0, locked_until = NULL, last_login_at = NOW(), last_login_ip = :ip WHERE id = :id', { id: user.id, ip: meta.ip || null });
  return createSession(user, meta);
};
