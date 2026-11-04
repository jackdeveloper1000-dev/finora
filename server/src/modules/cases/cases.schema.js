import { z } from 'zod';
import { env } from '../../config/env.js';

export const createCaseSchema = z.object({
  assessmentYear: z.enum(env.supportedAssessmentYears, {
    error: `Choose one of: ${env.supportedAssessmentYears.join(', ')}`,
  }),
});

export const caseIdSchema = z.object({ id: z.coerce.number().int().positive() });
