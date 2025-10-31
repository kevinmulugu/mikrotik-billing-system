# Database Schema Refactor Plan

## Problem Statement

Currently, there's confusion between `users` and `customers` collections. The system mixes business
logic (businessInfo, paymentSettings, subscriptions) into customers when these should be user-level
properties.

## Current Schema Issues

### Users Collection (Current - Incorrect)

- Used for authentication only
- Has customerId reference
- Missing business-level fields

### Customers Collection (Current - Incorrect)

- Has businessInfo, paymentSettings, subscription, statistics, status
- Mixed with MikroTik voucher customers (WiFi end-users)
- Confusing dual purpose

## New Schema Design

### Users Collection (New - Correct)

**Purpose**: All authenticated users (homeowners, ISPs, admins) who can login

```typescript
{
  _id: ObjectId,
  name: string,
  email: string (unique),
  emailVerified: Date | null,
  image: string | null,
  password: string (hashed),
  role: 'homeowner' | 'personal' | 'isp' | 'enterprise' | 'admin',

  // MOVED FROM CUSTOMERS:
  businessInfo: {
    type: 'personal' | 'homeowner' | 'isp' | 'enterprise',
    companyName: string | null,
    businessRegistration: string | null,
    taxId: string | null,
    phone: string,
    address: {
      street: string,
      city: string,
      state: string,
      country: string,
      postalCode: string
    }
  },

  paymentSettings: {
    paybillNumber: string | null,
    tillNumber: string | null,
    consumerKey: string | null,
    consumerSecret: string | null,
    passkey: string | null,
    shortcode: string | null,
    callbackUrl: string | null,
    environment: 'sandbox' | 'production'
  },

  subscription: {
    plan: 'free' | 'basic' | 'standard' | 'premium' | 'enterprise',
    status: 'active' | 'inactive' | 'cancelled' | 'suspended',
    startDate: Date,
    endDate: Date | null,
    routerLimit: number,
    monthlyFee: number,
    paymentMethod: 'mpesa' | 'bank' | 'card',
    lastPaymentDate: Date | null,
    nextPaymentDate: Date | null
  },

  statistics: {
    totalRouters: number,
    totalVouchersSold: number,
    totalRevenue: number,
    totalCommission: number,
    lastLoginAt: Date | null,
    accountCreatedAt: Date
  },

  status: 'active' | 'suspended' | 'inactive',
  createdAt: Date,
  updatedAt: Date
}
```

### Customers Collection (New - Correct)

**Purpose**: MikroTik WiFi customers who purchase vouchers (NO authentication)

```typescript
{
  _id: ObjectId,
  name: string | null,          // Optional: customer name
  phone: string,                 // E.164 format: "254712345678"
  sha256Phone: string,           // SHA256 hash of phone for M-Pesa webhook matching
  email: string | null,          // Optional: for receipts

  // Purchase history
  purchases: [{
    voucherId: ObjectId,
    transactionId: string,
    amount: number,
    purchaseDate: Date
  }],

  totalSpent: number,
  lastPurchaseDate: Date | null,
  createdAt: Date,
  updatedAt: Date
}
```

## Migration Steps

### 1. Update init-database.ts

- [x] Add business fields to users collection schema
- [x] Simplify customers collection to phone/email only
- [x] Update indexes accordingly

### 2. Update seed-database.ts

- [x] Move businessInfo, paymentSettings, subscription to users
- [x] Create simple customers for voucher purchases

### 3. Update lib/auth.ts

- [x] Remove customerId logic
- [x] Session should contain user data directly
- [x] Update JWT callbacks

### 4. Update API Routes

- [x] /api/auth/\* - Use users collection only
- [x] /api/routers/\* - Change customerId to userId
- [x] /api/vouchers/\* - Keep routerId + userId
- [x] /api/payments/\* - Update customer references
- [x] /api/webhooks/mpesa/\* - Match by sha256Phone in customers

### 5. Add Missing Webhooks

- [x] /api/webhooks/mpesa/stk-callback - Track STK push status
- [x] Update confirmation webhook to handle customers by phone

### 6. Update Models/Types

- [x] types/next-auth.d.ts - Remove customerId
- [x] Update all TypeScript interfaces

### 7. Test Migration

- [x] Drop and recreate database
- [x] Test signup/signin flows
- [x] Test router CRUD
- [x] Test voucher generation
- [x] Test M-Pesa webhooks
- [x] Test customer voucher purchase flow

## Key Changes Summary

1. **Authentication Users** → `users` collection (with business data)
2. **Voucher Purchasers** → `customers` collection (phone-based, no auth)
3. **Router Ownership** → `routers.userId` (not customerId)
4. **M-Pesa Integration** → Match by `sha256Phone` in customers
5. **Sessions** → Use user data directly, no customerId lookup

## Breaking Changes

- All existing `customerId` references become `userId`
- Existing customers data needs migration to users
- New customers collection for voucher purchasers only
- API routes need to query users instead of customers for business data

## Files to Update

### Core Schema

- scripts/init-database.ts
- scripts/seed-database.ts

### Authentication

- lib/auth.ts
- src/app/api/auth/signin/route.ts
- src/app/api/auth/signup/route.ts

### API Routes (30+ files)

- All routes in src/app/api/routers/\*
- All routes in src/app/api/vouchers/\*
- All routes in src/app/api/payments/\*
- src/app/api/webhooks/mpesa/route.ts (confirmation)
- **NEW**: src/app/api/webhooks/mpesa/stk-callback/route.ts

### Types

- types/next-auth.d.ts
- types/router.ts
- types/dashboard.ts

### Pages (Review Only)

- Most pages should work if they use session data correctly
- Dashboard components may need updates if they query customers

## Timeline

This is a 2-3 hour refactor touching ~50 files. Must be done carefully with testing at each step.
