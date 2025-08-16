// Payment Service Facade - Manages payment provider selection
import { PaymentProvider } from '../../utils/payment-provider';
import { StripePaymentProvider } from './stripe';
import { MockPaymentProvider } from './mock';
import { config } from '../../config';
import { logger } from '../../utils/logger';

export type PaymentProviderType = 'stripe' | 'mock' | 'square' | 'paypal';

class PaymentService {
  private providers: Map<PaymentProviderType, PaymentProvider> = new Map();
  private primaryProvider: PaymentProviderType = 'stripe';
  private fallbackProvider?: PaymentProviderType;

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // Initialize based on environment and configuration
    if (process.env.NODE_ENV === 'test') {
      this.providers.set('mock', new MockPaymentProvider());
      this.primaryProvider = 'mock';
    } else {
      // Initialize Stripe if configured
      if (process.env.STRIPE_SECRET_KEY) {
        try {
          this.providers.set('stripe', new StripePaymentProvider());
          this.primaryProvider = 'stripe';
          logger.info('Stripe payment provider initialized');
        } catch (error) {
          logger.error('Failed to initialize Stripe provider', error as Error);
        }
      }

      // Always have mock as fallback in development
      if (process.env.NODE_ENV === 'development') {
        this.providers.set('mock', new MockPaymentProvider());
        if (!this.providers.has('stripe')) {
          this.primaryProvider = 'mock';
          logger.warn('Using mock payment provider in development');
        }
      }
    }

    // Future: Add other providers
    // if (process.env.SQUARE_ACCESS_TOKEN) {
    //   this.providers.set('square', new SquarePaymentProvider());
    // }
  }

  getProvider(type?: PaymentProviderType): PaymentProvider {
    // Check feature flags for provider selection
    const userId = this.getCurrentUserId();
    if (userId && config.isFeatureEnabled('payment.provider.selection', { userId })) {
      const variant = config.getFeatureVariant('payment.provider', { userId });
      if (variant !== 'control' && this.providers.has(variant as PaymentProviderType)) {
        return this.providers.get(variant as PaymentProviderType)!;
      }
    }

    // Use specified provider if available
    if (type && this.providers.has(type)) {
      return this.providers.get(type)!;
    }

    // Use primary provider
    const primary = this.providers.get(this.primaryProvider);
    if (primary) {
      return primary;
    }

    // Use fallback if configured
    if (this.fallbackProvider) {
      const fallback = this.providers.get(this.fallbackProvider);
      if (fallback) {
        logger.warn('Using fallback payment provider', {
          fallback: this.fallbackProvider,
        });
        return fallback;
      }
    }

    throw new Error('No payment provider available');
  }

  async getProviderForCurrency(currency: string): Promise<PaymentProvider> {
    // Find provider that supports the currency
    for (const [type, provider] of this.providers) {
      if (provider.supportedCurrencies.includes(currency)) {
        const isHealthy = await provider.healthCheck();
        if (isHealthy) {
          return provider;
        }
      }
    }

    throw new Error(`No healthy provider found for currency: ${currency}`);
  }

  async getHealthyProvider(): Promise<PaymentProvider> {
    // Try primary first
    const primary = this.providers.get(this.primaryProvider);
    if (primary && await primary.healthCheck()) {
      return primary;
    }

    // Try other providers
    for (const [type, provider] of this.providers) {
      if (type !== this.primaryProvider && await provider.healthCheck()) {
        logger.warn('Primary payment provider unhealthy, using alternative', {
          primary: this.primaryProvider,
          alternative: type,
        });
        return provider;
      }
    }

    throw new Error('No healthy payment providers available');
  }

  setPrimaryProvider(type: PaymentProviderType): void {
    if (!this.providers.has(type)) {
      throw new Error(`Provider ${type} not initialized`);
    }
    this.primaryProvider = type;
    logger.info('Primary payment provider changed', { provider: type });
  }

  setFallbackProvider(type: PaymentProviderType): void {
    if (!this.providers.has(type)) {
      throw new Error(`Provider ${type} not initialized`);
    }
    this.fallbackProvider = type;
  }

  async getProviderMetrics(): Promise<
    Map<PaymentProviderType, {
      healthy: boolean;
      metrics: {
        successRate: number;
        averageLatency: number;
        totalTransactions: number;
      };
    }>
  > {
    const results = new Map();

    for (const [type, provider] of this.providers) {
      const healthy = await provider.healthCheck();
      const metrics = await provider.getMetrics();
      results.set(type, { healthy, metrics });
    }

    return results;
  }

  // Helper to get current user ID from context
  private getCurrentUserId(): string | undefined {
    // In a real app, this would come from the request context
    // For now, return undefined
    return undefined;
  }
}

// Export singleton instance
export const paymentService = new PaymentService();

// Export provider types for direct use
export { PaymentProvider } from '../../utils/payment-provider';
export { StripePaymentProvider } from './stripe';
export { MockPaymentProvider } from './mock';

// Re-export types
export type {
  Money,
  Customer,
  PaymentMethod,
  ChargeParams,
  RefundParams,
  Transaction,
  Refund,
  WebhookEvent,
  WebhookResult,
} from '../../utils/payment-provider';