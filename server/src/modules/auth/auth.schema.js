import { z } from 'zod';

const mobile = z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number');

export const passwordRule = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[A-Za-z]/, 'Password must include a letter')
  .regex(/\d/, 'Password must include a number');

const emptyToUndefined = (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter your full name').max(120),
    email: z.preprocess(emptyToUndefined, z.string().trim().toLowerCase().email('Enter a valid email').max(150).optional()),
    mobile: z.preprocess(emptyToUndefined, mobile.optional()),
    password: passwordRule,
  })
  .refine((d) => d.email || d.mobile, { message: 'Provide an email or a mobile number', path: ['email'] });

export const mfaVerifySchema = z.object({
  mfaToken: z.string().min(10).max(2000),
  code: z.string().trim().min(6, 'Enter the 6-digit code').max(20),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password').max(72),
  newPassword: passwordRule,
});

export const mfaEnableSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code') });

export const mfaDisableSchema = z.object({
  password: z.string().min(1, 'Enter your password').max(72),
  code: z.string().trim().min(6, 'Enter a code').max(20),
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(3, 'Enter your email or mobile number').toLowerCase(),
  password: z.string().min(1, 'Enter your password'),
});

export const forgotPasswordSchema = z.object({ email: z.string().trim().toLowerCase().email('Enter a valid email').max(150) });

export const resetPasswordSchema = z.object({ token: z.string().min(20).max(100), password: passwordRule });

export const googleSchema = z.object({ credential: z.string().min(20).max(4000) });

export const verifyEmailSchema = z.object({ email: z.string().trim().toLowerCase().email().max(150), code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code') });

export const resendCodeSchema = z.object({ email: z.string().trim().toLowerCase().email().max(150) });
