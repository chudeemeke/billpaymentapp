# BillPaymentApp - UK Bill Payment Platform

A Progressive Web App for UK residents to manage and pay bills, designed for those excluded from traditional direct debit services.

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Next.js API Routes + Supabase
- **Database**: PostgreSQL (via Supabase)
- **Authentication**: Supabase Auth
- **Payments**: TrueLayer (Open Banking) + Stripe (Cards)
- **Hosting**: Cloudflare Pages (Frontend) + Railway/Render (Backend)

## Zero-Cost Deployment Strategy

| Service | Provider | Free Tier Limits |
|---------|----------|------------------|
| Frontend | Cloudflare Pages | Unlimited bandwidth |
| Backend | Railway.app | $5 credit/month |
| Database | Supabase | 500MB, 50k requests |
| Auth | Supabase Auth | 50k MAU |
| File Storage | Cloudflare R2 | 10GB/month |

## Project Structure

```
/
├── app/                # Next.js app directory
│   ├── api/           # API routes
│   ├── (auth)/        # Auth pages
│   ├── dashboard/     # Main app
│   └── layout.tsx     # Root layout
├── components/        # React components
├── lib/              # Utilities and services
├── public/           # Static assets
└── supabase/         # Database migrations
```

## Development Setup

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Run development server
npm run dev

# Run database migrations
npm run db:migrate
```

## Features

### Phase 1 - MVP (Current)
- User registration with KYC
- Manual bill entry
- Open Banking payments via TrueLayer
- Payment history
- SMS reminders

### Phase 2 - Enhanced
- Bill scanning (OCR)
- Payment scheduling
- Card payments via Stripe
- Spending analytics

### Phase 3 - Scale
- Direct biller APIs
- Credit score reporting
- Advanced analytics

## Deployment

### Cloudflare Pages (Frontend)

1. Connect GitHub repository to Cloudflare Pages
2. Set build command: `npm run build`
3. Set output directory: `.next`
4. Add environment variables in Cloudflare dashboard

### Database Setup (Supabase)

1. Create free Supabase project
2. Run migrations: `npm run db:migrate`
3. Copy connection string to `.env`

## Security

- PCI DSS compliant (no card storage)
- GDPR compliant data handling
- Encrypted sensitive data
- Rate limiting on all APIs
- Comprehensive audit logging

## License

Proprietary - All rights reserved by Chude