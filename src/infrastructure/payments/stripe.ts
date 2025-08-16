// Stripe Payment Provider Implementation
import Stripe from 'stripe';
import {
  PaymentProvider,
  PaymentProviderError,
  Customer,
  PaymentMethod,
  ChargeParams,
  RefundParams,
  Transaction,
  Refund,
  WebhookEvent,
  WebhookResult,
  Money,
  Result,
  CircuitBreaker,
  retryWithBackoff,
  generateIdempotencyKey,
} from '../../utils/payment-provider';
import { Ok, Err } from '../../utils/errors';
import { logger, measureAsync } from '../../utils/logger';
import { config } from '../../config';

export class StripePaymentProvider implements PaymentProvider {
  readonly name = 'stripe';
  readonly supportedCurrencies = ['GBP', 'USD', 'EUR'];
  readonly supportedPaymentMethods = ['card', 'bank_account'];

  private stripe: Stripe;
  private circuitBreaker: CircuitBreaker;
  private metrics = {
    totalRequests: 0,
    successfulRequests: 0,
    totalLatency: 0,
  };

  constructor(apiKey?: string) {
    const key = apiKey || process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('Stripe API key is required');
    }

    this.stripe = new Stripe(key, {
      apiVersion: '2023-10-16',
      typescript: true,
      maxNetworkRetries: 0, // We handle retries ourselves
    });

    this.circuitBreaker = new CircuitBreaker(5, 60000);
  }

  // Customer Management
  async createCustomer(
    customer: Omit<Customer, 'id'>
  ): Promise<Result<Customer, PaymentProviderError>> {
    return this.executeWithMetrics('createCustomer', async () => {
      try {
        const stripeCustomer = await this.stripe.customers.create({
          email: customer.email,
          name: customer.name,
          metadata: customer.metadata,
        });

        return Ok(this.mapStripeCustomer(stripeCustomer));
      } catch (error) {
        return Err(this.mapStripeError(error as Stripe.StripeError));
      }
    });
  }

  async updateCustomer(
    customerId: string,
    updates: Partial<Customer>
  ): Promise<Result<Customer, PaymentProviderError>> {
    return this.executeWithMetrics('updateCustomer', async () => {
      try {
        const stripeCustomer = await this.stripe.customers.update(customerId, {
          email: updates.email,
          name: updates.name,
          metadata: updates.metadata,
        });

        return Ok(this.mapStripeCustomer(stripeCustomer));
      } catch (error) {
        return Err(this.mapStripeError(error as Stripe.StripeError));
      }
    });
  }

  async getCustomer(customerId: string): Promise<Result<Customer, PaymentProviderError>> {
    return this.executeWithMetrics('getCustomer', async () => {
      try {
        const stripeCustomer = await this.stripe.customers.retrieve(customerId);
        
        if (stripeCustomer.deleted) {
          return Err(
            new PaymentProviderError(
              'Customer has been deleted',
              'customer_deleted',
              this.name,
              false
            )
          );
        }

        return Ok(this.mapStripeCustomer(stripeCustomer as Stripe.Customer));
      } catch (error) {
        return Err(this.mapStripeError(error as Stripe.StripeError));
      }
    });
  }

  async deleteCustomer(customerId: string): Promise<Result<void, PaymentProviderError>> {
    return this.executeWithMetrics('deleteCustomer', async () => {
      try {
        await this.stripe.customers.del(customerId);
        return Ok(undefined);
      } catch (error) {
        return Err(this.mapStripeError(error as Stripe.StripeError));
      }
    });
  }

  // Payment Method Management
  async attachPaymentMethod(
    customerId: string,
    paymentMethod: Omit<PaymentMethod, 'id'>
  ): Promise<Result<PaymentMethod, PaymentProviderError>> {
    return this.executeWithMetrics('attachPaymentMethod', async () => {
      try {
        // In production, you'd create a payment method first via Stripe Elements
        // This is a simplified version
        const pm = await this.stripe.paymentMethods.attach(
          paymentMethod.id || '', // Would come from frontend
          { customer: customerId }
        );

        return Ok(this.mapStripePaymentMethod(pm));
      } catch (error) {
        return Err(this.mapStripeError(error as Stripe.StripeError));
      }
    });
  }

  async detachPaymentMethod(
    paymentMethodId: string
  ): Promise<Result<void, PaymentProviderError>> {
    return this.executeWithMetrics('detachPaymentMethod', async () => {
      try {
        await this.stripe.paymentMethods.detach(paymentMethodId);
        return Ok(undefined);
      } catch (error) {
        return Err(this.mapStripeError(error as Stripe.StripeError));
      }
    });
  }

  async listPaymentMethods(
    customerId: string
  ): Promise<Result<PaymentMethod[], PaymentProviderError>> {
    return this.executeWithMetrics('listPaymentMethods', async () => {
      try {
        const paymentMethods = await this.stripe.paymentMethods.list({
          customer: customerId,
          type: 'card',
        });

        return Ok(paymentMethods.data.map(pm => this.mapStripePaymentMethod(pm)));
      } catch (error) {
        return Err(this.mapStripeError(error as Stripe.StripeError));
      }
    });
  }

  async setDefaultPaymentMethod(
    customerId: string,
    paymentMethodId: string
  ): Promise<Result<void, PaymentProviderError>> {
    return this.executeWithMetrics('setDefaultPaymentMethod', async () => {
      try {
        await this.stripe.customers.update(customerId, {
          invoice_settings: {
            default_payment_method: paymentMethodId,
          },
        });
        return Ok(undefined);
      } catch (error) {
        return Err(this.mapStripeError(error as Stripe.StripeError));
      }
    });
  }

  // Transaction Operations
  async charge(params: ChargeParams): Promise<Result<Transaction, PaymentProviderError>> {
    return this.executeWithMetrics('charge', async () => {
      const idempotencyKey = params.idempotencyKey || generateIdempotencyKey(params);

      return retryWithBackoff(async () => {
        try {
          const paymentIntent = await this.stripe.paymentIntents.create(
            {
              amount: params.amount.amount,
              currency: params.amount.currency.toLowerCase(),
              customer: params.customerId,
              payment_method: params.paymentMethodId,
              description: params.description,
              metadata: params.metadata,
              confirm: true,
              capture_method: params.captureImmediately ? 'automatic' : 'manual',
            },
            {
              idempotencyKey,
            }
          );

          return Ok(this.mapStripePaymentIntent(paymentIntent));
        } catch (error) {
          const mappedError = this.mapStripeError(error as Stripe.StripeError);
          
          // Log payment failures for monitoring
          logger.error('Payment charge failed', mappedError, {
            customerId: params.customerId,
            amount: params.amount.amount,
            currency: params.amount.currency,
          });

          return Err(mappedError);
        }
      });
    });
  }

  async authorize(params: ChargeParams): Promise<Result<Transaction, PaymentProviderError>> {
    // Authorization is just a charge without immediate capture
    return this.charge({ ...params, captureImmediately: false });
  }

  async capture(
    transactionId: string,
    amount?: Money
  ): Promise<Result<Transaction, PaymentProviderError>> {
    return this.executeWithMetrics('capture', async () => {
      try {
        const paymentIntent = await this.stripe.paymentIntents.capture(
          transactionId,
          amount ? { amount_to_capture: amount.amount } : undefined
        );

        return Ok(this.mapStripePaymentIntent(paymentIntent));
      } catch (error) {
        return Err(this.mapStripeError(error as Stripe.StripeError));
      }
    });
  }

  async void(transactionId: string): Promise<Result<void, PaymentProviderError>> {
    return this.executeWithMetrics('void', async () => {
      try {
        await this.stripe.paymentIntents.cancel(transactionId);
        return Ok(undefined);
      } catch (error) {
        return Err(this.mapStripeError(error as Stripe.StripeError));
      }
    });
  }

  // Refund Operations
  async refund(params: RefundParams): Promise<Result<Refund, PaymentProviderError>> {
    return this.executeWithMetrics('refund', async () => {
      try {
        const stripeRefund = await this.stripe.refunds.create({
          payment_intent: params.transactionId,
          amount: params.amount?.amount,
          reason: params.reason,
          metadata: params.metadata,
        });

        return Ok(this.mapStripeRefund(stripeRefund));
      } catch (error) {
        return Err(this.mapStripeError(error as Stripe.StripeError));
      }
    });
  }

  async getRefund(refundId: string): Promise<Result<Refund, PaymentProviderError>> {
    return this.executeWithMetrics('getRefund', async () => {
      try {
        const stripeRefund = await this.stripe.refunds.retrieve(refundId);
        return Ok(this.mapStripeRefund(stripeRefund));
      } catch (error) {
        return Err(this.mapStripeError(error as Stripe.StripeError));
      }
    });
  }

  // Transaction Queries
  async getTransaction(
    transactionId: string
  ): Promise<Result<Transaction, PaymentProviderError>> {
    return this.executeWithMetrics('getTransaction', async () => {
      try {
        const paymentIntent = await this.stripe.paymentIntents.retrieve(transactionId);
        return Ok(this.mapStripePaymentIntent(paymentIntent));
      } catch (error) {
        return Err(this.mapStripeError(error as Stripe.StripeError));
      }
    });
  }

  async listTransactions(
    customerId: string,
    options?: { limit?: number; startDate?: Date; endDate?: Date }
  ): Promise<Result<Transaction[], PaymentProviderError>> {
    return this.executeWithMetrics('listTransactions', async () => {
      try {
        const params: Stripe.PaymentIntentListParams = {
          customer: customerId,
          limit: options?.limit || 100,
        };

        if (options?.startDate || options?.endDate) {
          params.created = {};
          if (options.startDate) {
            params.created.gte = Math.floor(options.startDate.getTime() / 1000);
          }
          if (options.endDate) {
            params.created.lte = Math.floor(options.endDate.getTime() / 1000);
          }
        }

        const paymentIntents = await this.stripe.paymentIntents.list(params);
        return Ok(paymentIntents.data.map(pi => this.mapStripePaymentIntent(pi)));
      } catch (error) {
        return Err(this.mapStripeError(error as Stripe.StripeError));
      }
    });
  }

  // Webhook Handling
  async constructWebhookEvent(
    payload: string | Buffer,
    signature: string
  ): Promise<Result<WebhookEvent, PaymentProviderError>> {
    try {
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) {
        return Err(
          new PaymentProviderError(
            'Webhook secret not configured',
            'webhook_config_error',
            this.name,
            false
          )
        );
      }

      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret
      );

      return Ok({
        id: event.id,
        type: event.type,
        data: event.data,
        createdAt: new Date(event.created * 1000),
      });
    } catch (error) {
      return Err(
        new PaymentProviderError(
          'Invalid webhook signature',
          'webhook_signature_invalid',
          this.name,
          false
        )
      );
    }
  }

  async handleWebhook(event: WebhookEvent): Promise<WebhookResult> {
    try {
      logger.info('Processing Stripe webhook', {
        eventId: event.id,
        eventType: event.type,
      });

      // Handle different event types
      switch (event.type) {
        case 'payment_intent.succeeded':
          // Update transaction status in database
          break;
        case 'payment_intent.payment_failed':
          // Handle failed payment
          break;
        case 'charge.refunded':
          // Update refund status
          break;
        default:
          logger.debug('Unhandled webhook event type', { type: event.type });
      }

      return {
        processed: true,
        event,
      };
    } catch (error) {
      logger.error('Webhook processing failed', error as Error, {
        eventId: event.id,
      });

      return {
        processed: false,
        error: (error as Error).message,
      };
    }
  }

  // Health and Diagnostics
  async healthCheck(): Promise<boolean> {
    try {
      // Try to retrieve balance as a health check
      await this.stripe.balance.retrieve();
      return true;
    } catch {
      return false;
    }
  }

  async getMetrics(): Promise<{
    successRate: number;
    averageLatency: number;
    totalTransactions: number;
  }> {
    const successRate =
      this.metrics.totalRequests > 0
        ? (this.metrics.successfulRequests / this.metrics.totalRequests) * 100
        : 0;

    const averageLatency =
      this.metrics.totalRequests > 0
        ? this.metrics.totalLatency / this.metrics.totalRequests
        : 0;

    return {
      successRate,
      averageLatency,
      totalTransactions: this.metrics.totalRequests,
    };
  }

  // Private helper methods
  private async executeWithMetrics<T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      const result = await this.circuitBreaker.execute(() =>
        measureAsync(`stripe.${operation}`, fn)
      );
      
      this.metrics.successfulRequests++;
      return result;
    } finally {
      this.metrics.totalLatency += Date.now() - startTime;
    }
  }

  private mapStripeCustomer(customer: Stripe.Customer): Customer {
    return {
      id: customer.id,
      email: customer.email || '',
      name: customer.name || undefined,
      metadata: customer.metadata as Record<string, string>,
    };
  }

  private mapStripePaymentMethod(pm: Stripe.PaymentMethod): PaymentMethod {
    return {
      id: pm.id,
      type: pm.type as 'card' | 'bank_account',
      last4: pm.card?.last4,
      brand: pm.card?.brand,
      expiryMonth: pm.card?.exp_month,
      expiryYear: pm.card?.exp_year,
    };
  }

  private mapStripePaymentIntent(pi: Stripe.PaymentIntent): Transaction {
    return {
      id: pi.id,
      providerId: pi.id,
      amount: {
        amount: pi.amount,
        currency: pi.currency.toUpperCase() as 'GBP' | 'USD' | 'EUR',
      },
      status: this.mapPaymentIntentStatus(pi.status),
      customerId: pi.customer as string,
      paymentMethodId: pi.payment_method as string | undefined,
      description: pi.description || undefined,
      metadata: pi.metadata as Record<string, string>,
      createdAt: new Date(pi.created * 1000),
      capturedAt: pi.amount_received > 0 ? new Date() : undefined,
      failureCode: pi.last_payment_error?.code,
      failureMessage: pi.last_payment_error?.message,
    };
  }

  private mapPaymentIntentStatus(
    status: Stripe.PaymentIntent.Status
  ): Transaction['status'] {
    switch (status) {
      case 'requires_payment_method':
      case 'requires_confirmation':
      case 'requires_action':
        return 'pending';
      case 'processing':
        return 'processing';
      case 'succeeded':
        return 'succeeded';
      case 'canceled':
        return 'cancelled';
      default:
        return 'failed';
    }
  }

  private mapStripeRefund(refund: Stripe.Refund): Refund {
    return {
      id: refund.id,
      transactionId: refund.payment_intent as string,
      amount: {
        amount: refund.amount,
        currency: refund.currency.toUpperCase() as 'GBP' | 'USD' | 'EUR',
      },
      status: refund.status === 'succeeded' ? 'succeeded' : 
              refund.status === 'failed' ? 'failed' : 'pending',
      reason: refund.reason || undefined,
      createdAt: new Date(refund.created * 1000),
    };
  }

  private mapStripeError(error: Stripe.StripeError): PaymentProviderError {
    const retriableErrors = [
      'api_connection_error',
      'rate_limit_error',
      'idempotency_error',
    ];

    return new PaymentProviderError(
      error.message,
      error.code || 'unknown_error',
      this.name,
      retriableErrors.includes(error.type)
    );
  }
}