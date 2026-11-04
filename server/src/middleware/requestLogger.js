import { logger } from '../utils/logger.js';

// Logs path only (no query string: document links carry a token there) plus timing and the authenticated user id.
export const requestLogger = (req, res, next) => {
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number((process.hrtime.bigint() - started) / 1_000_000n);
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level]('request', { requestId: req.id, method: req.method, path: req.originalUrl.split('?')[0], status: res.statusCode, ms, userId: req.user?.id ?? null });
  });
  next();
};
