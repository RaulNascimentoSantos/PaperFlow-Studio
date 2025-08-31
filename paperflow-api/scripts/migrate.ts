import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { db, initDatabase } from '../src/config/database.js';
import logger from '../src/config/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface Migration {
  id: number;
  name: string;
  path: string;
}

async function createMigrationsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
}

async function getExecutedMigrations(): Promise<string[]> {
  const result = await db.query('SELECT name FROM migrations ORDER BY id');
  return result.rows.map(row => row.name);
}

async function getMigrationFiles(): Promise<Migration[]> {
  const fs = await import('fs/promises');
  const migrationsDir = join(__dirname, '..', 'migrations');
  
  try {
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files.filter(file => file.endsWith('.sql'));
    
    return sqlFiles.map(file => {
      const match = file.match(/^(\d+)_(.+)\.sql$/);
      if (!match) {
        throw new Error(`Invalid migration file name: ${file}`);
      }
      
      return {
        id: parseInt(match[1], 10),
        name: file,
        path: join(migrationsDir, file)
      };
    }).sort((a, b) => a.id - b.id);
  } catch (error) {
    logger.error('Failed to read migrations directory:', error);
    return [];
  }
}

async function executeMigration(migration: Migration) {
  const sql = readFileSync(migration.path, 'utf8');
  
  logger.info(`Executing migration: ${migration.name}`);
  
  try {
    await db.query('BEGIN');
    
    // Execute the migration SQL
    await db.query(sql);
    
    // Record the migration
    await db.query(
      'INSERT INTO migrations (name) VALUES ($1)',
      [migration.name]
    );
    
    await db.query('COMMIT');
    logger.info(`✅ Migration ${migration.name} completed successfully`);
  } catch (error) {
    await db.query('ROLLBACK');
    logger.error(`❌ Migration ${migration.name} failed:`, error);
    throw error;
  }
}

async function runMigrations() {
  try {
    logger.info('🚀 Starting database migrations...');
    
    await initDatabase();
    await createMigrationsTable();
    
    const executedMigrations = await getExecutedMigrations();
    const allMigrations = await getMigrationFiles();
    
    const pendingMigrations = allMigrations.filter(
      migration => !executedMigrations.includes(migration.name)
    );
    
    if (pendingMigrations.length === 0) {
      logger.info('✅ No pending migrations');
      return;
    }
    
    logger.info(`Found ${pendingMigrations.length} pending migrations`);
    
    for (const migration of pendingMigrations) {
      await executeMigration(migration);
    }
    
    logger.info('✅ All migrations completed successfully');
  } catch (error) {
    logger.error('❌ Migration process failed:', error);
    process.exit(1);
  } finally {
    await db.end();
  }
}

// Run migrations if script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations();
}

export { runMigrations };