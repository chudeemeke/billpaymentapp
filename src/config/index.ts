import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  APP_NAME: z.string().default('BillPaymentApp'),
  APP_URL: z.string().url(),

  // Database
  DATABASE_URL: z.string(),
  DB_POOL_MAX: z.string().transform(Number).default('20'),
  DB_POOL_MIN: z.string().transform(Number).default('5'),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().transform(Number).default('6379'),
  REDIS_PASSWORD: z.string().optional(),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  // TrueLayer
  TRUELAYER_CLIENT_ID: z.string(),
  TRUELAYER_CLIENT_SECRET: z.string(),
  TRUELAYER_ENVIRONMENT: z.enum(['sandbox', 'live']).default('sandbox'),

  // Stripe
  STRIPE_SECRET_KEY: z.string(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // Twilio
  TWILIO_ACCOUNT_SID: z.string(),
  TWILIO_AUTH_TOKEN: z.string(),
  TWILIO_PHONE_NUMBER: z.string(),

  // SendGrid
  SENDGRID_API_KEY: z.string(),
  SENDGRID_FROM_EMAIL: z.string().email(),

  // Security
  ENCRYPTION_KEY: z.string().min(32),
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),

  // Monitoring
  SENTRY_DSN: z.string().optional(),
  DATADOG_API_KEY: z.string().optional(),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // Feature Flags
  ENABLE_CREDIT_REPORTING: z.string().transform(val => val === 'true').default('false'),
  ENABLE_OCR_SCANNING: z.string().transform(val => val === 'true').default('false'),
  ENABLE_CARD_PAYMENTS: z.string().transform(val => val === 'true').default('true'),
});

type Config = z.infer<typeof envSchema>;

let config: Config;

try {
  config = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('Invalid environment configuration:');
    error.errors.forEach(err => {
      console.error(`  ${err.path.join('.')}: ${err.message}`);
    });
    process.exit(1);
  }
  throw error;
}

export { config };
export type { Config };