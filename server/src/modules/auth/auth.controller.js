import { env } from '../../config/env.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as auth from './auth.service.js';
import { signInWithGoogle } from './google.service.js';
import * as verification from './verification.service.js';
import * as passwordReset from './passwordReset.service.js';
import * as security from './security.service.js';

const COOKIE_NAME = 'finora_rt';
const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: env.isProd,
  path: '/api/auth',
};

const requestMeta = (req) => ({ ip: req.ip, device: req.headers['user-agent'] });

const sendSession = (res, status, { user, accessToken, refreshToken }) => {
  res.cookie(COOKIE_NAME, refreshToken, { ...cookieOptions, maxAge: env.refreshTokenTtlDays * 86_400_000 });
  res.status(status).json({ user, accessToken });
};

export const register = asyncHandler(async (req, res) => {
  const user = await auth.register(req.body, requestMeta(req));
  if (user.email && !user.email_verified) await verification.issueCode(user);
  res.status(201).json({ verificationRequired: Boolean(user.email), email: user.email });
});

export const verifyEmail = asyncHandler(async (req, res) => {
  sendSession(res, 200, await verification.verifyEmail(req.body, requestMeta(req)));
});

export const resendCode = asyncHandler(async (req, res) => {
  await verification.resendCode(req.body.email);
  res.status(204).end();
});

export const login = asyncHandler(async (req, res) => {
  let result;
  try {
    result = await auth.login(req.body, requestMeta(req));
  } catch (err) {
    if (err.code === 'EMAIL_NOT_VERIFIED') await verification.resendCode(err.details.email);
    throw err;
  }
  if (result.mfaRequired) return res.json({ mfaRequired: true, mfaToken: security.signMfaToken(result.userId) });
  sendSession(res, 200, result);
});

export const verifyMfa = asyncHandler(async (req, res) => {
  sendSession(res, 200, await security.completeMfaLogin(req.body, requestMeta(req)));
});

export const refresh = asyncHandler(async (req, res) => {
  try {
    sendSession(res, 200, await auth.refresh(req.cookies[COOKIE_NAME], requestMeta(req)));
  } catch (err) {
    res.clearCookie(COOKIE_NAME, cookieOptions);
    throw err;
  }
});

export const logout = asyncHandler(async (req, res) => {
  await auth.logout(req.cookies[COOKIE_NAME]);
  res.clearCookie(COOKIE_NAME, cookieOptions);
  res.status(204).end();
});

export const logoutAll = asyncHandler(async (req, res) => {
  await auth.revokeAllSessions(req.user.id);
  res.clearCookie(COOKIE_NAME, cookieOptions);
  res.status(204).end();
});

export const changePassword = asyncHandler(async (req, res) => {
  await security.changePassword(req.user.id, req.cookies[COOKIE_NAME], req.body, req.ip);
  res.status(204).end();
});

export const sessions = asyncHandler(async (req, res) => {
  res.json({ sessions: await security.listSessions(req.user.id, req.cookies[COOKIE_NAME]) });
});

export const revokeSession = asyncHandler(async (req, res) => {
  await security.revokeSession(req.user.id, req.params.id);
  res.status(204).end();
});

export const mfaSetup = asyncHandler(async (req, res) => res.json(await security.setupMfa(req.user.id)));
export const mfaEnable = asyncHandler(async (req, res) => res.json(await security.enableMfa(req.user.id, req.body.code, req.ip)));
export const mfaDisable = asyncHandler(async (req, res) => {
  await security.disableMfa(req.user.id, req.body, req.ip);
  res.status(204).end();
});

export const me = asyncHandler(async (req, res) => {
  res.json({ user: await auth.getCurrentUser(req.user.id) });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  await passwordReset.requestReset(req.body.email, req.ip);
  res.status(204).end();
});

export const resetPassword = asyncHandler(async (req, res) => {
  await passwordReset.resetPassword(req.body.token, req.body.password, req.ip);
  res.status(204).end();
});

export const publicConfig = (_req, res) => res.json({ googleClientId: env.google.clientId || null });

export const google = asyncHandler(async (req, res) => {
  const result = await signInWithGoogle(req.body.credential, requestMeta(req));
  if (result.mfaRequired) return res.json({ mfaRequired: true, mfaToken: security.signMfaToken(result.userId) });
  sendSession(res, result.created ? 201 : 200, result);
});
