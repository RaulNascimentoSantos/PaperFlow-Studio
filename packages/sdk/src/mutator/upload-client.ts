import axios, { AxiosRequestConfig } from 'axios';
import { getConfig } from './custom-client';

// Special client for file uploads
export const uploadClient = <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig
): Promise<T> => {
  const paperflowConfig = getConfig();
  
  const client = axios.create({
    baseURL: paperflowConfig.baseUrl || 'http://localhost:3002',
    timeout: 120000, // 2 minutes for uploads
    headers: {
      'x-api-key': paperflowConfig.apiKey,
    },
  });

  // Remove content-type for multipart uploads
  const uploadConfig = {
    ...config,
    ...options,
    headers: {
      'x-api-key': paperflowConfig.apiKey,
      ...options?.headers,
    },
  };

  // Remove content-type to let axios set it automatically for FormData
  if (uploadConfig.headers && 'Content-Type' in uploadConfig.headers) {
    delete uploadConfig.headers['Content-Type'];
  }

  const promise = client(uploadConfig).then(({ data }) => data);

  return promise;
};