import { env } from './env';

// Import appropriate database based on environment
let db: any;
let initDatabase: () => Promise<void>;
let closeDatabaseConnections: () => Promise<void>;

if (env.NODE_ENV === 'development') {
  console.log('🧪 Using mock database for development');
  const { mockDb } = require('./mock-db');
  
  db = mockDb;
  
  initDatabase = async () => {
    console.log('✅ Mock database initialized');
    await mockDb.init();
  };
  
  closeDatabaseConnections = async () => {
    console.log('🔌 Mock database closed');
  };
  
} else {
  // Production database
  const { Pool } = require('pg');
  
  const config = {
    connectionString: env.DATABASE_URL,
    ssl: env.DB_SSL ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };
  
  db = new Pool(config);
  
  initDatabase = async () => {
    try {
      const client = await db.connect();
      
      // Test connection
      await client.query('SELECT NOW()');
      
      // Enable pgvector extension
      await client.query('CREATE EXTENSION IF NOT EXISTS vector');
      
      client.release();
      console.log('✅ Database connected successfully');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw error;
    }
  };
  
  closeDatabaseConnections = async () => {
    await db.end();
  };
}

export { db, initDatabase, closeDatabaseConnections };