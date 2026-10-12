import { Router, Request, Response } from 'express';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';

const router = Router();

// GET /api/health
router.get('/', async (req: Request, res: Response) => {
  let dbStatus = 'CONNECTED';
  let dbError: string | null = null;

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err: any) {
    dbStatus = 'DISCONNECTED';
    dbError = err.message;
  }

  const memoryUsage = process.memoryUsage();

  res.json({
    status: dbStatus === 'CONNECTED' ? 'HEALTHY' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      status: dbStatus,
      engine: 'PostgreSQL 17 (Prisma ORM)',
      error: dbError,
    },
    ai: {
      provider: env.AI_PROVIDER,
      configuredProviders: {
        deterministic: true,
        gemini: Boolean(env.GEMINI_API_KEY),
        openai: Boolean(env.OPENAI_API_KEY),
      },
    },
    system: {
      nodeVersion: process.version,
      memory: {
        heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        rssMB: Math.round(memoryUsage.rss / 1024 / 1024),
      },
    },
  });
});

export default router;
