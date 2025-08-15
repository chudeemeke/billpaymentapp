# BillPaymentApp - Technical Architecture Document

**Project**: UK Bill Payment Platform for Credit-Excluded Individuals  
**Version**: 1.0  
**Date**: August 15, 2025  
**Document Type**: Technical Architecture Specification  

## Executive Summary

BillPaymentApp is a UK-focused fintech solution addressing bill payment accessibility for individuals excluded from traditional direct debit services due to credit history. The platform provides unified bill management, multiple payment rails, and credit rebuilding pathways.

## System Architecture Overview

### High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Mobile App    │    │   Web Portal    │    │  Admin Panel    │
│  (React Native)│    │    (React)      │    │    (React)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   API Gateway   │
                    │   (Kong/AWS)    │
                    └─────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  User Service   │    │  Bill Service   │    │ Payment Service │
│   (Node.js)     │    │   (Node.js)     │    │   (Node.js)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   PostgreSQL    │
                    │   (Primary DB)  │
                    └─────────────────┘
```

### Microservices Architecture

#### 1. User Service
- **Purpose**: Authentication, KYC, user management
- **Technology**: Node.js + Express + TypeScript
- **Database**: PostgreSQL (user data, KYC status)
- **External Integrations**: 
  - Onfido/Jumio (Identity verification)
  - Auth0/AWS Cognito (Authentication)

#### 2. Bill Management Service
- **Purpose**: Bill CRUD, reminders, scheduling
- **Technology**: Node.js + Express + TypeScript
- **Database**: PostgreSQL (bills, schedules)
- **Features**:
  - OCR bill scanning
  - Payment scheduling
  - Reminder notifications

#### 3. Payment Processing Service
- **Purpose**: Multi-rail payment execution
- **Technology**: Node.js + Express + TypeScript
- **Database**: PostgreSQL (transactions, payment history)
- **Payment Rails**:
  - Open Banking (TrueLayer/Yapily)
  - Card payments (Stripe)
  - Bank transfers (Faster Payments)

#### 4. Biller Integration Service
- **Purpose**: Direct biller API management
- **Technology**: Node.js + Express + TypeScript
- **Database**: PostgreSQL (biller configurations)
- **Integrations**:
  - Utility companies (British Gas, EDF, etc.)
  - Local councils (council tax)
  - Telecoms (BT, Sky, Virgin, etc.)

#### 5. Notification Service
- **Purpose**: SMS, push, email notifications
- **Technology**: Node.js + Express
- **External Services**:
  - Twilio (SMS)
  - Firebase (Push notifications)
  - SendGrid (Email)

#### 6. Analytics & Reporting Service
- **Purpose**: Credit building insights, spending analytics
- **Technology**: Node.js + Express
- **Database**: PostgreSQL + Redis (caching)

## Data Architecture

### Core Data Models

#### User
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    kyc_status ENUM('pending', 'verified', 'rejected'),
    credit_building_opt_in BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Bill
```sql
CREATE TABLE bills (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    biller_name VARCHAR(255) NOT NULL,
    biller_type ENUM('utility', 'council', 'telecom', 'other'),
    account_number VARCHAR(100),
    amount DECIMAL(10,2),
    due_date DATE,
    payment_method ENUM('bank_transfer', 'card', 'open_banking'),
    status ENUM('pending', 'scheduled', 'paid', 'failed'),
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### Transaction
```sql
CREATE TABLE transactions (
    id UUID PRIMARY KEY,
    bill_id UUID REFERENCES bills(id),
    user_id UUID REFERENCES users(id),
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50),
    external_transaction_id VARCHAR(255),
    status ENUM('pending', 'completed', 'failed', 'refunded'),
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Security Architecture

### Data Protection
- **Encryption**: AES-256 at rest, TLS 1.3 in transit
- **PCI DSS**: Level 1 compliance for card data
- **Tokenization**: Payment data tokenized via payment processors
- **Key Management**: AWS KMS or HashiCorp Vault

### Authentication & Authorization
- **Multi-factor Authentication**: SMS + Biometric
- **JWT Tokens**: Short-lived access tokens
- **Role-based Access Control**: User/Admin/Support roles
- **API Security**: Rate limiting, IP whitelisting

### Fraud Prevention
- **Transaction Monitoring**: Real-time fraud detection
- **Velocity Checks**: Transaction frequency limits
- **Device Fingerprinting**: Trusted device management
- **Machine Learning**: Anomaly detection patterns

## Integration Architecture

### Payment Rails

#### Open Banking Integration
```typescript
interface OpenBankingProvider {
  provider: 'truelayer' | 'yapily';
  accountLinking(): Promise<AccountLinkResult>;
  initiatePayment(payment: PaymentRequest): Promise<PaymentResult>;
  getAccountBalance(accountId: string): Promise<Balance>;
}
```

#### Card Payment Integration
```typescript
interface CardPaymentProvider {
  provider: 'stripe';
  processPayment(payment: CardPaymentRequest): Promise<PaymentResult>;
  setupSavedCard(customerId: string): Promise<PaymentMethod>;
  processRefund(transactionId: string): Promise<RefundResult>;
}
```

### Biller Integrations

#### Direct API Integration
```typescript
interface BillerAPI {
  billerName: string;
  apiEndpoint: string;
  authentication: 'api_key' | 'oauth2' | 'basic_auth';
  paymentMethods: PaymentMethod[];
  makePayment(payment: BillerPaymentRequest): Promise<BillerPaymentResult>;
}
```

## Deployment Architecture

### Infrastructure (AWS-based)

#### Production Environment
- **Compute**: EKS (Kubernetes) for microservices
- **Database**: RDS PostgreSQL with Multi-AZ
- **Cache**: ElastiCache Redis
- **Storage**: S3 for documents/images
- **CDN**: CloudFront for static assets
- **Monitoring**: CloudWatch + DataDog

#### Development/Staging
- **Compute**: ECS Fargate
- **Database**: RDS PostgreSQL (smaller instance)
- **Environment**: Isolated VPC per environment

### CI/CD Pipeline
```yaml
# GitHub Actions workflow
name: Deploy BillPaymentApp
on:
  push:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm test
      - run: npm run test:integration
  
  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - run: docker build -t billpayapp .
      - run: kubectl apply -f k8s/
```

## Scalability Considerations

### Performance Targets
- **Response Time**: < 200ms for API calls
- **Throughput**: 1000 transactions/minute
- **Availability**: 99.9% uptime SLA
- **Concurrent Users**: 10,000 active users

### Scaling Strategy
- **Horizontal Scaling**: Kubernetes auto-scaling
- **Database Scaling**: Read replicas for analytics
- **Caching Strategy**: Redis for session data
- **CDN**: Static asset optimization

## Monitoring & Observability

### Application Monitoring
- **APM**: DataDog/New Relic for performance monitoring
- **Logging**: Centralized logging with ELK stack
- **Metrics**: Prometheus + Grafana dashboards
- **Alerting**: PagerDuty for critical issues

### Business Metrics
- **Payment Success Rate**: Target 99.5%
- **User Acquisition Cost**: Track via analytics
- **Monthly Active Users**: Growth tracking
- **Credit Score Impact**: Long-term user outcomes

## Technology Stack Summary

| Component | Technology | Justification |
|-----------|------------|---------------|
| Mobile App | React Native | Cross-platform, single codebase |
| Web Frontend | React + TypeScript | Industry standard, team expertise |
| Backend Services | Node.js + Express | JavaScript ecosystem, rapid development |
| Database | PostgreSQL | ACID compliance, financial data requirements |
| Payment Processing | Stripe + TrueLayer | Proven fintech providers |
| Infrastructure | AWS | Compliance, security, scalability |
| Monitoring | DataDog | Comprehensive observability |

## Risk Assessment

### Technical Risks
- **Payment Rail Downtime**: Multiple provider fallbacks
- **Database Performance**: Optimized queries, read replicas
- **Security Breaches**: Comprehensive security auditing

### Business Risks
- **Regulatory Changes**: Ongoing compliance monitoring
- **Market Competition**: Focus on credit rebuilding USP
- **User Adoption**: Intuitive UX for target demographic

---

**Document Approval**:
- Technical Lead: ________________
- Security Officer: _______________
- Compliance Officer: ____________
- Project Manager: _______________