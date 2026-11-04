import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { errorFields, logger } from '../utils/logger.js';

export const requestId = (req, res, next) => {
  // Only accept well-formed ids from callers; anything else could be used to forge log lines.
  const incoming = req.headers['x-request-id'];
  req.id = typeof incoming === 'string' && /^[w-]{8,64}$/.test(incoming) ? incoming : randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
};

export const notFoundHandler = (req, _res, next) =>
  next(AppError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));

const normalize = (err) => {
  if (err instanceof AppError) return err;
  if (err.code === 'ER_DUP_ENTRY') return AppError.conflict('This record already exists', 'DUPLICATE');
  if (err.type === 'entity.parse.failed') return AppError.badRequest('Malformed JSON body');
  if (err.code === 'LIMIT_FILE_SIZE') return new AppError(413, 'FILE_TOO_LARGE', `File is too large. Maximum size is ${env.maxUploadMb} MB.`);
  if (err.name === 'MulterError') return AppError.badRequest('Invalid upload. Send a single file in the "file" field.', 'INVALID_UPLOAD');
  if (err.type === 'entity.too.large') return new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
  if (err.code === 'ECONNREFUSED' || err.code === 'PROTOCOL_CONNECTION_LOST') {
    return new AppError(503, 'DB_UNAVAILABLE', 'Service temporarily unavailable. Please try again shortly.');
  }
  return new AppError(500, 'INTERNAL_ERROR', 'Something went wrong on our side');
};

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, _next) => {
  const error = normalize(err);
  if (error.status >= 500) logger.error('unhandled error', { requestId: req.id, path: req.path, ...errorFields(err) });

  res.status(error.status).json({
    error: {
      code: error.code,
      message: error.message,
      ...(error.details && { details: error.details }),
      ...(!env.isProd && error.status >= 500 && { stack: err.stack }),
    },
    requestId: req.id,
  });
};
