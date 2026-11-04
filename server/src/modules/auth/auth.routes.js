import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './auth.controller.js';
import { z } from 'zod';
import { changePasswordSchema, verifyEmailSchema, resendCodeSchema, googleSchema, forgotPasswordSchema, resetPasswordSchema, loginSchema, mfaDisableSchema, mfaEnableSchema, mfaVerifySchema, registerSchema } from './auth.schema.js';

const router = Router();

router.post('/register', validate(registerSchema), controller.register);
router.post('/verify-email', validate(verifyEmailSchema), controller.verifyEmail);
router.post('/resend-code', validate(resendCodeSchema), controller.resendCode);
router.post('/login', validate(loginSchema), controller.login);
router.post('/forgot-password', validate(forgotPasswordSchema), controller.forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), controller.resetPassword);
router.get('/config', controller.publicConfig);
router.post('/google', validate(googleSchema), controller.google);
router.post('/refresh', controller.refresh);
router.post('/logout', controller.logout);
router.post('/logout-all', authenticate, controller.logoutAll);
router.get('/me', authenticate, controller.me);

router.post('/mfa/verify', validate(mfaVerifySchema), controller.verifyMfa);
router.post('/password', authenticate, validate(changePasswordSchema), controller.changePassword);
router.get('/sessions', authenticate, controller.sessions);
router.delete('/sessions/:id', authenticate, validate(z.object({ id: z.coerce.number().int().positive() }), 'params'), controller.revokeSession);
router.post('/mfa/setup', authenticate, controller.mfaSetup);
router.post('/mfa/enable', authenticate, validate(mfaEnableSchema), controller.mfaEnable);
router.post('/mfa/disable', authenticate, validate(mfaDisableSchema), controller.mfaDisable);

export default router;
