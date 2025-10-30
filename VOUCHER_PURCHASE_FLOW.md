# Voucher Purchase & Redemption Flow

## Overview
This document describes how vouchers are purchased via M-Pesa and how expiry/termination timers are set.

## Purchase Flow

### 1. M-Pesa C2B Confirmation Webhook
**Endpoint:** `POST /api/webhooks/mpesa`

**Trigger:** Safaricom sends payment confirmation when customer pays to paybill/till number

**BillRefNumber:** Should contain the voucher code

**What it does:**
1. ✅ Validates payment details (amount, transaction ID)
2. ✅ Finds voucher by code in database
3. ✅ Checks for duplicate payments
4. ✅ Validates payment amount matches voucher price
5. ✅ Calculates commission based on customer type (from `system_config` collection)
6. ✅ Sets purchase timestamps:
   - `payment.paymentDate` = current timestamp
   - `payment.transactionId` = M-Pesa TransID
   - `payment.phoneNumber` = customer MSISDN
   - `payment.amount` = paid amount
   - `payment.commission` = calculated commission
7. ✅ Sets purchase expiry timer (if enabled):
   - If `usage.timedOnPurchase` = true AND `usage.purchaseExpiryWindowDays` is set
   - Then `usage.purchaseExpiresAt` = purchaseTime + purchaseExpiryWindowDays
8. ✅ Updates voucher status to `'paid'`
9. ✅ Records transaction in `transactions` collection
10. ✅ Creates audit log entry
11. ✅ Logs webhook event in `webhook_logs` collection
12. ✅ Responds to Safaricom with success/failure

### 2. Voucher Activation (When Customer Connects)
**Status:** ⚠️ NOT YET FULLY IMPLEMENTED

**Expected flow (to be implemented):**
When a customer logs in to the captive portal using their voucher code:

1. Find voucher by code
2. Verify voucher is paid (`status = 'paid'`) and not expired
3. Check if purchase window has elapsed (if `usage.purchaseExpiresAt` is set and expired)
4. **Set activation timestamps:**
   - `usage.used` = true
   - `usage.startTime` = current timestamp
   - `usage.expectedEndTime` = startTime + (`usage.maxDurationMinutes` * 60000) milliseconds
   - `status` = 'used'
5. Activate user on MikroTik router (if not already synced)
6. Create audit log for activation

**Current implementation note:**
- Vouchers are created on MikroTik during generation (with `limit-uptime` set)
- MikroTik handles the actual connection/disconnection based on uptime
- The database tracking of activation (`usage.used`, `usage.startTime`, `usage.expectedEndTime`) needs to be implemented

## Expiry & Termination

### Activation Expiry
**Field:** `expiry.expiresAt`
**Description:** When an *unused* voucher can no longer be activated
**Set by:** Voucher generation (optional)
**Enforced by:** `scripts/expire-vouchers.ts` cron job

### Purchase Expiry
**Field:** `usage.purchaseExpiresAt`
**Description:** Deadline after purchase when voucher must be used (anti-hoarding)
**Set by:** M-Pesa webhook at purchase time (if `usage.timedOnPurchase` is enabled)
**Enforced by:** `scripts/expire-vouchers.ts` cron job

### Usage End Time
**Field:** `usage.expectedEndTime`
**Description:** When the voucher session should end (based on duration)
**Set by:** ⚠️ Should be set at activation time (not yet implemented)
**Formula:** `startTime + maxDurationMinutes`
**Enforced by:** 
- MikroTik `limit-uptime` (router-side enforcement)
- `scripts/expire-vouchers.ts` cron job (database cleanup & auto-termination)

### Auto-Termination
**Field:** `usage.autoTerminateOnPurchase`
**Description:** If true, automatically delete voucher from DB and MikroTik when expired
**Set by:** Merchant during voucher generation
**Enforced by:** `scripts/expire-vouchers.ts` cron job

## Voucher States

| Status | Description | Can Connect? | Commission Paid? |
|--------|-------------|--------------|------------------|
| `active` | Generated, not purchased | No (no payment) | No |
| `pending` | Awaiting payment verification | No | No |
| `paid` | Purchased, not yet used | Yes (first connection) | Yes |
| `used` | Customer connected & using | Yes (within duration) | Yes |
| `expired` | Expired (activation, purchase, or usage deadline) | No | Depends (if paid before expiry) |
| `cancelled` | Manually cancelled | No | Depends |

## Commission Calculation

**Source:** `system_config` collection, key: `commission_rates`

**Default rates:**
- `personal` / `homeowner`: 20%
- `isp`: 0% (pay subscription instead)
- `enterprise`: 0% (pay subscription instead)

**Calculated as:** `paidAmount * (commissionRate / 100)`

**Recorded in:** `transactions` collection at time of purchase

## Enforcement (Cron Job)

**Script:** `scripts/expire-vouchers.ts`
**Run via:** `pnpm expire:vouchers`

**What it does:**
1. Finds vouchers to expire:
   - Activation expiry: `expiry.expiresAt <= now` AND status = 'active'
   - Purchase expiry: `usage.purchaseExpiresAt <= now` AND status = 'paid'
   - Usage ended: `usage.expectedEndTime <= now` AND status = 'used'

2. For each expired voucher:
   - If `usage.autoTerminateOnPurchase` is true:
     - Attempts to remove hotspot user from MikroTik router
     - Logs success/failure
   - Updates voucher:
     - Sets `status` = 'expired'
     - Sets `usage.endTime` = now (if not already set)
     - Sets `expiry.expiredBy` = reason (e.g., 'purchase_window_elapsed')
   - Creates audit log entry

3. Outputs summary:
   - Total expired
   - Router users removed
   - Errors encountered

**Scheduling:** See `VOUCHER_EXPIRY_CRON.md` for setup instructions

## TODO / Next Steps

### Critical Implementation Needed
1. **Voucher Activation Handler**
   - Create endpoint or logic to set `usage.used`, `usage.startTime`, and `usage.expectedEndTime` when customer first connects
   - This could be:
     - Part of captive portal login flow
     - MikroTik RADIUS accounting callback
     - Periodic sync from MikroTik user status

2. **Activation Expiry Check**
   - When customer tries to activate a voucher, check if `expiry.expiresAt` has passed
   - If expired, show error and don't allow activation

3. **Purchase Expiry Check**
   - When customer tries to activate a voucher, check if `usage.purchaseExpiresAt` has passed
   - If expired, show error (voucher was purchased but not used in time)

### Optional Enhancements
1. **SMS/Email Notifications**
   - Send voucher code after purchase
   - Send expiry warnings (24h before purchaseExpiresAt)
   - Send usage reminders

2. **On-Demand Expiry Endpoint**
   - Create authenticated API route to manually trigger expiry job
   - Add admin UI button to run expiry check

3. **Voucher Usage Dashboard**
   - Show purchase vs. activation rate
   - Show expired voucher stats
   - Show average time between purchase and activation

4. **MikroTik RADIUS Integration**
   - Use RADIUS accounting to track exact login/logout times
   - Auto-update `usage.startTime` and `usage.endTime` from RADIUS logs

## Database Collections

### `vouchers`
Stores voucher documents with all fields described above

### `transactions`
Records each voucher sale with commission details

### `audit_logs`
Tracks all voucher lifecycle events (generation, purchase, activation, expiry)

### `webhook_logs`
Logs all M-Pesa webhook calls (success, failure, duplicate)

### `system_config`
Stores commission rates and other system-wide configuration

## Testing

### Test Purchase Flow
```bash
# Simulate M-Pesa webhook
curl -X POST http://localhost:3000/api/webhooks/mpesa \
  -H "Content-Type: application/json" \
  -d '{
    "TransactionType": "Pay Bill",
    "TransID": "TEST123456",
    "TransAmount": "25.00",
    "MSISDN": "254712345678",
    "BillRefNumber": "YOUR_VOUCHER_CODE",
    "TransTime": "20231031120000",
    "BusinessShortCode": "123456",
    "OrgAccountBalance": "10000.00"
  }'
```

### Test Expiry Cron
```bash
# Run expiry job manually
pnpm expire:vouchers

# Check logs
tail -f logs/expire-vouchers.log
```

### Verify Database Updates
```javascript
// MongoDB shell
use mikrotik_billing

// Find paid vouchers with purchase expiry
db.vouchers.find({
  status: 'paid',
  'usage.purchaseExpiresAt': { $ne: null }
}).pretty()

// Find vouchers that should expire soon
db.vouchers.find({
  'usage.purchaseExpiresAt': {
    $lt: new Date(Date.now() + 24*60*60*1000) // within 24h
  }
}).pretty()

// Check transactions
db.transactions.find({ type: 'voucher_sale' }).sort({ createdAt: -1 }).limit(10).pretty()

// Check webhook logs
db.webhook_logs.find({ type: 'mpesa_confirmation' }).sort({ timestamp: -1 }).limit(10).pretty()
```

## Architecture Diagram

```
┌─────────────┐
│  Customer   │
└──────┬──────┘
       │ Pays to Paybill
       │ BillRefNumber = Voucher Code
       ▼
┌─────────────────┐
│   Safaricom     │
│   M-Pesa API    │
└──────┬──────────┘
       │ Webhook POST
       │ /api/webhooks/mpesa
       ▼
┌──────────────────────────────────┐
│  M-Pesa Webhook Handler          │
│  - Validate payment               │
│  - Find voucher by code           │
│  - Calculate commission           │
│  - Set payment.* fields           │
│  - Set usage.purchaseExpiresAt    │  ← 🔴 IMPLEMENTED
│  - Update status to 'paid'        │
│  - Record transaction             │
│  - Log audit event                │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│  Database (MongoDB)              │
│  - vouchers (updated)             │
│  - transactions (new record)      │
│  - audit_logs (new entry)         │
│  - webhook_logs (new entry)       │
└──────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│  ⏰ Cron Job                      │
│  scripts/expire-vouchers.ts       │
│  - Check expiry conditions        │
│  - Remove from MikroTik (if auto) │
│  - Update status to 'expired'     │
└──────────────────────────────────┘

┌─────────────────────────────────┐
│  🚧 NOT YET IMPLEMENTED:         │
│  Activation Handler              │
│  - Customer logs in              │
│  - Set usage.used = true         │
│  - Set usage.startTime           │
│  - Set usage.expectedEndTime     │  ← 🔴 TODO
│  - Update status to 'used'       │
└─────────────────────────────────┘
```

## Configuration Examples

### Enable Purchase Expiry (Anti-Hoarding)
When generating vouchers, set:
```javascript
{
  "usageTimedOnPurchase": true,
  "purchaseExpiryDays": 7,  // Must use within 7 days of purchase
  "autoTerminateOnPurchase": true  // Auto-delete after expiry
}
```

### Enable Activation Expiry
When generating vouchers, set:
```javascript
{
  "autoExpire": true,
  "expiryDays": 30  // Must be purchased/activated within 30 days
}
```

### Combined (Both Expiry Types)
```javascript
{
  // Activation expiry
  "autoExpire": true,
  "expiryDays": 30,  // Must purchase within 30 days of generation
  
  // Purchase expiry
  "usageTimedOnPurchase": true,
  "purchaseExpiryDays": 7,  // Must activate within 7 days of purchase
  
  // Auto-cleanup
  "autoTerminateOnPurchase": true
}
```

This gives merchants maximum control over voucher lifecycle and prevents:
- Stale unused vouchers (activation expiry)
- Hoarding of purchased vouchers (purchase expiry)
- Manual cleanup (auto-termination)
