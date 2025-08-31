import { env } from './env';
import { LocalStorageAdapter, StorageAdapter } from '../services/storage/local-storage';
import { S3Client } from '@aws-sdk/client-s3';

// Create storage adapter based on environment
export function createStorageAdapter(): StorageAdapter {
  if (env.NODE_ENV === 'development' || !env.S3_ENDPOINT || env.S3_ENDPOINT.includes('localhost')) {
    console.log('🗂️ Using local storage adapter for development');
    return new LocalStorageAdapter('./uploads');
  }

  // For production, we'd use S3 adapter
  console.log('☁️ Using S3 storage adapter for production');
  throw new Error('S3 adapter not implemented yet - use local storage for now');
}

// Create S3 client for compatibility (some services might still need it)
export const s3 = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
  ...(env.S3_ENDPOINT && { endpoint: env.S3_ENDPOINT }),
});

// Export the storage adapter instance
export const storage = createStorageAdapter();