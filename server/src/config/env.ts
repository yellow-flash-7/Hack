import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env from root or server
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5435/elov_db?schema=public'),
  PORT: z.string().transform((val) => parseInt(val, 10)).default('5001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  AI_PROVIDER: z.enum(['deterministic', 'gemini', 'openai']).default('deterministic'),
  GEMINI_API_KEY: z.string().optional().default(''),
  OPENAI_API_KEY: z.string().optional().default(''),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_UPLOAD_MB: z.string().transform((val) => parseInt(val, 10)).default('25'),
  SUPPORT_THRESHOLD: z.string().transform((val) => parseFloat(val)).default('0.75'),
  CONTRADICTION_THRESHOLD: z.string().transform((val) => parseFloat(val)).default('0.70'),
  NEEDS_REVIEW_MARGIN: z.string().transform((val) => parseFloat(val)).default('0.15'),
  MIN_RETRIEVAL_SIMILARITY: z.string().transform((val) => parseFloat(val)).default('0.30'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
