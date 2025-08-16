// Mock Payment Provider for Testing
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
} from '../../utils/payment-provider';
import { Ok, Err } from '../../utils/errors';

export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';
  readonly supportedCurrencies = ['GBP', 'USD', 'EUR'];
  readonly supportedPaymentMethods = ['card', 'bank_account'];

  private customers = new Map<string, Customer>();
  private paymentMethods = new Map<string, PaymentMethod>();
  private transactions = new Map<string, Transaction>();
  private refunds = new Map<string, Refund>();
  
  // Control test behavior
  public shouldFail = false;
  public failureCode = 'test_failure';
  public latency = 100; // ms

  constructor(options?: {
    shouldFail?: boolean;
    failureCode?: string;
    latency?: number;
  }) {
    if (options) {
      this.shouldFail = options.shouldFail || false;
      this.failureCode = options.failureCode || 'test_failure';
      this.latency = options.latency || 100;
    }
  }

  private async simulateLatency(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, this.latency));
  }

  private checkFailure(): Result<never, PaymentProviderError> | null {
    if (this.shouldFail) {
      return Err(
        new PaymentProviderError(
          'Mock failure for testing',
          this.failureCode,
          this.name,
          false
        )
      );
    }
    return null;
  }

  async createCustomer(
    customer: Omit<Customer, 'id'>
  ): Promise<Result<Customer, PaymentProviderError>> {
    await this.simulateLatency();
    const failure = this.checkFailure();
    if (failure) return failure;

    const newCustomer: Customer = {
      ...customer,
      id: `cus_mock_${Date.now()}`,
    };
    
    this.customers.set(newCustomer.id, newCustomer);
    return Ok(newCustomer);
  }

  async updateCustomer(
    customerId: string,
    updates: Partial<Customer>
  ): Promise<Result<Customer, PaymentProviderError>> {
    await this.simulateLatency();
    const failure = this.checkFailure();
    if (failure) return failure;

    const customer = this.customers.get(customerId);
    if (!customer) {
      return Err(
        new PaymentProviderError(
          'Customer not found',
          'customer_not_found',
          this.name,
          false
        )
      );
    }

    const updated = { ...customer, ...updates };
    this.customers.set(customerId, updated);
    return Ok(updated);
  }

  async getCustomer(customerId: string): Promise<Result<Customer, PaymentProviderError>> {
    await this.simulateLatency();
    const failure = this.checkFailure();
    if (failure) return failure;

    const customer = this.customers.get(customerId);
    if (!customer) {
      return Err(
        new PaymentProviderError(
          'Customer not found',
          'customer_not_found',
          this.name,
          false
        )
      );
    }

    return Ok(customer);
  }

  async deleteCustomer(customerId: string): Promise<Result<void, PaymentProviderError>> {
    await this.simulateLatency();
    const failure = this.checkFailure();
    if (failure) return failure;

    this.customers.delete(customerId);
    return Ok(undefined);
  }

  async attachPaymentMethod(
    customerId: string,
    paymentMethod: Omit<PaymentMethod, 'id'>
  ): Promise<Result<PaymentMethod, PaymentProviderError>> {
    await this.simulateLatency();
    const failure = this.checkFailure();
    if (failure) return failure;

    const newMethod: PaymentMethod = {
      ...paymentMethod,
      id: `pm_mock_${Date.now()}`,
    };

    this.paymentMethods.set(newMethod.id, newMethod);
    return Ok(newMethod);
  }

  async detachPaymentMethod(
    paymentMethodId: string
  ): Promise<Result<void, PaymentProviderError>> {
    await this.simulateLatency();
    const failure = this.checkFailure();
    if (failure) return failure;

    this.paymentMethods.delete(paymentMethodId);
    return Ok(undefined);
  }

  async listPaymentMethods(
    customerId: string
  ): Promise<Result<PaymentMethod[], PaymentProviderError>> {
    await this.simulateLatency();
    const failure = this.checkFailure();
    if (failure) return failure;

    // Return mock payment methods
    return Ok([
      {
        id: `pm_mock_1`,
        type: 'card',
        last4: '4242',
        brand: 'Visa',
        expiryMonth: 12,
        expiryYear: 2025,
        isDefault: true,
      },
    ]);
  }

  async setDefaultPaymentMethod(
    customerId: string,
    paymentMethodId: string
  ): Promise<Result<void, PaymentProviderError>> {
    await this.simulateLatency();
    const failure = this.checkFailure();
    if (failure) return failure;

    return Ok(undefined);
  }

  async charge(params: ChargeParams): Promise<Result<Transaction, PaymentProviderError>> {
    await this.simulateLatency();
    const failure = this.checkFailure();
    if (failure) return failure;

    const transaction: Transaction = {
      id: `pi_mock_${Date.now()}`,
      providerId: `pi_mock_${Date.now()}`,
      amount: params.amount,
      status: 'succeeded',
      customerId: params.customerId,
      paymentMethodId: params.paymentMethodId,
      description: params.description,
      metadata: params.metadata,
      createdAt: new Date(),
      capturedAt: params.captureImmediately ? new Date() : undefined,
    };

    this.transactions.set(transaction.id, transaction);
    return Ok(transaction);
  }

  async authorize(params: ChargeParams): Promise<Result<Transaction, PaymentProviderError>> {
    return this.charge({ ...params, captureImmediately: false });
  }

  async capture(
    transactionId: string,
    amount?: Money
  ): Promise<Result<Transaction, PaymentProviderError>> {
    await this.simulateLatency();
    const failure = this.checkFailure();
    if (failure) return failure;

    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      return Err(
        new PaymentProviderError(
          'Transaction not found',
          'transaction_not_found',
          this.name,
          false
        )
      );
    }

    transaction.capturedAt = new Date();
    transaction.status = 'succeeded';
    return Ok(transaction);
  }

  async void(transactionId: string): Promise<Result<void, PaymentProviderError>> {
    await this.simulateLatency();
    const failure = this.checkFailure();
    if (failure) return failure;

    const transaction = this.transactions.get(transactionId);
    if (transaction) {
      transaction.status = 'cancelled';
    }
    return Ok(undefined);
  }

  async refund(params: RefundParams): Promise<Result<Refund, PaymentProviderError>> {
    await this.simulateLatency();
    const failure = this.checkFailure();
    if (failure) return failure;

    const transaction = this.transactions.get(params.transactionId);
    if (!transaction) {
      return Err(
        new PaymentProviderError(
          'Transaction not found',
          'transaction_not_found',
          this.name,
          false
        )
      );
    }

    const refund: Refund = {
      id: `re_mock_${Date.now()}`,
      transactionId: params.transactionId,
      amount: params.amount || transaction.amount,
      status: 'succeeded',
      reason: params.reason,
      createdAt: new Date(),
    };

    this.refunds.set(refund.id, refund);
    return Ok(refund);
  }

  async getRefund(refundId: string): Promise<Result<Refund, PaymentProviderError>> {
    await this.simulateLatency();
    const failure = this.checkFailure();
    if (failure) return failure;

    const refund = this.refunds.get(refundId);
    if (!refund) {
      return Err(
        new PaymentProviderError(
          'Refund not found',
          'refund_not_found',
          this.name,
          false
        )
      );
    }

    return Ok(refund);
  }

  async getTransaction(
    transactionId: string
  ): Promise<Result<Transaction, PaymentProviderError>> {
    await this.simulateLatency();
    const failure = this.checkFailure();
    if (failure) return failure;

    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      return Err(
        new PaymentProviderError(
          'Transaction not found',
          'transaction_not_found',
          this.name,
          false
        )
      );
    }

    return Ok(transaction);
  }

  async listTransactions(
    customerId: string,
    options?: { limit?: number; startDate?: Date; endDate?: Date }
  ): Promise<Result<Transaction[], PaymentProviderError>> {
    await this.simulateLatency();
    const failure = this.checkFailure();
    if (failure) return failure;

    const customerTransactions = Array.from(this.transactions.values())
      .filter(t => t.customerId === customerId)
      .slice(0, options?.limit || 100);

    return Ok(customerTransactions);
  }

  async constructWebhookEvent(
    payload: string | Buffer,
    signature: string
  ): Promise<Result<WebhookEvent, PaymentProviderError>> {
    await this.simulateLatency();
    
    // Mock webhook validation
    if (signature !== 'valid_signature') {
      return Err(
        new PaymentProviderError(
          'Invalid webhook signature',
          'webhook_signature_invalid',
          this.name,
          false
        )
      );
    }

    const data = JSON.parse(payload.toString());
    return Ok({
      id: `evt_mock_${Date.now()}`,
      type: data.type || 'payment.succeeded',
      data: data,
      createdAt: new Date(),
    });
  }

  async handleWebhook(event: WebhookEvent): Promise<WebhookResult> {
    await this.simulateLatency();
    
    return {
      processed: true,
      event,
    };
  }

  async healthCheck(): Promise<boolean> {
    await this.simulateLatency();
    return !this.shouldFail;
  }

  async getMetrics(): Promise<{
    successRate: number;
    averageLatency: number;
    totalTransactions: number;
  }> {
    return {
      successRate: this.shouldFail ? 0 : 100,
      averageLatency: this.latency,
      totalTransactions: this.transactions.size,
    };
  }

  // Test helper methods
  reset(): void {
    this.customers.clear();
    this.paymentMethods.clear();
    this.transactions.clear();
    this.refunds.clear();
  }

  setFailure(shouldFail: boolean, code?: string): void {
    this.shouldFail = shouldFail;
    if (code) this.failureCode = code;
  }
}