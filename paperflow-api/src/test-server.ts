import Fastify from 'fastify';
import { env } from './config/env';

async function createTestApp() {
  const app = Fastify({
    logger: true
  });

  // Simple health route
  app.get('/health', async () => {
    return { status: 'ok', message: 'PaperFlow API Test Server Running' };
  });

  // Test route
  app.get('/', async () => {
    return { 
      name: 'PaperFlow API Test', 
      version: '1.0.0-mvp',
      message: 'API is running in development mode with mock services',
      endpoints: {
        health: '/health',
        docs: '/docs (when full app is running)'
      }
    };
  });

  return app;
}

async function start() {
  try {
    console.log('🚀 Starting PaperFlow API Test Server...');
    
    const app = await createTestApp();
    
    await app.listen({ 
      port: env.PORT || 3000, 
      host: '0.0.0.0'
    });
    
    console.log(`✅ Test Server running on http://localhost:${env.PORT || 3000}`);
    console.log(`✅ Health check: http://localhost:${env.PORT || 3000}/health`);
    
  } catch (error) {
    console.error('❌ Failed to start test server:', error);
    process.exit(1);
  }
}

start();