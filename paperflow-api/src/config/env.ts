import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Database
  DATABASE_URL: z.string().url(),
  DB_SSL: z.coerce.boolean().default(false),

  // Redis
  REDIS_URL: z.string().url(),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // API Keys
  API_KEY_SECRET: z.string().min(32),
  API_KEY_EXPIRES_DAYS: z.coerce.number().default(365),

  // OpenAI
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().default('gpt-4-turbo-preview'),
  OPENAI_EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),

  // S3/Storage
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  AWS_REGION: z.string().default('us-east-1'),
  S3_BUCKET_NAME: z.string().min(1),
  S3_ENDPOINT: z.string().url().optional(),

  // Rate Limiting
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW: z.coerce.number().default(60000),

  // Stripe
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),

  // Processing Limits
  MAX_FILE_SIZE_MB: z.coerce.number().default(10),
  MAX_PAGES_PER_PDF: z.coerce.number().default(100),
  MAX_CONCURRENT_JOBS: z.coerce.number().default(10),

  // Feature Flags
  ENABLE_OCR: z.coerce.boolean().default(true),
  ENABLE_IMAGE_EXTRACTION: z.coerce.boolean().default(true),
  ENABLE_WEBHOOK_NOTIFICATIONS: z.coerce.boolean().default(false),
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