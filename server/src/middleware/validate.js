import { AppError } from '../utils/AppError.js';

export const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    return next(AppError.badRequest('Please correct the highlighted fields', 'VALIDATION_ERROR', details));
  }
  Object.defineProperty(req, source, { value: result.data, writable: true, configurable: true });
  next();
};
