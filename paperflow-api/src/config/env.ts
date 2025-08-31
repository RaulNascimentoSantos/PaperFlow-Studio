import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  // Core
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3002),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  
  // Feature Flags
  USE_MOCKS: z.coerce.boolean().default(true),

  // Database
  DATABASE_URL: z.string().url().default('postgresql://postgres:postgres@localhost:5432/paperflow'),
  DB_SSL: z.coerce.boolean().default(false),

  // Redis
  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  // JWT
  JWT_SECRET: z.string().min(32).default('paperflow-jwt-secret-key-very-secure-change-in-production'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // API Keys
  API_KEY_SECRET: z.string().min(32).default('paperflow-api-key-secret-very-secure-change-in-production'),
  API_KEY_EXPIRES_DAYS: z.coerce.number().default(365),

  // OpenAI
  OPENAI_API_KEY: z.string().startsWith('sk-').optional(),
  OPENAI_MODEL: z.string().default('gpt-4-turbo-preview'),
  OPENAI_EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),

  // S3/Storage
  AWS_ACCESS_KEY_ID: z.string().default('paperflow'),
  AWS_SECRET_ACCESS_KEY: z.string().default('paperflow123'),
  AWS_REGION: z.string().default('us-east-1'),
  S3_BUCKET_NAME: z.string().default('paperflow-dev'),
  S3_ENDPOINT: z.string().url().default('http://localhost:9000'),

  // Rate Limiting
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW: z.coerce.number().default(60000),

  // Webhooks
  WEBHOOK_SECRET: z.string().min(32).default('paperflow-webhook-secret-very-secure-change-in-production'),

  // Stripe (optional for enterprise features)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // Processing Limits
  MAX_FILE_SIZE_MB: z.coerce.number().default(50),
  MAX_PAGES_PER_PDF: z.coerce.number().default(1000),
  MAX_CONCURRENT_JOBS: z.coerce.number().default(10),

  // Feature Flags
  ENABLE_OCR: z.coerce.boolean().default(true),
  ENABLE_WEBHOOKS: z.coerce.boolean().default(true),
  ENABLE_METRICS: z.coerce.boolean().default(true),
  ENABLE_IMAGE_EXTRACTION: z.coerce.boolean().default(true),
});

export type EnvConfig = z.infer<typeof envSchema>;

let env: EnvConfig;

try {
  env = envSchema.parse(process.env);
} catch (error) {
  console.error('❌ Invalid environment configuration:', error);
  process.exit(1);
}

export { env };

export const isDevelopment = env.NODE_ENV === 'development';
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';