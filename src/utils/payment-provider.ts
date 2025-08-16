// Payment Provider Abstraction with full lifecycle support
import { Result } from './errors';

// Value objects for payment domain
export interface Money {
  amount: number; // In pence/cents
  currency: 'GBP' | 'USD' | 'EUR';
}

export interface Customer {
  id: string;
  email: string;
  name?: string;
  metadata?: Record<string, string>;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_account' | 'paypal';
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault?: boolean;
}

export interface ChargeParams {
  amount: Money;
  customerId: string;
  paymentMethodId?: string;
  description?: string;
  metadata?: Record<string, string>;
  idempotencyKey?: string;
  captureImmediately?: boolean;
}

export interface RefundParams {
  transactionId: string;
  amount?: Money; // Partial refund if specified
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
  metadata?: Record<string, string>;
}

export interface Transaction {
  id: string;
  providerId: string; // Provider's transaction ID
  amount: Money;
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled';
  customerId: string;
  paymentMethodId?: string;
  description?: string;
  metadata?: Record<string, string>;
  createdAt: Date;
  capturedAt?: Date;
  failureCode?: string;
  failureMessage?: string;
}

export interface Refund {
  id: string;
  transactionId: string;
  amount: Money;
  status: 'pending' | 'succeeded' | 'failed';
  reason?: string;
  createdAt: Date;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: any;
  createdAt: Date;
}

export interface WebhookResult {
  processed: boolean;
  event?: WebhookEvent;
  error?: string;
}

// Payment errors
export class PaymentProviderError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly provider: string,
    public readonly retriable: boolean = false
  ) {
    super(message);
    this.name = 'PaymentProviderError';
  }
}

// Main payment provider interface
export interface PaymentProvider {
  readonly name: string;
  readonly supportedCurrencies: string[];
  readonly supportedPaymentMethods: string[];

  // Customer management
  createCustomer(customer: Omit<Customer, 'id'>): Promise<Result<Customer, PaymentProviderError>>;
  updateCustomer(customerId: string, updates: Partial<Customer>): Promise<Result<Customer, PaymentProviderError>>;
  getCustomer(customerId: string): Promise<Result<Customer, PaymentProviderError>>;
  deleteCustomer(customerId: string): Promise<Result<void, PaymentProviderError>>;

  // Payment method management
  attachPaymentMethod(
    customerId: string,
    paymentMethod: Omit<PaymentMethod, 'id'>
  ): Promise<Result<PaymentMethod, PaymentProviderError>>;
  detachPaymentMethod(paymentMethodId: string): Promise<Result<void, PaymentProviderError>>;
  listPaymentMethods(customerId: string): Promise<Result<PaymentMethod[], PaymentProviderError>>;
  setDefaultPaymentMethod(
    customerId: string,
    paymentMethodId: string
  ): Promise<Result<void, PaymentProviderError>>;

  // Transaction operations
  charge(params: ChargeParams): Promise<Result<Transaction, PaymentProviderError>>;
  authorize(params: ChargeParams): Promise<Result<Transaction, PaymentProviderError>>;
  capture(transactionId: string, amount?: Money): Promise<Result<Transaction, PaymentProviderError>>;
  void(transactionId: string): Promise<Result<void, PaymentProviderError>>;
  
  // Refund operations
  refund(params: RefundParams): Promise<Result<Refund, PaymentProviderError>>;
  getRefund(refundId: string): Promise<Result<Refund, PaymentProviderError>>;

  // Transaction queries
  getTransaction(transactionId: string): Promise<Result<Transaction, PaymentProviderError>>;
  listTransactions(
    customerId: string,
    options?: {
      limit?: number;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<Result<Transaction[], PaymentProviderError>>;

  // Webhook handling
  constructWebhookEvent(
    payload: string | Buffer,
    signature: string
  ): Promise<Result<WebhookEvent, PaymentProviderError>>;
  handleWebhook(event: WebhookEvent): Promise<WebhookResult>;

  // Health and diagnostics
  healthCheck(): Promise<boolean>;
  getMetrics(): Promise<{
    successRate: number;
    averageLatency: number;
    totalTransactions: number;
  }>;
}

// Retry policy for payment operations
export interface RetryPolicy {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

export const defaultRetryPolicy: RetryPolicy = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryableErrors: [
    'network_error',
    'timeout',
    'rate_limit',
    'api_connection_error',
  ],
};

// Circuit breaker for payment provider resilience
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime?: number;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private readonly threshold: number = 5,
    private readonly timeout: number = 60000 // 1 minute
  ) {}

  async execute<T>(
    fn: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    // Check if circuit should be reset
    if (
      this.state === 'open' &&
      this.lastFailureTime &&
      Date.now() - this.lastFailureTime > this.timeout
    ) {
      this.state = 'half-open';
    }

    // If circuit is open, use fallback or throw
    if (this.state === 'open') {
      if (fallback) {
        return fallback();
      }
      throw new PaymentProviderError(
        'Circuit breaker is open',
        'circuit_breaker_open',
        'system',
        true
      );
    }

    try {
      const result = await fn();
      
      // Reset on success
      if (this.state === 'half-open') {
        this.state = 'closed';
        this.failures = 0;
      }
      
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();

      if (this.failures >= this.threshold) {
        this.state = 'open';
      }

      throw error;
    }
  }

  getState(): 'closed' | 'open' | 'half-open' {
    return this.state;
  }

  reset(): void {
    this.failures = 0;
    this.state = 'closed';
    this.lastFailureTime = undefined;
  }
}

// Idempotency key generator
export function generateIdempotencyKey(params: any): string {
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(params));
  return hash.digest('hex');
}

// Retry with exponential backoff
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  policy: RetryPolicy = defaultRetryPolicy
): Promise<T> {
  let lastError: Error | undefined;
  let delay = policy.initialDelay;

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable
      if (error instanceof PaymentProviderError) {
        if (!policy.retryableErrors.includes(error.code)) {
          throw error;
        }
      }

      // Don't retry on last attempt
      if (attempt === policy.maxAttempts) {
        break;
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Increase delay for next attempt
      delay = Math.min(delay * policy.backoffMultiplier, policy.maxDelay);
    }
  }

  throw lastError;
}