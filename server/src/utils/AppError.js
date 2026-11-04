export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest = (message, code = 'BAD_REQUEST', details) => new AppError(400, code, message, details);
  static unauthorized = (message = 'Please sign in to continue', code = 'UNAUTHORIZED') => new AppError(401, code, message);
  static forbidden = (message = 'You do not have access to this resource') => new AppError(403, 'FORBIDDEN', message);
  static notFound = (message = 'Resource not found') => new AppError(404, 'NOT_FOUND', message);
  static conflict = (message, code = 'CONFLICT') => new AppError(409, code, message);
  static locked = (message) => new AppError(423, 'ACCOUNT_LOCKED', message);
}
