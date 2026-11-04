import { queryOne } from '../config/db.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireRole } from './auth.js';

// Reviewers see customer data, so their account must be active and protected by two-factor sign-in.
const requireStrongAccount = asyncHandler(async (req, _res, next) => {
  const user = await queryOne('SELECT is_active, mfa_enabled FROM users WHERE id = :id', { id: req.user.id });
  if (!user?.is_active) throw AppError.forbidden('This account is disabled.');
  if (!user.mfa_enabled) {
    throw new AppError(403, 'MFA_REQUIRED', 'Turn on two-factor sign-in in Settings to review customer returns.');
  }
  next();
});

export const requireExpert = [requireRole('expert', 'admin'), requireStrongAccount];
