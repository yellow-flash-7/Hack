import { z } from 'zod';

export const createVerificationRunSchema = z.object({
  title: z.string().optional(),
  rawAnswer: z.string().min(5, 'Answer text must be at least 5 characters long'),
  mode: z.enum(['STRICT', 'BALANCED', 'EXPLORATORY']).optional().default('BALANCED'),
  documentIds: z.union([z.array(z.string()), z.string().transform((val) => JSON.parse(val))]).optional(),
  sourceUrls: z.union([z.array(z.string()), z.string().transform((val) => JSON.parse(val))]).optional(),
});

export const reviewDecisionSchema = z.object({
  actionType: z.enum(['ACCEPT', 'REJECT', 'MODIFY', 'REQUEST_EVIDENCE']),
  newStatus: z.enum([
    'SUPPORTED',
    'CONTRADICTED',
    'PARTIALLY_SUPPORTED',
    'INSUFFICIENT_EVIDENCE',
    'NEEDS_REVIEW',
  ]),
  explanation: z.string().min(3, 'Explanation must be provided'),
  correctionText: z.string().optional(),
  reviewerName: z.string().optional().default('Human Reviewer'),
});
