import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { query, queryOne } from '../../config/db.js';
import { AppError } from '../../utils/AppError.js';
import { randomToken, sha256 } from '../../utils/crypto.js';

const DUMMY_HASH = bcrypt.hashSync('timing-safe-placeholder', 10);
const INVALID_LOGIN = 'Invalid email/mobile or password';

export const toPublicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  mobile: u.mobile,
  role: u.role,
});

const findUserById = (id) => queryOne('SELECT * FROM users WHERE id = :id AND is_active = 1', { id });

export const createSession = async (user, meta) => {
  const refreshToken = randomToken();
  await query(
    `INSERT INTO login_sessions (user_id, refresh_hash, device_info, ip_address, last_used_at, expires_at)
     VALUES (:userId, :hash, :device, :ip, NOW(), DATE_ADD(NOW(), INTERVAL :days DAY))`,
    {
      userId: user.id,
      hash: sha256(refreshToken),
      device: (meta.device || '').slice(0, 255) || null,
      ip: meta.ip || null,
      days: env.refreshTokenTtlDays,
    },
  );
  const accessToken = jwt.sign({ role: user.role, typ: 'access' }, env.jwtSecret, {
    subject: String(user.id),
    expiresIn: env.accessTokenTtl,
  });
  return { user: toPublicUser(user), accessToken, refreshToken };
};

export const register = async ({ name, email, mobile, password }, meta) => {
  const duplicate = await queryOne(
    'SELECT id FROM users WHERE (:email IS NOT NULL AND email = :email) OR (:mobile IS NOT NULL AND mobile = :mobile)',
    { email: email ?? null, mobile: mobile ?? null },
  );
  if (duplicate) throw AppError.conflict('An account with this email or mobile already exists', 'ACCOUNT_EXISTS');

  const passwordHash = await bcrypt.hash(password, 12);
  const result = await query(
    'INSERT INTO users (name, email, mobile, password_hash, last_login_at, last_login_ip) VALUES (:name, :email, :mobile, :passwordHash, NOW(), :ip)',
    { name, email: email ?? null, mobile: mobile ?? null, passwordHash, ip: meta.ip || null },
  );
  return findUserById(result.insertId);
};

export const recordFailedLogin = (id) =>
  query(
    `UPDATE users
        SET locked_until = IF(failed_otp_count + 1 >= :max, DATE_ADD(NOW(), INTERVAL :mins MINUTE), locked_until),
            failed_otp_count = failed_otp_count + 1
      WHERE id = :id`,
    { id, max: env.maxFailedLogins, mins: env.lockMinutes },
  );

export const login = async ({ identifier, password }, meta) => {
  const field = identifier.includes('@') ? 'email' : 'mobile';
  const user = await queryOne(
    `SELECT *, (locked_until IS NOT NULL AND locked_until > NOW()) AS is_locked
       FROM users WHERE ${field} = :identifier AND is_active = 1`,
    { identifier },
  );

  const valid = await bcrypt.compare(password, user?.password_hash || DUMMY_HASH);
  if (!user) throw AppError.unauthorized(INVALID_LOGIN, 'INVALID_CREDENTIALS');
  if (user.is_locked) {
    throw AppError.locked(`Too many failed attempts. Try again in ${env.lockMinutes} minutes.`);
  }
  if (!valid) {
    await recordFailedLogin(user.id);
    throw AppError.unauthorized(INVALID_LOGIN, 'INVALID_CREDENTIALS');
  }

  if (user.email && !user.email_verified) {
    throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Verify your email to sign in. We sent you a code.', { email: user.email });
  }

  // With two-factor on, the password alone is not enough: counters reset only after the second step.
  if (user.mfa_enabled) return { mfaRequired: true, userId: user.id };

  await query(
    'UPDATE users SET failed_otp_count = 0, locked_until = NULL, last_login_at = NOW(), last_login_ip = :ip WHERE id = :id',
    { id: user.id, ip: meta.ip || null },
  );
  return createSession(user, meta);
};

export const refresh = async (refreshToken, meta) => {
  if (!refreshToken) throw AppError.unauthorized('Session not found', 'NO_SESSION');

  const session = await queryOne(
    'SELECT *, TIMESTAMPDIFF(SECOND, revoked_at, NOW()) AS revoked_ago FROM login_sessions WHERE refresh_hash = :hash',
    { hash: sha256(refreshToken) },
  );
  if (!session) throw AppError.unauthorized('Session not found', 'NO_SESSION');

  // A just-rotated token is accepted briefly: concurrent tabs or an aborted response can legitimately reuse it.
  // A session revoked on purpose (logout, password change, "sign out this device") is never accepted again.
  const withinGrace = session.rotated_at && session.revoked_ago <= env.refreshGraceSeconds;
  if (session.revoked_at && !withinGrace) {
    // Replaying an old rotated token suggests it was stolen, so end every session.
    if (session.rotated_at) await revokeAllSessions(session.user_id);
    throw AppError.unauthorized('Session is no longer valid', 'SESSION_REVOKED');
  }

  const live = await queryOne('SELECT id FROM login_sessions WHERE id = :id AND expires_at > NOW()', { id: session.id });
  const user = live && (await findUserById(session.user_id));
  if (!user) throw AppError.unauthorized('Session expired', 'SESSION_EXPIRED');

  await query('UPDATE login_sessions SET revoked_at = NOW(), rotated_at = NOW() WHERE id = :id AND revoked_at IS NULL', { id: session.id });
  return createSession(user, meta);
};

export const logout = (refreshToken) =>
  refreshToken
    ? query('UPDATE login_sessions SET revoked_at = NOW() WHERE refresh_hash = :hash AND revoked_at IS NULL', {
        hash: sha256(refreshToken),
      })
    : Promise.resolve();

export const revokeAllSessions = (userId) =>
  query('UPDATE login_sessions SET revoked_at = NOW() WHERE user_id = :userId AND revoked_at IS NULL', { userId });

export const getCurrentUser = async (id) => {
  const user = await findUserById(id);
  if (!user) throw AppError.unauthorized('Account not found', 'NO_ACCOUNT');
  return toPublicUser(user);
};
