import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDB, prisma } from './config/db.js';
import { logger } from './utils/logger.js';

async function bootstrap() {
  try {
    await connectDB();

    const app = createApp();
    const server = app.listen(env.PORT, () => {
      logger.info(`=======================================================`);
      logger.info(`🚀 ELOV Backend Service running on port ${env.PORT}`);
      logger.info(`   Environment: ${env.NODE_ENV}`);
      logger.info(`   AI Provider: ${env.AI_PROVIDER}`);
      logger.info(`   Database:    PostgreSQL 17 (port 5435)`);
      logger.info(`=======================================================`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        await prisma.$disconnect();
        logger.info('Database disconnected. Process exited.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) {
    logger.error('Fatal initialization error in ELOV server:', { err });
    process.exit(1);
  }
}

bootstrap();
