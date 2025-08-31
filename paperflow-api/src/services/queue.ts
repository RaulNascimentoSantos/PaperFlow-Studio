import { Queue } from 'bullmq';
import { createClient } from 'redis';
import { env } from '@/config/env';

const redis = createClient({
  url: env.REDIS_URL,
});

export const pdfProcessingQueue = new Queue('pdf-processing', {
  connection: redis as any,
});
