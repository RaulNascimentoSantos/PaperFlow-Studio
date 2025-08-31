import { createApp } from './app';
import { env } from './config/env';
import logger from './config/logger';

async function start() {
  try {
    const app = await createApp();

    await app.listen({ 
      port: env.PORT, 
      host: env.HOST 
    });
    
    logger.info(`🚀 PaperFlow API server running on http://${env.HOST}:${env.PORT}`);
    logger.info(`📚 API Documentation available at http://${env.HOST}:${env.PORT}/docs`);
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

start();
