import { createApp } from './app';
import { env } from './config/env';
import logger from './config/logger';

// Override port for development
const DEV_PORT = 3002;

async function start() {
  try {
    console.log('🚀 Starting PaperFlow API Development Server...');
    
    const app = await createApp();

    await app.listen({ 
      port: DEV_PORT, 
      host: env.HOST || '0.0.0.0'
    });
    
    logger.info(`🚀 PaperFlow API development server running on http://localhost:${DEV_PORT}`);
    logger.info(`📚 API Documentation available at http://localhost:${DEV_PORT}/docs`);
    logger.info(`🔍 Health check at http://localhost:${DEV_PORT}/v1/health`);
    
  } catch (error) {
    logger.error('❌ Failed to start development server:', error);
    console.error('Full error details:', error);
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