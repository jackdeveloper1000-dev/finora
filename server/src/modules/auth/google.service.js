import { OAuth2Client } from 'google-auth-library';
import { env } from '../../config/env.js';
import { query, queryOne } from '../../config/db.js';
import { AppError } from '../../utils/AppError.js';
import { recordAudit } from '../../utils/audit.js';
import { createSession } from './auth.service.js';

let client;

const verifyCredential = async (credential) => {
  if (!env.google.clientId) throw new AppError(503, 'GOOGLE_DISABLED', 'Google sign-in is not set up on this server.');
  client ??= new OAuth2Client(env.google.clientId);
  try {
    const ticket = await client.verifyIdToken({ idToken: credential, audience: env.google.clientId });
    const p = ticket.getPayload();
    if (!p?.sub || !p.email || !p.email_verified) throw new Error('Unverified Google account');
    return { sub: p.sub, email: p.email.toLowerCase(), name: p.name || p.email.split('@')[0] };
  } catch {
    throw AppError.unauthorized('Google sign-in could not be verified. Please try again.', 'GOOGLE_INVALID');
  }
};

// Finds the account for a verified Google identity, creating or linking it by email when needed.
const resolveUser = async ({ sub, email, name }) => {
  const bySub = await queryOne('SELECT * FROM users WHERE google_sub = :sub', { sub });
  if (bySub) return { user: bySub, created: false };

  const byEmail = await queryOne('SELECT * FROM users WHERE email = :email', { email });
  if (byEmail) {
    await query('UPDATE users SET google_sub = :sub, email_verified = 1 WHERE id = :id', { sub, id: byEmail.id });
    return { user: byEmail, created: false };
  }

  const result = await query(
    'INSERT INTO users (name, email, email_verified, google_sub, is_verified) VALUES (:name, :email, 1, :sub, 1)',
    { name: name.slice(0, 120), email, sub },
  );
  return { user: await queryOne('SELECT * FROM users WHERE id = :id', { id: result.insertId }), created: true };
};

export const signInWithGoogle = async (credential, meta) => {
  const identity = await verifyCredential(credential);
  const { user, created } = await resolveUser(identity);
  if (!user.is_active) throw AppError.forbidden('This account is disabled.');

  await recordAudit({ userId: user.id, action: created ? 'google_register' : 'google_login', ip: meta.ip });
  // Two-factor still applies: a Google login does not skip the second step.
  if (user.mfa_enabled) return { mfaRequired: true, userId: user.id };

  await query('UPDATE users SET failed_otp_count = 0, locked_until = NULL, last_login_at = NOW(), last_login_ip = :ip WHERE id = :id', { id: user.id, ip: meta.ip || null });
  return { ...(await createSession(user, meta)), created };
};
