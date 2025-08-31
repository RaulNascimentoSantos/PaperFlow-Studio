export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public isOperational: boolean;

  constructor(message: string, statusCode: number, code: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Predefined error codes and messages
export const ErrorCodes = {
  // Authentication & Authorization
  INVALID_API_KEY: 'INVALID_API_KEY',
  EXPIRED_API_KEY: 'EXPIRED_API_KEY',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',

  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  BAD_REQUEST: 'BAD_REQUEST',

  // File Processing
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  FILE_UPLOAD_FAILED: 'FILE_UPLOAD_FAILED',
  PDF_PROCESSING_FAILED: 'PDF_PROCESSING_FAILED',

  // Database
  RECORD_NOT_FOUND: 'RECORD_NOT_FOUND',
  DUPLICATE_RECORD: 'DUPLICATE_RECORD',
  DATABASE_ERROR: 'DATABASE_ERROR',

  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',

  // External Services
  OPENAI_API_ERROR: 'OPENAI_API_ERROR',
  S3_UPLOAD_ERROR: 'S3_UPLOAD_ERROR',
  REDIS_ERROR: 'REDIS_ERROR',

  // General
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
} as const;

// Error factory functions
export const createError = {
  invalidApiKey: (message = 'Invalid API key') =>
    new AppError(message, 401, ErrorCodes.INVALID_API_KEY),

  expiredApiKey: (message = 'API key has expired') =>
    new AppError(message, 401, ErrorCodes.EXPIRED_API_KEY),

  unauthorized: (message = 'Unauthorized access') =>
    new AppError(message, 401, ErrorCodes.UNAUTHORIZED),

  forbidden: (message = 'Access forbidden') =>
    new AppError(message, 403, ErrorCodes.FORBIDDEN),

  validation: (message: string) =>
    new AppError(message, 400, ErrorCodes.VALIDATION_ERROR),

  invalidInput: (message: string) =>
    new AppError(message, 400, ErrorCodes.INVALID_INPUT),

  badRequest: (message: string) =>
    new AppError(message, 400, ErrorCodes.BAD_REQUEST),

  fileTooLarge: (maxSize: number) =>
    new AppError(
      `File size exceeds maximum allowed size of ${maxSize}MB`,
      400,
      ErrorCodes.FILE_TOO_LARGE,
    ),

  invalidFileType: (allowedTypes: string[]) =>
    new AppError(
      `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`,
      400,
      ErrorCodes.INVALID_FILE_TYPE,
    ),

  notFound: (resource = 'Resource') =>
    new AppError(`${resource} not found`, 404, ErrorCodes.RECORD_NOT_FOUND),

  duplicate: (resource = 'Record') =>
    new AppError(`${resource} already exists`, 409, ErrorCodes.DUPLICATE_RECORD),

  rateLimitExceeded: (resetTime?: Date) =>
    new AppError(
      `Rate limit exceeded${resetTime ? `. Try again after ${resetTime.toISOString()}` : ''}`,
      429,
      ErrorCodes.RATE_LIMIT_EXCEEDED,
    ),

  quotaExceeded: (quotaType: string) =>
    new AppError(
      `${quotaType} quota exceeded. Please upgrade your subscription.`,
      402,
      ErrorCodes.QUOTA_EXCEEDED,
    ),

  processingFailed: (message = 'Processing failed') =>
    new AppError(message, 500, ErrorCodes.PDF_PROCESSING_FAILED),

  externalService: (service: string, message?: string) =>
    new AppError(
      `${service} service error${message ? `: ${message}` : ''}`,
      502,
      ErrorCodes.OPENAI_API_ERROR,
    ),

  internalError: (message = 'Internal server error') =>
    new AppError(message, 500, ErrorCodes.INTERNAL_SERVER_ERROR),

  timeout: (operation = 'Operation') =>
    new AppError(`${operation} timed out`, 504, ErrorCodes.TIMEOUT_ERROR),

  serviceUnavailable: (message = 'Service temporarily unavailable') =>
    new AppError(message, 503, ErrorCodes.SERVICE_UNAVAILABLE),
};

// Error classification helpers
export const isOperationalError = (error: Error): boolean => {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
};

export const getErrorStatusCode = (error: Error): number => {
  if (error instanceof AppError) {
    return error.statusCode;
  }
  return 500;
};

export const getErrorCode = (error: Error): string => {
  if (error instanceof AppError) {
    return error.code;
  }
  return ErrorCodes.INTERNAL_SERVER_ERROR;
};

// Error sanitization for API responses
export const sanitizeError = (error: Error) => {
  const isProduction = process.env['NODE_ENV'] === 'production';

  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      ...((!isProduction || error.isOperational) && { stack: error.stack }),
    };
  }

  // Don't expose internal errors in production
  if (isProduction) {
    return {
      code: ErrorCodes.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      statusCode: 500,
    };
  }

  return {
    code: ErrorCodes.INTERNAL_SERVER_ERROR,
    message: error.message,
    statusCode: 500,
    stack: error.stack,
  };
};