import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export const authenticate = (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(AppError.unauthorized());

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    if (payload.typ !== 'access') throw new Error('Not an access token');
    req.user = { id: Number(payload.sub), role: payload.role };
    next();
  } catch {
    next(AppError.unauthorized('Your session has expired', 'TOKEN_EXPIRED'));
  }
};

export const requireRole = (...roles) => (req, _res, next) =>
  roles.includes(req.user?.role) ? next() : next(AppError.forbidden());
