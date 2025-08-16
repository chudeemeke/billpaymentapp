import { z } from 'zod';

// Next.js compatible environment schema
const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NEXT_PUBLIC_APP_NAME: z.string().default('BillPaymentApp'),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),

  // Supabase (Next.js pattern)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  // Payment Providers
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  
  // Open Banking
  TRUELAYER_CLIENT_ID: z.string().optional(),
  TRUELAYER_CLIENT_SECRET: z.string().optional(),
  TRUELAYER_ENVIRONMENT: z.enum(['sandbox', 'live']).default('sandbox'),

  // Notification Providers
  SENDGRID_API_KEY: z.string().optional(),
  SENDGRID_FROM_EMAIL: z.string().email().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),

  // Security
  ENCRYPTION_KEY: z.string().min(32).optional(),
  
  // Monitoring
  SENTRY_DSN: z.string().optional(),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

type Config = z.infer<typeof envSchema>;

// Singleton configuration with lazy loading
class Configuration {
  private static instance: Configuration;
  private config: Config | null = null;
  private featureFlags: Map<string, FeatureFlag> = new Map();

  private constructor() {}

  static getInstance(): Configuration {
    if (!Configuration.instance) {
      Configuration.instance = new Configuration();
    }
    return Configuration.instance;
  }

  get(): Config {
    if (!this.config) {
      try {
        this.config = envSchema.parse(process.env);
      } catch (error) {
        if (error instanceof z.ZodError) {
          console.error('Invalid environment configuration:', error.errors);
          // In production, throw; in dev, use defaults
          if (process.env.NODE_ENV === 'production') {
            throw new Error('Invalid environment configuration');
          }
          // Use safe defaults for development
          this.config = envSchema.parse({});
        }
      }
    }
    return this.config!;
  }

  // Feature flags system with runtime updates
  isFeatureEnabled(flag: string, context?: FeatureFlagContext): boolean {
    const feature = this.featureFlags.get(flag);
    if (!feature) return false;

    // Check if feature is globally enabled
    if (!feature.enabled) return false;

    // Check rollout percentage
    if (feature.rolloutPercentage !== undefined && context?.userId) {
      const hash = this.hashUserId(context.userId);
      const bucket = hash % 100;
      if (bucket >= feature.rolloutPercentage) return false;
    }

    // Check user overrides
    if (context?.userId && feature.userOverrides?.has(context.userId)) {
      return feature.userOverrides.get(context.userId)!;
    }

    // Check group restrictions
    if (feature.groups && context?.groups) {
      const hasGroup = feature.groups.some(g => context.groups?.includes(g));
      if (!hasGroup) return false;
    }

    return true;
  }

  setFeatureFlag(flag: string, config: FeatureFlag): void {
    this.featureFlags.set(flag, config);
  }

  getFeatureVariant(experiment: string, context: FeatureFlagContext): string {
    const feature = this.featureFlags.get(experiment);
    if (!feature || !feature.variants) return 'control';

    const hash = this.hashUserId(context.userId);
    const bucket = hash % 100;
    
    let accumulated = 0;
    for (const [variant, percentage] of Object.entries(feature.variants)) {
      accumulated += percentage;
      if (bucket < accumulated) return variant;
    }
    
    return 'control';
  }

  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

// Feature flag types
interface FeatureFlag {
  enabled: boolean;
  rolloutPercentage?: number;
  groups?: string[];
  userOverrides?: Map<string, boolean>;
  variants?: Record<string, number>; // variant name -> percentage
  metadata?: Record<string, any>;
}

interface FeatureFlagContext {
  userId: string;
  groups?: string[];
  properties?: Record<string, any>;
}

// Export singleton instance
export const config = Configuration.getInstance();

// Initialize default feature flags
config.setFeatureFlag('payment.stripe', {
  enabled: true,
  rolloutPercentage: 100,
});

config.setFeatureFlag('payment.openbanking', {
  enabled: process.env.NODE_ENV === 'production',
  rolloutPercentage: 10, // Start with 10% rollout
});

config.setFeatureFlag('notifications.sms', {
  enabled: !!process.env.TWILIO_ACCOUNT_SID,
});

config.setFeatureFlag('ui.darkmode', {
  enabled: true,
  variants: {
    'auto': 60,    // 60% get auto dark mode
    'manual': 30,  // 30% get manual toggle
    'light': 10,   // 10% stay in light mode
  }
});

export type { Config, FeatureFlag, FeatureFlagContext };