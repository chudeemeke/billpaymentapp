// Bills Repository with business-specific queries
import { BaseRepository, BaseEntity, Filter } from '../index';
import { Result, Ok, Err, DatabaseError } from '../../utils/errors';
import { measureAsync } from '../../utils/logger';

// Bill entity
export interface Bill extends BaseEntity {
  user_id: string;
  biller_name: string;
  biller_category: 'utilities' | 'insurance' | 'subscription' | 'loan' | 'credit_card' | 'other';
  amount: number;
  currency: 'GBP' | 'USD' | 'EUR';
  due_date: Date;
  frequency: 'one_time' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
  status: 'pending' | 'scheduled' | 'processing' | 'paid' | 'failed' | 'cancelled';
  auto_pay: boolean;
  payment_method_id?: string;
  reminder_days?: number;
  notes?: string;
  metadata?: Record<string, any>;
  last_paid_date?: Date;
  next_due_date?: Date;
}

// Spending summary type
export interface SpendingSummary {
  totalAmount: number;
  currency: string;
  billCount: number;
  byCategory: Record<string, { amount: number; count: number }>;
  byStatus: Record<string, { amount: number; count: number }>;
  averageAmount: number;
}

// Payment schedule
export interface PaymentSchedule {
  bill: Bill;
  scheduledDate: Date;
  amount: number;
}

export class BillRepository extends BaseRepository<Bill> {
  protected tableName = 'bills';

  // Find bills for a specific user
  async findByUserId(userId: string, includeDeleted = false): Promise<Result<Bill[], DatabaseError>> {
    const filters: Filter[] = [
      { column: 'user_id', operator: 'eq', value: userId }
    ];

    if (!includeDeleted) {
      filters.push({ column: 'deleted_at', operator: 'is', value: null });
    }

    return this.findByFilters(filters, {
      orderBy: 'due_date',
      orderDirection: 'asc'
    });
  }

  // Find upcoming bills for a user
  async findUpcomingForUser(
    userId: string,
    days: number = 30
  ): Promise<Result<Bill[], DatabaseError>> {
    return measureAsync('repository.bills.findUpcomingForUser', async () => {
      try {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + days);

        const { data, error } = await this.supabase
          .from(this.tableName)
          .select()
          .eq('user_id', userId)
          .gte('due_date', new Date().toISOString())
          .lte('due_date', futureDate.toISOString())
          .in('status', ['pending', 'scheduled'])
          .is('deleted_at', null)
          .order('due_date', { ascending: true });

        if (error) {
          return Err(new DatabaseError('findUpcomingForUser', error));
        }

        return Ok(data || []);
      } catch (error) {
        return Err(new DatabaseError('findUpcomingForUser', error as Error));
      }
    });
  }

  // Find overdue bills
  async findOverdueForUser(userId: string): Promise<Result<Bill[], DatabaseError>> {
    return measureAsync('repository.bills.findOverdueForUser', async () => {
      try {
        const { data, error } = await this.supabase
          .from(this.tableName)
          .select()
          .eq('user_id', userId)
          .lt('due_date', new Date().toISOString())
          .eq('status', 'pending')
          .is('deleted_at', null)
          .order('due_date', { ascending: true });

        if (error) {
          return Err(new DatabaseError('findOverdueForUser', error));
        }

        return Ok(data || []);
      } catch (error) {
        return Err(new DatabaseError('findOverdueForUser', error as Error));
      }
    });
  }

  // Find bills by category
  async findByCategory(
    userId: string,
    category: Bill['biller_category']
  ): Promise<Result<Bill[], DatabaseError>> {
    return this.findByFilters([
      { column: 'user_id', operator: 'eq', value: userId },
      { column: 'biller_category', operator: 'eq', value: category },
      { column: 'deleted_at', operator: 'is', value: null }
    ], {
      orderBy: 'due_date',
      orderDirection: 'asc'
    });
  }

  // Find bills with auto-pay enabled
  async findAutoPayBills(userId: string): Promise<Result<Bill[], DatabaseError>> {
    return this.findByFilters([
      { column: 'user_id', operator: 'eq', value: userId },
      { column: 'auto_pay', operator: 'eq', value: true },
      { column: 'status', operator: 'in', value: ['pending', 'scheduled'] },
      { column: 'deleted_at', operator: 'is', value: null }
    ], {
      orderBy: 'due_date',
      orderDirection: 'asc'
    });
  }

  // Get spending summary for a user
  async getSpendingSummary(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<Result<SpendingSummary, DatabaseError>> {
    return measureAsync('repository.bills.getSpendingSummary', async () => {
      try {
        let query = this.supabase
          .from(this.tableName)
          .select('amount, currency, biller_category, status')
          .eq('user_id', userId)
          .is('deleted_at', null);

        if (startDate) {
          query = query.gte('due_date', startDate.toISOString());
        }
        if (endDate) {
          query = query.lte('due_date', endDate.toISOString());
        }

        const { data, error } = await query;

        if (error) {
          return Err(new DatabaseError('getSpendingSummary', error));
        }

        const bills = data || [];
        const summary: SpendingSummary = {
          totalAmount: 0,
          currency: 'GBP', // Default, should handle multiple currencies
          billCount: bills.length,
          byCategory: {},
          byStatus: {},
          averageAmount: 0
        };

        for (const bill of bills) {
          summary.totalAmount += bill.amount;

          // By category
          if (!summary.byCategory[bill.biller_category]) {
            summary.byCategory[bill.biller_category] = { amount: 0, count: 0 };
          }
          summary.byCategory[bill.biller_category].amount += bill.amount;
          summary.byCategory[bill.biller_category].count++;

          // By status
          if (!summary.byStatus[bill.status]) {
            summary.byStatus[bill.status] = { amount: 0, count: 0 };
          }
          summary.byStatus[bill.status].amount += bill.amount;
          summary.byStatus[bill.status].count++;
        }

        summary.averageAmount = summary.billCount > 0 
          ? summary.totalAmount / summary.billCount 
          : 0;

        return Ok(summary);
      } catch (error) {
        return Err(new DatabaseError('getSpendingSummary', error as Error));
      }
    });
  }

  // Get payment schedule for upcoming bills
  async getPaymentSchedule(
    userId: string,
    days: number = 30
  ): Promise<Result<PaymentSchedule[], DatabaseError>> {
    return measureAsync('repository.bills.getPaymentSchedule', async () => {
      const upcomingResult = await this.findUpcomingForUser(userId, days);
      
      if (!upcomingResult.ok) {
        return upcomingResult as Result<never, DatabaseError>;
      }

      const schedule: PaymentSchedule[] = upcomingResult.value.map(bill => ({
        bill,
        scheduledDate: new Date(bill.due_date),
        amount: bill.amount
      }));

      // Sort by scheduled date
      schedule.sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime());

      return Ok(schedule);
    });
  }

  // Mark bill as paid
  async markAsPaid(
    billId: string,
    transactionId: string,
    paidDate: Date = new Date()
  ): Promise<Result<Bill, DatabaseError>> {
    return this.update(billId, {
      status: 'paid',
      last_paid_date: paidDate,
      metadata: {
        transaction_id: transactionId,
        paid_at: paidDate.toISOString()
      }
    });
  }

  // Mark bill as failed
  async markAsFailed(
    billId: string,
    reason: string,
    failureCode?: string
  ): Promise<Result<Bill, DatabaseError>> {
    return this.update(billId, {
      status: 'failed',
      metadata: {
        failure_reason: reason,
        failure_code: failureCode,
        failed_at: new Date().toISOString()
      }
    });
  }

  // Schedule a bill for payment
  async schedulePayment(
    billId: string,
    scheduledDate: Date
  ): Promise<Result<Bill, DatabaseError>> {
    return this.update(billId, {
      status: 'scheduled',
      metadata: {
        scheduled_date: scheduledDate.toISOString()
      }
    });
  }

  // Get bills that need reminders
  async getBillsNeedingReminders(days: number = 3): Promise<Result<Bill[], DatabaseError>> {
    return measureAsync('repository.bills.getBillsNeedingReminders', async () => {
      try {
        const reminderDate = new Date();
        reminderDate.setDate(reminderDate.getDate() + days);

        const { data, error } = await this.supabase
          .from(this.tableName)
          .select()
          .lte('due_date', reminderDate.toISOString())
          .gte('due_date', new Date().toISOString())
          .eq('status', 'pending')
          .not('reminder_days', 'is', null)
          .is('deleted_at', null);

        if (error) {
          return Err(new DatabaseError('getBillsNeedingReminders', error));
        }

        // Filter bills that actually need reminders based on their reminder_days setting
        const billsNeedingReminders = (data || []).filter(bill => {
          if (!bill.reminder_days) return false;
          
          const dueDate = new Date(bill.due_date);
          const reminderDate = new Date();
          reminderDate.setDate(reminderDate.getDate() + bill.reminder_days);
          
          return reminderDate >= dueDate;
        });

        return Ok(billsNeedingReminders);
      } catch (error) {
        return Err(new DatabaseError('getBillsNeedingReminders', error as Error));
      }
    });
  }

  // Clone a bill (for recurring bills)
  async cloneBill(
    billId: string,
    newDueDate: Date
  ): Promise<Result<Bill, DatabaseError>> {
    const originalResult = await this.findById(billId);
    
    if (!originalResult.ok) {
      return originalResult as Result<never, DatabaseError>;
    }

    if (!originalResult.value) {
      return Err(new DatabaseError('cloneBill', new Error('Bill not found')));
    }

    const original = originalResult.value;
    const { id, created_at, updated_at, ...billData } = original;

    return this.create({
      ...billData,
      due_date: newDueDate,
      status: 'pending',
      last_paid_date: undefined,
      metadata: {
        ...original.metadata,
        cloned_from: billId,
        cloned_at: new Date().toISOString()
      }
    });
  }

  // Update next due date for recurring bills
  async updateNextDueDate(billId: string): Promise<Result<Bill, DatabaseError>> {
    const billResult = await this.findById(billId);
    
    if (!billResult.ok) {
      return billResult as Result<never, DatabaseError>;
    }

    if (!billResult.value) {
      return Err(new DatabaseError('updateNextDueDate', new Error('Bill not found')));
    }

    const bill = billResult.value;
    let nextDueDate: Date | undefined;

    switch (bill.frequency) {
      case 'weekly':
        nextDueDate = new Date(bill.due_date);
        nextDueDate.setDate(nextDueDate.getDate() + 7);
        break;
      case 'monthly':
        nextDueDate = new Date(bill.due_date);
        nextDueDate.setMonth(nextDueDate.getMonth() + 1);
        break;
      case 'quarterly':
        nextDueDate = new Date(bill.due_date);
        nextDueDate.setMonth(nextDueDate.getMonth() + 3);
        break;
      case 'annually':
        nextDueDate = new Date(bill.due_date);
        nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
        break;
      default:
        // One-time bills don't have next due date
        return Ok(bill);
    }

    return this.update(billId, {
      next_due_date: nextDueDate
    });
  }
}

// Export singleton instance
export const billRepository = new BillRepository();