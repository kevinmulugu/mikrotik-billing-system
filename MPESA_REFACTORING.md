# M-Pesa Integration Refactoring Summary

## Overview

Complete refactoring of the M-Pesa integration to follow best practices with centralized service,
proper token management, and improved data flow.

## Changes Implemented

### 1. Created M-Pesa Service (`lib/services/mpesa.ts`)

**Purpose**: Centralize all M-Pesa API operations (similar to `mikrotik.ts`)

**Features**:

- ✅ Token generation with automatic caching
- ✅ Token validation with expiry checking (5-minute buffer)
- ✅ STK Push initiation
- ✅ STK Push status query
- ✅ Support for both Till and Paybill transaction types
- ✅ Automatic token refresh when expired
- ✅ Database integration for paybill credentials

**Key Methods**:

```typescript
- generateAccessToken(paybillNumber): Generates new token, saves to DB
- getValidAccessToken(paybillNumber): Returns cached or generates new token
- initiateSTKPush(params): Initiates STK push with proper formatting
- queryStkPushStatus(paybillNumber, checkoutRequestId): Query transaction status
```

### 2. Database Schema Updates (`scripts/init-database.ts`)

**New Collections**:

- `webhook_logs`: Stores all incoming webhook data with TTL (90 days)
- `stk_initiations`: Stores STK push initiation data for callback matching

**webhook_logs Indexes**:

- `source` (mpesa, etc)
- `timestamp` (desc, with TTL 90 days)
- `metadata.TransID`
- `metadata.BillRefNumber`

**stk_initiations Indexes**:

- `CheckoutRequestID` (unique)
- `MerchantRequestID`
- `AccountReference` (voucher code)
- `PhoneNumber` (raw customer phone)
- `paybillNumber`
- `status`
- `createdAt` (desc)

**paybills Collection Updates**:

- Added `type` field: `'paybill' | 'till'`
- Restructured credentials:
  ```typescript
  credentials: {
    consumerKey: string
    consumerSecret: string
    passKey: string
    accessToken: string | null
    tokenExpiresAt: Date | null
    lastTokenRefresh: Date | null
  }
  ```

### 3. Token Refresh Cron Job (`scripts/refresh-mpesa-tokens.ts`)

**Purpose**: Automatically refresh M-Pesa access tokens every 30 minutes

**Features**:

- ✅ Loops through all active paybills
- ✅ Checks token expiry (refreshes if < 10 minutes remaining)
- ✅ Skips if token still valid
- ✅ Comprehensive logging
- ✅ Error handling per paybill

**Usage**:

```bash
# Manual run
pnpm refresh:tokens

# Cron schedule (recommended)
*/30 * * * * pnpm refresh:tokens  # Every 30 minutes
```

### 4. Purchase Flow Refactoring (`src/app/api/captive/purchase/route.ts`)

**Changes**:

- ✅ Uses `mpesaService.initiateSTKPush()` instead of local functions
- ✅ Gets paybill from user's `paymentSettings.paybillNumber`
- ✅ Uses voucher code as `AccountReference` (for webhook matching)
- ✅ Saves STK initiation data to `stk_initiations` collection
- ✅ Proper error handling with fallback to paybill config

**Flow**:

1. Generate unique voucher code
2. Get router owner's paybill from settings
3. Validate paybill exists and is active
4. Initiate STK push using `mpesaService`
5. Save STK initiation with raw phone number
6. Create payment and voucher records
7. Return checkout info to client

**Key Data Saved in stk_initiations**:

```typescript
{
  CheckoutRequestID: string
  MerchantRequestID: string
  AccountReference: string  // Voucher code
  PhoneNumber: string       // Raw customer phone (254...)
  Amount: number
  paybillNumber: string
  routerId: ObjectId
  voucherId: ObjectId
  paymentId: ObjectId
  status: 'initiated'
  createdAt: Date
}
```

### 5. STK Callback Updates (`src/app/api/webhooks/mpesa/callback/route.ts`)

**Changes**:

- ✅ Logs to `webhook_logs` with proper structure
- ✅ Updates `stk_initiations` status on callback
- ✅ Uses standardized `source` and `type` fields

**webhook_logs Structure**:

```typescript
{
  source: 'mpesa_stk_callback'
  type: 'stk_callback'
  status: 'payment_not_found' | 'completed' | 'failed'
  payload: object  // Full callback body
  metadata: {
    CheckoutRequestID: string
    MerchantRequestID: string
    ResultCode: number
    ResultDesc: string
  }
  timestamp: Date
  processingTime: number
}
```

### 6. M-Pesa Confirmation Updates (`src/app/api/webhooks/mpesa/route.ts`)

**Major Changes**:

- ✅ First checks `stk_initiations` for context using `BillRefNumber` (voucher code)
- ✅ Uses raw phone number from STK initiation (not hashed MSISDN)
- ✅ Falls back to direct voucher lookup for legacy/manual payments
- ✅ Proper webhook logging with standardized structure

**Matching Logic**:

```typescript
1. Try to find stk_initiations by AccountReference (BillRefNumber)
2. If found:
   - Use raw PhoneNumber from STK initiation
   - Get voucher by voucherId from STK record
3. If not found (legacy payment):
   - Try direct voucher lookup by code
   - Use hashed MSISDN from M-Pesa
```

**Benefits**:

- Accurate phone number matching (not hashed)
- Full context from STK initiation
- Better debugging capabilities
- Support for both STK and manual payments

### 7. Paybill Schema Updates (`scripts/seed-database.ts`)

**Updated Structure**:

```typescript
{
  userId: ObjectId | null  // Router owner (null for company paybill)
  paybillInfo: {
    number: string
    name: string
    type: 'paybill' | 'till'  // ✅ NEW: Specify paybill vs till
    provider: 'safaricom'
  }
  credentials: {
    consumerKey: string
    consumerSecret: string
    passKey: string
    accessToken: string | null      // ✅ NEW: Cached token
    tokenExpiresAt: Date | null     // ✅ NEW: Token expiry
    lastTokenRefresh: Date | null   // ✅ NEW: Last refresh time
  }
  config: {
    environment: 'sandbox' | 'production'
    webhookUrl: string              // STK callback URL
    confirmationUrl: string         // C2B confirmation URL
  }
  status: 'active' | 'inactive'
}
```

## Package.json Updates

Added new script:

```json
"refresh:tokens": "tsx scripts/refresh-mpesa-tokens.ts"
```

## Environment Variables Required

```env
# M-Pesa Configuration (per paybill in database)
# These are stored in paybills collection now

# API Base URL
NEXT_PUBLIC_API_URL=https://yourdomain.com
MPESA_ENV=sandbox  # or 'production'
```

## Architecture Benefits

### Before:

- ❌ Token generation scattered in route files
- ❌ No token caching (generated on every request)
- ❌ Hard to track STK initiations
- ❌ Phone number hashing issues in webhooks
- ❌ No centralized M-Pesa service
- ❌ Till vs Paybill not distinguished

### After:

- ✅ Centralized `MpesaService` class
- ✅ Automatic token caching with expiry
- ✅ Cron job handles token refresh
- ✅ STK initiations tracked for matching
- ✅ Raw phone numbers saved for accurate matching
- ✅ Till and Paybill support with proper transaction types
- ✅ Comprehensive webhook logging
- ✅ Easy to maintain and debug

## Data Flow

### Voucher Purchase Flow:

```
1. Customer → Captive Portal → /api/captive/purchase
2. Generate voucher code (e.g., "ABC123DEF4")
3. Get router owner's paybillNumber from paymentSettings
4. mpesaService.initiateSTKPush({
     accountReference: "ABC123DEF4",
     phoneNumber: "254712345678"
   })
5. Save to stk_initiations:
   {
     AccountReference: "ABC123DEF4",
     PhoneNumber: "254712345678",
     voucherId: ObjectId
   }
6. Customer receives STK push
7. M-Pesa → /api/webhooks/mpesa/callback (STK result)
8. Update stk_initiations status
9. M-Pesa → /api/webhooks/mpesa (C2B confirmation)
10. Find stk_initiations by BillRefNumber "ABC123DEF4"
11. Use raw PhoneNumber "254712345678" for customer record
12. Activate voucher
```

## Testing Checklist

- [ ] Run `pnpm db:init` to create new collections
- [ ] Run `pnpm db:seed` to seed paybill with new structure
- [ ] Run `pnpm refresh:tokens` to test token generation
- [ ] Verify paybill has `type: 'paybill'` field
- [ ] Test STK push from captive portal
- [ ] Verify `stk_initiations` collection populated
- [ ] Test callback webhook updates STK status
- [ ] Test confirmation webhook finds STK initiation
- [ ] Verify `webhook_logs` collection populated
- [ ] Check token auto-refresh works (wait 5 minutes)

## Cron Setup (Production)

### Option 1: Vercel Cron (Recommended)

Create `.vercel/cron.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/refresh-tokens",
      "schedule": "*/30 * * * *"
    }
  ]
}
```

Then create `/api/cron/refresh-tokens/route.ts`:

```typescript
import { refreshMpesaTokens } from '@/lib/services/mpesa-cron';

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  await refreshMpesaTokens();
  return Response.json({ success: true });
}
```

### Option 2: System Cron

```bash
# Edit crontab
crontab -e

# Add line (runs every 30 minutes)
*/30 * * * * cd /path/to/project && pnpm refresh:tokens >> /var/log/mpesa-tokens.log 2>&1
```

## Migration Steps

If you have existing data:

1. **Backup database**:

   ```bash
   mongodump --uri="your_mongodb_uri" --db=mikrotik_billing
   ```

2. **Run init-database.ts** (creates new collections):

   ```bash
   pnpm db:init
   ```

3. **Update existing paybills** (add type field):

   ```javascript
   db.paybills.updateMany(
     { 'paybillInfo.type': { $exists: false } },
     { $set: { 'paybillInfo.type': 'paybill' } }
   );
   ```

4. **Restructure credentials** (if needed):

   ```javascript
   db.paybills.updateMany({ apiConfig: { $exists: true } }, [
     {
       $set: {
         'credentials.consumerKey': '$apiConfig.consumerKey',
         'credentials.consumerSecret': '$apiConfig.consumerSecret',
         'credentials.passKey': '$apiConfig.passkey',
         'credentials.accessToken': null,
         'credentials.tokenExpiresAt': null,
         'credentials.lastTokenRefresh': null,
       },
     },
     { $unset: 'apiConfig' },
   ]);
   ```

5. **Test token generation**:

   ```bash
   pnpm refresh:tokens
   ```

6. **Deploy and monitor**

## Monitoring

### Check Token Status:

```javascript
db.paybills.find(
  { status: 'active' },
  {
    'paybillInfo.number': 1,
    'credentials.tokenExpiresAt': 1,
    'credentials.lastTokenRefresh': 1,
  }
);
```

### Check STK Initiations:

```javascript
db.stk_initiations.find({ status: 'initiated' }).limit(10);
```

### Check Webhook Logs:

```javascript
db.webhook_logs.find({ source: 'mpesa_confirmation' }).sort({ timestamp: -1 }).limit(10);
```

## Support

For issues:

1. Check `webhook_logs` collection for error details
2. Check `stk_initiations` for payment tracking
3. Verify paybill credentials are correct
4. Check token expiry: `db.paybills.find({}, { 'credentials.tokenExpiresAt': 1 })`
5. Run `pnpm refresh:tokens` manually to test

## Next Steps (Optional)

- [ ] Add SMS provider integration for customer notifications
- [ ] Create admin UI for paybill management
- [ ] Add webhook retry logic for failed callbacks
- [ ] Implement transaction reconciliation dashboard
- [ ] Add real-time webhook monitoring
- [ ] Create analytics for payment success rates
