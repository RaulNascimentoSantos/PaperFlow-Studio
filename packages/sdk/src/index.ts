// Main SDK exports
export { setConfig, getConfig, type PaperflowConfig } from './mutator/custom-client';
export { DocumentEventStream, subscribeToDocumentEvents, type SSEEvent, type SSEOptions } from './utils/sse';

// Generated API client (will be available after running build)
export * from './generated/client';
export type * from './generated/api';

// SDK version
export const VERSION = '1.0.0-mvp';

// Default export with configuration
export default {
  VERSION,
  setConfig: (config: import('./mutator/custom-client').PaperflowConfig) => {
    const { setConfig } = require('./mutator/custom-client');
    setConfig(config);
  },
  subscribeToDocumentEvents,
};