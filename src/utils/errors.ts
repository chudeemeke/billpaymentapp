// Result type for functional error handling
export type Result<T, E = Error> = 
  | { ok: true; value: T }
  | { ok: false; error: E };

export const Ok = <T>(value: T): Result<T, never> => ({
  ok: true,
  value,
});

export const Err = <E>(error: E): Result<never, E> => ({
  ok: false,
  error,
});

// Base error class with rich context
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, any>;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.context = context;
    this.timestamp = new Date();

    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

// Domain errors
export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', 400, true, context);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed', context?: Record<string, any>) {
    super(message, 'AUTHENTICATION_ERROR', 401, true, context);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied', context?: Record<string, any>) {
    super(message, 'AUTHORIZATION_ERROR', 403, true, context);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string | number) {
    const message = identifier 
      ? `${resource} with id '${identifier}' not found`
      : `${resource} not found`;
    super(message, 'NOT_FOUND', 404, true, { resource, identifier });
  }
}

export class ConflictError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'CONFLICT', 409, true, context);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests', retryAfter?: number) {
    super(message, 'RATE_LIMIT_ERROR', 429, true, { retryAfter });
  }
}

// Payment specific errors
export class PaymentError extends AppError {
  public readonly provider: string;
  public readonly failureCode?: string;

  constructor(
    message: string,
    provider: string,
    failureCode?: string,
    context?: Record<string, any>
  ) {
    super(message, 'PAYMENT_ERROR', 402, true, { ...context, provider, failureCode });
    this.provider = provider;
    this.failureCode = failureCode;
  }
}

export class InsufficientFundsError extends PaymentError {
  constructor(provider: string, context?: Record<string, any>) {
    super('Insufficient funds', provider, 'insufficient_funds', context);
  }
}

// Infrastructure errors
export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, originalError?: Error) {
    super(
      `${service} error: ${message}`,
      'EXTERNAL_SERVICE_ERROR',
      503,
      false,
      { service, originalError: originalError?.message }
    );
  }
}

export class DatabaseError extends AppError {
  constructor(operation: string, originalError?: Error) {
    super(
      `Database operation '${operation}' failed`,
      'DATABASE_ERROR',
      500,
      false,
      { operation, originalError: originalError?.message }
    );
  }
}

// Error utility functions
export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

export function errorToResult<T>(fn: () => T): Result<T> {
  try {
    return Ok(fn());
  } catch (error) {
    return Err(error as Error);
  }
}

export async function asyncErrorToResult<T>(
  fn: () => Promise<T>
): Promise<Result<T>> {
  try {
    const value = await fn();
    return Ok(value);
  } catch (error) {
    return Err(error as Error);
  }
}

// Result utility functions for chaining
export function mapResult<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  if (result.ok) {
    return Ok(fn(result.value));
  }
  return result;
}

export function flatMapResult<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  if (result.ok) {
    return fn(result.value);
  }
  return result;
}

export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  return result.ok ? result.value : defaultValue;
}