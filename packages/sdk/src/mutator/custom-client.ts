import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

export interface PaperflowConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

// Global configuration
let globalConfig: PaperflowConfig | null = null;

export const setConfig = (config: PaperflowConfig) => {
  globalConfig = config;
};

export const getConfig = (): PaperflowConfig => {
  if (!globalConfig) {
    throw new Error('PaperFlow SDK not configured. Call setConfig() first.');
  }
  return globalConfig;
};

// Create axios instance with interceptors
const createApiClient = (config: PaperflowConfig): AxiosInstance => {
  const client = axios.create({
    baseURL: config.baseUrl || 'http://localhost:3002',
    timeout: config.timeout || 30000,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
    },
  });

  // Request interceptor
  client.interceptors.request.use(
    (request) => {
      // Add timestamp to prevent caching
      if (request.params) {
        request.params._t = Date.now();
      } else {
        request.params = { _t: Date.now() };
      }
      
      return request;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor
  client.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        throw new Error('Invalid API key. Please check your authentication.');
      }
      if (error.response?.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      return Promise.reject(error);
    }
  );

  return client;
};

// Custom client for orval
export const customClient = <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig
): Promise<T> => {
  const paperflowConfig = getConfig();
  const client = createApiClient(paperflowConfig);

  const promise = client({
    ...config,
    ...options,
  }).then(({ data }) => data);

  return promise;
};