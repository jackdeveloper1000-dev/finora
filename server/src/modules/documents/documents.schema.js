import { z } from 'zod';

export const DOC_TYPES = ['bank_statement', 'form16', 'ais', 'form26as', 'interest_cert', 'investment_proof', 'other'];

const id = z.coerce.number().int().positive();

export const caseParamsSchema = z.object({ caseId: id });
export const documentParamsSchema = z.object({ id });
export const uploadBodySchema = z.object({
  docType: z.enum(DOC_TYPES, { error: 'Choose a valid document type' }),
});
export const fileTokenSchema = z.object({ t: z.string().min(10, 'Missing access token') });
