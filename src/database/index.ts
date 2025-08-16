// Base Repository Pattern with Supabase
import { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '../lib/supabase/server';
import { Result, Ok, Err, DatabaseError, NotFoundError } from '../utils/errors';
import { logger, measureAsync } from '../utils/logger';

// Base entity interface
export interface BaseEntity {
  id: string;
  created_at: Date;
  updated_at: Date;
}

// Query options for repositories
export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  select?: string;
}

// Filter operators
export type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'in' | 'is';

// Filter definition
export interface Filter {
  column: string;
  operator: FilterOperator;
  value: any;
}

// Transaction support
export interface Transaction {
  id: string;
  operations: Array<() => Promise<any>>;
  rollback: () => Promise<void>;
}

// Base repository abstract class
export abstract class BaseRepository<T extends BaseEntity> {
  protected supabase: SupabaseClient;
  protected abstract tableName: string;

  constructor(supabase?: SupabaseClient) {
    this.supabase = supabase || this.createClient();
  }

  private async createClient(): Promise<SupabaseClient> {
    // For server-side, use server client
    if (typeof window === 'undefined') {
      return await createClient();
    }
    
    // For client-side, use browser client
    const { createBrowserClient } = await import('../lib/supabase/client');
    return createBrowserClient();
  }

  // CREATE
  async create(data: Omit<T, 'id' | 'created_at' | 'updated_at'>): Promise<Result<T, DatabaseError>> {
    return measureAsync(`repository.${this.tableName}.create`, async () => {
      try {
        const { data: created, error } = await this.supabase
          .from(this.tableName)
          .insert(data)
          .select()
          .single();

        if (error) {
          logger.error(`Failed to create ${this.tableName}`, error, { data });
          return Err(new DatabaseError('create', error));
        }

        logger.debug(`Created ${this.tableName}`, { id: created.id });
        return Ok(created);
      } catch (error) {
        logger.error(`Unexpected error creating ${this.tableName}`, error as Error);
        return Err(new DatabaseError('create', error as Error));
      }
    });
  }

  // READ
  async findById(id: string): Promise<Result<T | null, DatabaseError>> {
    return measureAsync(`repository.${this.tableName}.findById`, async () => {
      try {
        const { data, error } = await this.supabase
          .from(this.tableName)
          .select()
          .eq('id', id)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            // No rows returned
            return Ok(null);
          }
          logger.error(`Failed to find ${this.tableName} by id`, error, { id });
          return Err(new DatabaseError('findById', error));
        }

        return Ok(data);
      } catch (error) {
        logger.error(`Unexpected error finding ${this.tableName}`, error as Error);
        return Err(new DatabaseError('findById', error as Error));
      }
    });
  }

  async findByIdOrThrow(id: string): Promise<Result<T, DatabaseError | NotFoundError>> {
    const result = await this.findById(id);
    
    if (!result.ok) {
      return result;
    }

    if (!result.value) {
      return Err(new NotFoundError(this.tableName, id));
    }

    return Ok(result.value);
  }

  async findAll(options?: QueryOptions): Promise<Result<T[], DatabaseError>> {
    return measureAsync(`repository.${this.tableName}.findAll`, async () => {
      try {
        let query = this.supabase.from(this.tableName).select(options?.select || '*');

        if (options?.limit) {
          query = query.limit(options.limit);
        }
        if (options?.offset) {
          query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
        }
        if (options?.orderBy) {
          query = query.order(options.orderBy, { 
            ascending: options.orderDirection !== 'desc' 
          });
        }

        const { data, error } = await query;

        if (error) {
          logger.error(`Failed to find all ${this.tableName}`, error);
          return Err(new DatabaseError('findAll', error));
        }

        return Ok(data || []);
      } catch (error) {
        logger.error(`Unexpected error finding all ${this.tableName}`, error as Error);
        return Err(new DatabaseError('findAll', error as Error));
      }
    });
  }

  async findByFilters(
    filters: Filter[],
    options?: QueryOptions
  ): Promise<Result<T[], DatabaseError>> {
    return measureAsync(`repository.${this.tableName}.findByFilters`, async () => {
      try {
        let query = this.supabase.from(this.tableName).select(options?.select || '*');

        // Apply filters
        for (const filter of filters) {
          switch (filter.operator) {
            case 'eq':
              query = query.eq(filter.column, filter.value);
              break;
            case 'neq':
              query = query.neq(filter.column, filter.value);
              break;
            case 'gt':
              query = query.gt(filter.column, filter.value);
              break;
            case 'gte':
              query = query.gte(filter.column, filter.value);
              break;
            case 'lt':
              query = query.lt(filter.column, filter.value);
              break;
            case 'lte':
              query = query.lte(filter.column, filter.value);
              break;
            case 'like':
              query = query.like(filter.column, filter.value);
              break;
            case 'ilike':
              query = query.ilike(filter.column, filter.value);
              break;
            case 'in':
              query = query.in(filter.column, filter.value);
              break;
            case 'is':
              query = query.is(filter.column, filter.value);
              break;
          }
        }

        // Apply options
        if (options?.limit) {
          query = query.limit(options.limit);
        }
        if (options?.offset) {
          query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
        }
        if (options?.orderBy) {
          query = query.order(options.orderBy, {
            ascending: options.orderDirection !== 'desc'
          });
        }

        const { data, error } = await query;

        if (error) {
          logger.error(`Failed to find ${this.tableName} by filters`, error, { filters });
          return Err(new DatabaseError('findByFilters', error));
        }

        return Ok(data || []);
      } catch (error) {
        logger.error(`Unexpected error finding ${this.tableName} by filters`, error as Error);
        return Err(new DatabaseError('findByFilters', error as Error));
      }
    });
  }

  // UPDATE
  async update(
    id: string,
    updates: Partial<Omit<T, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<Result<T, DatabaseError>> {
    return measureAsync(`repository.${this.tableName}.update`, async () => {
      try {
        const { data, error } = await this.supabase
          .from(this.tableName)
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select()
          .single();

        if (error) {
          logger.error(`Failed to update ${this.tableName}`, error, { id, updates });
          return Err(new DatabaseError('update', error));
        }

        logger.debug(`Updated ${this.tableName}`, { id });
        return Ok(data);
      } catch (error) {
        logger.error(`Unexpected error updating ${this.tableName}`, error as Error);
        return Err(new DatabaseError('update', error as Error));
      }
    });
  }

  // DELETE
  async delete(id: string): Promise<Result<void, DatabaseError>> {
    return measureAsync(`repository.${this.tableName}.delete`, async () => {
      try {
        const { error } = await this.supabase
          .from(this.tableName)
          .delete()
          .eq('id', id);

        if (error) {
          logger.error(`Failed to delete ${this.tableName}`, error, { id });
          return Err(new DatabaseError('delete', error));
        }

        logger.debug(`Deleted ${this.tableName}`, { id });
        return Ok(undefined);
      } catch (error) {
        logger.error(`Unexpected error deleting ${this.tableName}`, error as Error);
        return Err(new DatabaseError('delete', error as Error));
      }
    });
  }

  // Soft delete (if supported)
  async softDelete(id: string): Promise<Result<T, DatabaseError>> {
    return this.update(id, { deleted_at: new Date() } as any);
  }

  // Batch operations
  async createMany(
    items: Array<Omit<T, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<Result<T[], DatabaseError>> {
    return measureAsync(`repository.${this.tableName}.createMany`, async () => {
      try {
        const { data, error } = await this.supabase
          .from(this.tableName)
          .insert(items)
          .select();

        if (error) {
          logger.error(`Failed to create many ${this.tableName}`, error);
          return Err(new DatabaseError('createMany', error));
        }

        logger.debug(`Created ${data?.length || 0} ${this.tableName} records`);
        return Ok(data || []);
      } catch (error) {
        logger.error(`Unexpected error creating many ${this.tableName}`, error as Error);
        return Err(new DatabaseError('createMany', error as Error));
      }
    });
  }

  async updateMany(
    filters: Filter[],
    updates: Partial<Omit<T, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<Result<T[], DatabaseError>> {
    return measureAsync(`repository.${this.tableName}.updateMany`, async () => {
      try {
        let query = this.supabase
          .from(this.tableName)
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          });

        // Apply filters
        for (const filter of filters) {
          if (filter.operator === 'eq') {
            query = query.eq(filter.column, filter.value);
          }
          // Add other operators as needed
        }

        const { data, error } = await query.select();

        if (error) {
          logger.error(`Failed to update many ${this.tableName}`, error);
          return Err(new DatabaseError('updateMany', error));
        }

        logger.debug(`Updated ${data?.length || 0} ${this.tableName} records`);
        return Ok(data || []);
      } catch (error) {
        logger.error(`Unexpected error updating many ${this.tableName}`, error as Error);
        return Err(new DatabaseError('updateMany', error as Error));
      }
    });
  }

  async deleteMany(filters: Filter[]): Promise<Result<void, DatabaseError>> {
    return measureAsync(`repository.${this.tableName}.deleteMany`, async () => {
      try {
        let query = this.supabase.from(this.tableName).delete();

        // Apply filters
        for (const filter of filters) {
          if (filter.operator === 'eq') {
            query = query.eq(filter.column, filter.value);
          }
          // Add other operators as needed
        }

        const { error } = await query;

        if (error) {
          logger.error(`Failed to delete many ${this.tableName}`, error);
          return Err(new DatabaseError('deleteMany', error));
        }

        logger.debug(`Deleted multiple ${this.tableName} records`);
        return Ok(undefined);
      } catch (error) {
        logger.error(`Unexpected error deleting many ${this.tableName}`, error as Error);
        return Err(new DatabaseError('deleteMany', error as Error));
      }
    });
  }

  // Count
  async count(filters?: Filter[]): Promise<Result<number, DatabaseError>> {
    return measureAsync(`repository.${this.tableName}.count`, async () => {
      try {
        let query = this.supabase
          .from(this.tableName)
          .select('*', { count: 'exact', head: true });

        // Apply filters if provided
        if (filters) {
          for (const filter of filters) {
            if (filter.operator === 'eq') {
              query = query.eq(filter.column, filter.value);
            }
            // Add other operators as needed
          }
        }

        const { count, error } = await query;

        if (error) {
          logger.error(`Failed to count ${this.tableName}`, error);
          return Err(new DatabaseError('count', error));
        }

        return Ok(count || 0);
      } catch (error) {
        logger.error(`Unexpected error counting ${this.tableName}`, error as Error);
        return Err(new DatabaseError('count', error as Error));
      }
    });
  }

  // Existence check
  async exists(id: string): Promise<Result<boolean, DatabaseError>> {
    const result = await this.findById(id);
    if (!result.ok) {
      return result as Result<never, DatabaseError>;
    }
    return Ok(result.value !== null);
  }
}