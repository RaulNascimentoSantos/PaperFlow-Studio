import { getConfig } from '../mutator/custom-client';

export interface SSEEvent {
  type: 'connected' | 'progress' | 'completed' | 'error';
  documentId: string;
  stage?: string;
  progress?: number;
  message?: string;
  timestamp: string;
  error?: string;
}

export interface SSEOptions {
  onEvent?: (event: SSEEvent) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
}

export class DocumentEventStream {
  private eventSource: EventSource | null = null;
  private documentId: string;
  private options: SSEOptions;

  constructor(documentId: string, options: SSEOptions = {}) {
    this.documentId = documentId;
    this.options = options;
  }

  connect(): void {
    const config = getConfig();
    const url = new URL(`/v1/documents/${this.documentId}/events`, config.baseUrl || 'http://localhost:3002');
    
    // Add API key as query parameter since EventSource doesn't support headers
    url.searchParams.set('apiKey', config.apiKey);
    
    this.eventSource = new EventSource(url.toString());

    this.eventSource.onmessage = (event) => {
      try {
        const data: SSEEvent = JSON.parse(event.data);
        this.options.onEvent?.(data);

        if (data.type === 'completed') {
          this.options.onComplete?.();
          this.disconnect();
        }
      } catch (error) {
        this.options.onError?.(new Error('Failed to parse SSE event'));
      }
    };

    this.eventSource.onerror = (error) => {
      this.options.onError?.(new Error('SSE connection error'));
    };
  }

  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  isConnected(): boolean {
    return this.eventSource !== null && this.eventSource.readyState === EventSource.OPEN;
  }
}

// Helper function to create and manage document events
export const subscribeToDocumentEvents = (
  documentId: string,
  options: SSEOptions
): DocumentEventStream => {
  const stream = new DocumentEventStream(documentId, options);
  stream.connect();
  return stream;
};