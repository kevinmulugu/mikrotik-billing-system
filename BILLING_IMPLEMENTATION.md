# Billing System Implementation Summary

## Overview

Complete implementation of billing system including paybill management, commission payouts, payout
settings, and invoicing system.

## 1. Database Schema Updates

### Collections Added

1. **commission_payouts** - Tracks commission payouts to router owners
2. **invoices** - Tracks subscription invoices for ISP plan users

### Users Collection Enhancement

Added `payoutSettings` field:

```typescript
payoutSettings: {
  minAmount: number,          // Minimum payout amount (KES)
  autoPayouts: boolean,       // Enable automatic payouts
  schedule: string,           // 'monthly' | 'weekly' | 'manual'
  bankAccount: {
    accountName: string | null,
    accountNumber: string | null,
    bankName: string | null,
    branchCode: string | null,
  },
  mpesaNumber: string | null, // M-Pesa payout destination
}
```

### Indexes Created

**commission_payouts:**

- `userId` - Router owner receiving payout
- `status` - pending, processing, completed, failed
- `period.month + period.year` - Compound index
- `createdAt` (desc)
- `payout.transactionId` (sparse)

**invoices:**

- `userId` - Customer being invoiced
- `invoiceNumber` (unique) - Format: INV-YYYYMM-####
- `status` - paid, pending, overdue, cancelled
- `dueDate`
- `createdAt` (desc)
- `payment.transactionId` (sparse)

## 2. API Routes Created

### 2.1 Paybill Management (`/api/settings/paybills`)

**GET** - Fetch user's paybills

```typescript
Response: {
  paybills: Array<{
    id, paybillNumber, paybillName, type, status, isDefault, createdAt, statistics
  }>,
  currentDefault: string | null
}
```

**POST** - Add new customer paybill

```typescript
Request: {
  paybillNumber, paybillName, type, consumerKey, consumerSecret, passKey, setAsDefault
}
Response: { success, message, paybill }
```

**PATCH** - Update paybill (set default, change status)

```typescript
Request: { paybillId, action: 'set_default' | 'update_status', status? }
Response: { success, message }
```

**DELETE** - Remove paybill

```typescript
Query: ?id=paybillId
Response: { success, message }
```

### 2.2 Payout Settings (`/api/settings/payouts`)

**GET** - Fetch payout settings

```typescript
Response: {
  payoutSettings: { minAmount, autoPayouts, schedule, bankAccount, mpesaNumber },
  currentCommissionRate: number
}
```

**PATCH** - Update payout settings

```typescript
Request: { minAmount?, autoPayouts?, schedule?, bankAccount?, mpesaNumber? }
Response: { success, message }
```

### 2.3 Commission Payouts (`/api/payouts`)

**GET** - Fetch commission payouts

```typescript
Query: ?status=pending&limit=20&page=1
Response: {
  payouts: Array<{ id, amount, period, status, method, transactionId, createdAt, processedAt }>,
  pagination: { page, limit, total, totalPages },
  summary: { pending, processing, completed, failed }
}
```

**POST** - Request manual payout

```typescript
Request: { amount, method: 'mpesa' | 'bank' }
Response: { success, message, payout }
```

**GET /balance** - Get available balance (`/api/payouts/balance`)

```typescript
Response: {
  totalEarned, totalPaid, availableBalance, pendingPayouts, withdrawable
}
```

### 2.4 Invoices (`/api/invoices`)

**GET** - Fetch invoices

```typescript
Query: ?status=paid&limit=20&page=1
Response: {
  invoices: Array<{ id, invoiceNumber, type, amount, status, dueDate, paidDate, items, payment }>,
  pagination: { page, limit, total, totalPages },
  summary: { paid, pending, overdue, cancelled }
}
```

**POST** - Create invoice (admin/system)

```typescript
Request: { userId, type, amount, currency, description, dueDate, items }
Response: { success, message, invoice }
```

**PATCH** - Update invoice status

```typescript
Request: { invoiceId, status, payment? }
Response: { success, message }
```

## 3. Commission System

### How It Works

**Individual Plan (Homeowners)**:

- Commission Rate: 20% to system, 80% to router owner
- Calculation: On each voucher sale, system keeps 20%
- Payout: Router owner receives 80% via M-Pesa or bank
- No monthly subscription fee

**ISP Plans**:

- Commission Rate: 0% to system, 100% to router owner
- Monthly Fee: KES 2,500 (ISP) or KES 3,900 (ISP Pro)
- Payout: Router owner receives 100% of voucher sales
- Pays via subscription invoice

### Payout Flow

1. **Earnings Accumulate** - Commissions recorded in `commissions` collection
2. **Auto or Manual Trigger**:
   - Auto: System checks `payoutSettings.schedule` (monthly/weekly)
   - Manual: User requests payout via API
3. **Validation**:
   - Check minimum amount (`payoutSettings.minAmount`)
   - Verify available balance
   - Confirm payout destination configured
4. **Payout Record Created** - Entry in `commission_payouts` with status `pending`
5. **Processing** - Admin or automated system processes via M-Pesa/bank transfer
6. **Status Update** - Mark as `completed` with transaction ID

## 4. Invoice System

### Invoice Types

- **subscription** - Monthly/annual subscription fees
- **overage** - Additional charges for exceeding plan limits
- **adjustment** - Manual credits/debits

### Invoice Lifecycle

1. **Created** - System generates on subscription renewal
2. **Pending** - Awaiting payment
3. **Overdue** - Past due date
4. **Paid** - Payment received and verified
5. **Cancelled** - Voided or refunded

### Invoice Number Format

`INV-YYYYMM-####`

- Example: `INV-202502-0001` (First invoice of February 2025)

## 5. Integration with Existing System

### Paybill Management

- When user adds paybill, it updates `users.paymentSettings.paybillNumber`
- Voucher purchase flow checks this field to determine payment destination
- Token refresh cron includes customer paybills

### Commission Tracking

- Existing `commissions` collection tracks earnings per period
- New `commission_payouts` collection tracks actual disbursements
- Balance = Total Earned - Total Paid Out

### Billing Settings Component

- Currently uses mock data in `components/settings/billing-settings.tsx`
- **TODO**: Replace with actual API calls to new routes

## 6. Data Migration

### Run After Deployment

```bash
# 1. Initialize new collections
pnpm db:init

# 2. Seed payout settings for existing users (manual migration script needed)
# Add payoutSettings field to all existing users
```

### Migration Script Needed

```javascript
// scripts/migrate-payout-settings.ts
db.users.updateMany(
  { payoutSettings: { $exists: false } },
  {
    $set: {
      payoutSettings: {
        minAmount: 1000,
        autoPayouts: true,
        schedule: 'monthly',
        bankAccount: {
          accountName: null,
          accountNumber: null,
          bankName: null,
          branchCode: null,
        },
        mpesaNumber: null,
      },
    },
  }
);
```

## 7. Testing Checklist

### Database Setup

- [ ] Run `pnpm db:init` to create new collections
- [ ] Verify `commission_payouts` collection exists
- [ ] Verify `invoices` collection exists
- [ ] Check indexes are created properly
- [ ] Verify `payoutSettings` field in users

### API Testing

**Paybill Management:**

- [ ] GET /api/settings/paybills (fetch user paybills)
- [ ] POST /api/settings/paybills (add new paybill)
- [ ] PATCH /api/settings/paybills (set default)
- [ ] DELETE /api/settings/paybills (remove paybill)
- [ ] Verify paybill updates users.paymentSettings

**Payout Settings:**

- [ ] GET /api/settings/payouts (fetch settings)
- [ ] PATCH /api/settings/payouts (update min amount)
- [ ] PATCH /api/settings/payouts (update bank details)
- [ ] PATCH /api/settings/payouts (update M-Pesa number)

**Commission Payouts:**

- [ ] GET /api/payouts (fetch payout history)
- [ ] GET /api/payouts?status=pending (filter by status)
- [ ] GET /api/payouts/balance (check available balance)
- [ ] POST /api/payouts (request manual payout)
- [ ] Verify minimum amount validation
- [ ] Verify balance check works

**Invoices:**

- [ ] GET /api/invoices (fetch invoices)
- [ ] GET /api/invoices?status=pending (filter by status)
- [ ] POST /api/invoices (create invoice - admin)
- [ ] PATCH /api/invoices (mark as paid)
- [ ] Verify invoice number generation

## 8. Frontend Integration (TODO)

### Update `components/settings/billing-settings.tsx`

Replace mock data with API calls:

```typescript
// Fetch paybills
const { data: paybillData } = await fetch('/api/settings/paybills');

// Add paybill
await fetch('/api/settings/paybills', {
  method: 'POST',
  body: JSON.stringify({
    paybillNumber, paybillName, type,
    consumerKey, consumerSecret, passKey,
    setAsDefault: true
  })
});

// Fetch payout settings
const { data: payoutSettings } = await fetch('/api/settings/payouts');

// Update payout settings
await fetch('/api/settings/payouts', {
  method: 'PATCH',
  body: JSON.stringify({ minAmount, autoPayouts, schedule })
});

// Fetch commission payouts
const { data: payouts } = await fetch('/api/payouts');

// Request payout
await fetch('/api/payouts', {
  method: 'POST',
  body: JSON.stringify({ amount, method: 'mpesa' })
});

// Fetch invoices
const { data: invoices } = await fetch('/api/invoices');

// Mark invoice as paid
await fetch('/api/invoices', {
  method: 'PATCH',
  body: JSON.stringify({
    invoiceId,
    status: 'paid',
    payment: { method: 'mpesa', transactionId: 'xxx' }
  })
});
```

## 9. Cron Jobs Needed

### Commission Payout Automation

Create `scripts/process-auto-payouts.ts`:

```typescript
// Run daily or weekly
// 1. Find users with autoPayouts enabled
// 2. Check their schedule (monthly/weekly)
// 3. Calculate available balance
// 4. If balance >= minAmount, create payout request
// 5. Process via M-Pesa API or bank transfer
```

### Invoice Generation

Create `scripts/generate-subscription-invoices.ts`:

```typescript
// Run monthly (1st of each month)
// 1. Find all ISP plan users
// 2. Calculate subscription fee
// 3. Create invoice with due date (end of month)
// 4. Send notification email/SMS
```

### Overdue Invoice Checker

Create `scripts/check-overdue-invoices.ts`:

```typescript
// Run daily
// 1. Find invoices with status 'pending' and dueDate < today
// 2. Update status to 'overdue'
// 3. Send reminder notification
// 4. If 30+ days overdue, suspend service
```

## 10. Security Considerations

1. **Paybill Credentials**: Stored encrypted in database (TODO: add encryption)
2. **API Authentication**: All routes require valid session
3. **Authorization**: Users can only access their own data
4. **Audit Logs**: All actions logged to `audit_logs` collection
5. **Input Validation**: Phone numbers, amounts, dates validated
6. **Transaction IDs**: Sparse indexes to handle nulls efficiently

## 11. Monitoring

### Key Metrics to Track

- Total commission payouts processed
- Average payout amount
- Payout success rate
- Pending payout queue length
- Invoice payment rate
- Overdue invoice count

### Alerts to Set Up

- Payout failure rate > 5%
- Pending payout queue > 100 items
- Overdue invoices > 10
- Commission calculation discrepancies

## 12. Future Enhancements

- [ ] Automated payout processing via M-Pesa API
- [ ] Invoice PDF generation and email delivery
- [ ] Payout schedule customization (specific day of month)
- [ ] Multi-currency support
- [ ] Payout history export (CSV, PDF)
- [ ] Commission rate negotiations (variable rates)
- [ ] Referral commission tracking
- [ ] Tax withholding and reporting
- [ ] Payout batching for efficiency
- [ ] Webhook notifications for payout status changes

## Files Modified/Created

### Modified:

- ✅ `scripts/init-database.ts` - Added commission_payouts, invoices collections
- ✅ `scripts/seed-database.ts` - Added payoutSettings to users

### Created:

- ✅ `src/app/api/settings/paybills/route.ts` - Paybill management API
- ✅ `src/app/api/settings/payouts/route.ts` - Payout settings API
- ✅ `src/app/api/payouts/route.ts` - Commission payouts API
- ✅ `src/app/api/payouts/balance/route.ts` - Balance check API
- ✅ `src/app/api/invoices/route.ts` - Invoices API

### Pending:

- ⏳ Update `components/settings/billing-settings.tsx` with real API calls
- ⏳ Create automated payout processing script
- ⏳ Create invoice generation script
- ⏳ Create overdue invoice checker script
- ⏳ Add payout settings migration script

## Quick Start

```bash
# 1. Initialize database (creates new collections)
pnpm db:init

# 2. Test paybill addition
curl -X POST http://localhost:3000/api/settings/paybills \
  -H "Content-Type: application/json" \
  -d '{
    "paybillNumber": "654321",
    "paybillName": "My Business Paybill",
    "type": "paybill",
    "consumerKey": "xxx",
    "consumerSecret": "xxx",
    "passKey": "xxx"
  }'

# 3. Check commission balance
curl http://localhost:3000/api/payouts/balance

# 4. Request payout
curl -X POST http://localhost:3000/api/payouts \
  -H "Content-Type: application/json" \
  -d '{ "amount": 5000, "method": "mpesa" }'

# 5. Fetch invoices
curl http://localhost:3000/api/invoices
```

## Support

For issues:

1. Check API route error logs
2. Verify database collections exist
3. Confirm user has proper payoutSettings
4. Check audit_logs for action history
5. Verify authentication session is valid
