// Structured logging with observability
import { AppError } from './errors';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface LogContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  traceId?: string;
  spanId?: string;
  [key: string]: any;
}

export interface Metric {
  name: string;
  value: number;
  unit?: 'ms' | 'bytes' | 'count' | 'percent';
  tags?: Record<string, string | number>;
}

export interface Span {
  name: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  startTime: number;
  endTime?: number;
  attributes?: Record<string, any>;
  status?: 'ok' | 'error';
  error?: Error;
}

// Logger interface for abstraction
export interface ILogger {
  error(message: string, error?: Error, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
  metric(metric: Metric): void;
  startSpan(name: string, parentSpan?: Span): Span;
  endSpan(span: Span, error?: Error): void;
}

// Production logger implementation
class StructuredLogger implements ILogger {
  private correlationId?: string;
  private defaultContext: LogContext = {};
  private spans: Map<string, Span> = new Map();
  private metrics: Metric[] = [];

  constructor(defaultContext?: LogContext) {
    this.defaultContext = defaultContext || {};
    
    // Batch send metrics every 10 seconds
    if (typeof window === 'undefined') {
      setInterval(() => this.flushMetrics(), 10000);
    }
  }

  private formatLog(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ): string {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...this.defaultContext,
      ...context,
      correlationId: this.correlationId,
    };

    if (error) {
      if (error instanceof AppError) {
        logEntry['error'] = error.toJSON();
      } else {
        logEntry['error'] = {
          name: error.name,
          message: error.message,
          stack: error.stack,
        };
      }
    }

    // In production, send to monitoring service
    if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
      this.sendToMonitoring(level, logEntry);
    }

    return JSON.stringify(logEntry);
  }

  error(message: string, error?: Error, context?: LogContext): void {
    const log = this.formatLog('error', message, context, error);
    console.error(log);
  }

  warn(message: string, context?: LogContext): void {
    const log = this.formatLog('warn', message, context);
    console.warn(log);
  }

  info(message: string, context?: LogContext): void {
    const log = this.formatLog('info', message, context);
    console.log(log);
  }

  debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV !== 'production') {
      const log = this.formatLog('debug', message, context);
      console.debug(log);
    }
  }

  metric(metric: Metric): void {
    this.metrics.push({
      ...metric,
      timestamp: Date.now(),
    });

    // In development, log metrics
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[METRIC] ${metric.name}: ${metric.value}${metric.unit || ''}`);
    }
  }

  startSpan(name: string, parentSpan?: Span): Span {
    const span: Span = {
      name,
      traceId: parentSpan?.traceId || this.generateId(),
      spanId: this.generateId(),
      parentSpanId: parentSpan?.spanId,
      startTime: Date.now(),
    };

    this.spans.set(span.spanId, span);
    return span;
  }

  endSpan(span: Span, error?: Error): void {
    span.endTime = Date.now();
    span.status = error ? 'error' : 'ok';
    span.error = error;

    const duration = span.endTime - span.startTime;
    
    // Log slow operations
    if (duration > 1000) {
      this.warn(`Slow operation: ${span.name}`, {
        duration,
        spanId: span.spanId,
        traceId: span.traceId,
      });
    }

    // Send to tracing service in production
    if (process.env.NODE_ENV === 'production') {
      this.sendTrace(span);
    }

    this.spans.delete(span.spanId);
  }

  setCorrelationId(id: string): void {
    this.correlationId = id;
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private flushMetrics(): void {
    if (this.metrics.length === 0) return;

    // In production, send to metrics service
    if (process.env.NODE_ENV === 'production') {
      this.sendMetrics(this.metrics);
    }

    this.metrics = [];
  }

  private sendToMonitoring(level: LogLevel, logEntry: any): void {
    // Integration with Sentry, DataDog, etc.
    // This would be implemented based on the monitoring service
  }

  private sendTrace(span: Span): void {
    // Send to OpenTelemetry, Jaeger, etc.
  }

  private sendMetrics(metrics: Metric[]): void {
    // Send to CloudWatch, Prometheus, etc.
  }
}

// Development logger with pretty printing
class DevelopmentLogger extends StructuredLogger {
  error(message: string, error?: Error, context?: LogContext): void {
    console.error(`❌ [ERROR] ${message}`, context, error);
  }

  warn(message: string, context?: LogContext): void {
    console.warn(`⚠️  [WARN] ${message}`, context);
  }

  info(message: string, context?: LogContext): void {
    console.log(`ℹ️  [INFO] ${message}`, context);
  }

  debug(message: string, context?: LogContext): void {
    console.debug(`🔍 [DEBUG] ${message}`, context);
  }
}

// Logger factory
function createLogger(): ILogger {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const defaultContext: LogContext = {
    service: process.env.NEXT_PUBLIC_APP_NAME || 'billpaymentapp',
    environment: process.env.NODE_ENV || 'development',
  };

  return isDevelopment 
    ? new DevelopmentLogger(defaultContext)
    : new StructuredLogger(defaultContext);
}

// Export singleton logger
export const logger = createLogger();

// Performance monitoring utilities
export function measureAsync<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const span = logger.startSpan(name);
  
  return fn()
    .then(result => {
      logger.endSpan(span);
      return result;
    })
    .catch(error => {
      logger.endSpan(span, error);
      throw error;
    });
}

export function measure<T>(
  name: string,
  fn: () => T
): T {
  const start = Date.now();
  
  try {
    const result = fn();
    const duration = Date.now() - start;
    
    logger.metric({
      name: `${name}.duration`,
      value: duration,
      unit: 'ms',
    });
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    
    logger.metric({
      name: `${name}.error`,
      value: 1,
      unit: 'count',
    });
    
    logger.error(`${name} failed`, error as Error, { duration });
    throw error;
  }
}