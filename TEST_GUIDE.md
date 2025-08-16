# Testing Guide - Bill Payment App

## Current Status
✅ Robust abstractions implemented
✅ Payment provider abstraction (Stripe + Mock)
✅ Repository pattern for data access
✅ Feature flags with A/B testing
🚧 UI partially complete (landing page only)
⏳ Authentication pages pending
⏳ Dashboard pending

## 1. Local Development Setup

### Prerequisites
```bash
# Install Node.js 20+ (check with)
node --version  # Should be v20.x.x or higher

# Install dependencies
cd /path/to/BillPaymentApp
npm install
```

### Environment Setup
Create `.env.local` file:
```env
# Supabase (from your Supabase dashboard)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Stripe (optional for now - will use mock provider)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# For testing, these can be dummy values
ENCRYPTION_KEY=12345678901234567890123456789012
```

### Start Development Server
```bash
npm run dev
```
Visit: http://localhost:3000

## 2. What You Can Test Now

### A. Landing Page
- Professional hero section with CTAs
- Feature showcase
- Mobile responsive design
- PWA installation prompt (on supported browsers)

### B. Feature Flags (Console Testing)
```javascript
// Open browser console at http://localhost:3000
// Test feature flags
const { config } = await import('/src/config/index.js');

// Check if Stripe payments are enabled
config.isFeatureEnabled('payment.stripe', { userId: 'test-user-1' });

// Check A/B test variant
config.getFeatureVariant('ui.darkmode', { userId: 'test-user-1' });
```

### C. Payment Provider (API Testing)
Create test file `test-payment.js`:
```javascript
import { paymentService } from './src/infrastructure/payments/index.js';

// Get mock provider for testing
const provider = paymentService.getProvider('mock');

// Create a test customer
const customerResult = await provider.createCustomer({
  email: 'test@example.com',
  name: 'Test User'
});

if (customerResult.ok) {
  console.log('Customer created:', customerResult.value);
  
  // Make a test charge
  const chargeResult = await provider.charge({
    amount: { amount: 1000, currency: 'GBP' }, // £10.00
    customerId: customerResult.value.id,
    description: 'Test charge'
  });
  
  console.log('Charge result:', chargeResult);
}
```

### D. Repository Pattern (Database Testing)
```javascript
// Test bill repository (requires Supabase setup)
import { billRepository } from './src/database/repositories/bills.js';

// Create a test bill
const billResult = await billRepository.create({
  user_id: 'test-user-id',
  biller_name: 'British Gas',
  biller_category: 'utilities',
  amount: 75.50,
  currency: 'GBP',
  due_date: new Date('2024-02-01'),
  frequency: 'monthly',
  status: 'pending',
  auto_pay: false
});

// Find upcoming bills
const upcomingResult = await billRepository.findUpcomingForUser('test-user-id', 30);
```

## 3. Check Build Status

### Cloudflare Pages
Your app should be deployed at: https://billpaymentapp.pages.dev
(Check Cloudflare dashboard for exact URL)

### GitHub Actions
Check build status: https://github.com/chudeemeke/billpaymentapp/actions

## 4. Next Steps I'll Implement

### Priority 1: Authentication (Today)
- [ ] Login page with Supabase Auth
- [ ] Register page with email verification
- [ ] Password reset flow
- [ ] Protected route middleware

### Priority 2: Dashboard (Tomorrow)
- [ ] Bills overview with stats
- [ ] Add/Edit bill forms
- [ ] Upcoming payments calendar
- [ ] Quick actions (pay now, schedule)

### Priority 3: Payment Flow
- [ ] Stripe Elements integration
- [ ] Payment confirmation page
- [ ] Receipt generation
- [ ] Payment history

### Priority 4: Notifications
- [ ] Email notifications via SendGrid
- [ ] SMS via Twilio (optional)
- [ ] In-app notifications
- [ ] Reminder scheduling

## 5. Testing Production Features

### Test Payment Provider Failover
```javascript
// Simulate Stripe failure, fallback to mock
const provider = await paymentService.getHealthyProvider();
console.log('Active provider:', provider.name);
```

### Test Logging & Metrics
```javascript
// Check structured logs in console
import { logger } from './src/utils/logger.js';

logger.info('Test event', { userId: 'test-123', action: 'payment' });
logger.metric({ name: 'payment.attempt', value: 1, unit: 'count' });
```

### Test Error Handling
```javascript
import { asyncErrorToResult } from './src/utils/errors.js';

const result = await asyncErrorToResult(async () => {
  // Some operation that might fail
  return await fetch('/api/bills');
});

if (result.ok) {
  console.log('Success:', result.value);
} else {
  console.log('Error:', result.error.message);
}
```

## 6. Architecture Visualization

```
┌─────────────────────────────────────────────┐
│            Next.js App (Cloudflare)         │
├─────────────────────────────────────────────┤
│                                             │
│  Pages           API Routes      Components │
│  ├─ /           ├─ /bills       ├─ Header  │
│  ├─ /login     ├─ /payments    ├─ BillCard│
│  └─ /dashboard └─ /webhooks    └─ PayForm │
│                                             │
├─────────────────────────────────────────────┤
│            Abstraction Layer                │
├─────────────────────────────────────────────┤
│                                             │
│  Repositories    Providers     Services    │
│  ├─ Bills       ├─ Stripe     ├─ Auth     │
│  ├─ Users      ├─ Mock       ├─ Notify   │
│  └─ Payments   └─ Square*    └─ Analytics │
│                                             │
├─────────────────────────────────────────────┤
│              Infrastructure                 │
├─────────────────────────────────────────────┤
│                                             │
│  Supabase         Stripe        SendGrid   │
│  (Database)      (Payments)   (Email)      │
│                                             │
└─────────────────────────────────────────────┘
```

## Common Issues & Solutions

### Issue: "Module not found" errors
```bash
# Clear cache and reinstall
rm -rf node_modules .next
npm install
npm run dev
```

### Issue: Supabase connection errors
- Check your `.env.local` has correct Supabase URL and keys
- Verify Supabase project is running
- Check RLS policies in Supabase dashboard

### Issue: Build failures on Cloudflare
- Check build logs in Cloudflare dashboard
- Ensure all env variables are set in Cloudflare Pages settings
- Verify Node version compatibility (v20+)

---

**Ready to test?** Start with `npm run dev` and visit http://localhost:3000