import { z } from 'zod';

const MIN_AGE_YEARS = 18;
// The 4th character of a PAN says what kind of holder it is (P = individual).
const PAN_HOLDER_TYPES = 'PCHFATBELJG';

const dob = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date of birth')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date of birth')
  .refine((v) => {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - MIN_AGE_YEARS);
    return new Date(v) <= cutoff;
  }, `You must be at least ${MIN_AGE_YEARS} years old`);

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your name as per PAN').max(120),
  pan: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{5}\d{4}[A-Z]$/, 'PAN must look like ABCPE1234F')
    .refine((v) => PAN_HOLDER_TYPES.includes(v[3]), 'The 4th letter must be a valid holder type: P (individual), H, F, C, A, B, E, G, J, L or T')
    .optional(),
  dob,
  residentialStatus: z.enum(['resident', 'nri', 'rnor']),
  occupation: z.enum(['salaried', 'freelancer', 'business', 'investor', 'other']),
  address: z.string().trim().max(255).optional().default(''),
});
