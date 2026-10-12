import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';

import verificationRoutes from './routes/verificationRoutes.js';
import documentRoutes from './routes/documentRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import statsRoutes from './routes/statsRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import healthRoutes from './routes/healthRoutes.js';

export function createApp() {
  const app = express();

  // CORS configuration
  app.use(
    cors({
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // HTTP access logger
  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`);
    next();
  });

  // REST API Routes
  app.use('/api/verification-runs', verificationRoutes);
  app.use('/api/documents', documentRoutes);
  app.use('/api/reviews', reviewRoutes);
  app.use('/api/stats', statsRoutes);
  app.use('/api/audit-logs', auditRoutes);
  app.use('/api/health', healthRoutes);

  // Fallback 404
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: `API endpoint ${req.method} ${req.originalUrl} not found`,
    });
  });

  // Error Handler
  app.use(errorHandler);

  return app;
}
