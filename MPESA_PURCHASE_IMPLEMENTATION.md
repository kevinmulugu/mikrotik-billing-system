# M-Pesa Voucher Purchase Implementation Summary

## ✅ What Was Implemented

### 1. M-Pesa C2B Confirmation Webhook
**File:** `src/app/api/webhooks/mpesa/route.ts`

**Purpose:** Handle M-Pesa payment confirmations and update voucher purchase status

**Key Features:**
- ✅ Validates payment details from Safaricom webhook
- ✅ Finds voucher by code (from BillRefNumber)
- ✅ Prevents duplicate payment processing
- ✅ Validates payment amount matches voucher price
- ✅ Calculates commission based on customer type (reads from `system_config`)
- ✅ Sets purchase payment fields:
  - `payment.method` = 'mpesa'
  - `payment.transactionId` = M-Pesa TransID
  - `payment.phoneNumber` = Customer MSISDN
  - `payment.amount` = Paid amount
  - `payment.commission` = Calculated commission
  - `payment.paymentDate` = Purchase timestamp
- ✅ Sets purchase expiry timer (if enabled):
  - `usage.purchaseExpiresAt` = purchaseTime + purchaseExpiryWindowDays
- ✅ Updates voucher status from `'active'` → `'paid'`
- ✅ Records transaction in `transactions` collection
- ✅ Creates audit log entry
- ✅ Logs webhook events in `webhook_logs` collection
- ✅ Responds to Safaricom with appropriate ResultCode

### 2. UI Updates
**File:** `components/vouchers/voucher-generator.tsx`

**Change:** Added `autoTerminateOnPurchase` flag to the API request payload

**Purpose:** Ensures merchant's auto-terminate preference is sent to backend

## 🔄 Purchase Flow

```
Customer Pays
     ↓
  M-Pesa
     ↓
Safaricom Webhook (POST /api/webhooks/mpesa)
  BillRefNumber = Payment Reference (NOT voucher code)
     ↓
┌────────────────────────────────┐
│ 1. Find voucher by reference   │ ← Uses public payment reference
│ 2. Validate payment            │
│ 3. Calculate commission        │
│ 4. Set payment.* fields        │
│ 5. Set purchaseExpiresAt       │ ← Purchase window starts here
│ 6. Update status → 'paid'      │
│ 7. Record transaction          │
│ 8. Log audit + webhook         │
└────────────────────────────────┘
     ↓
Database Updated
     ↓
Cron Job (expire-vouchers.ts) enforces expiry
```

## 📝 Database Updates on Purchase

**Voucher Document:**
```javascript
{
  // Public payment reference (safe to share, NOT the password)
  reference: 'VCH1A2B3C4D',
  
  // Private voucher credentials
  voucherInfo: {
    code: 'ABC123XYZ',      // This is also the password - keep private!
    password: 'ABC123XYZ',   // Same as code
    // ... other fields
  },
  
  // Payment fields (set by webhook)
  payment: {
    method: 'mpesa',
    transactionId: 'MPESAXXXX',
    phoneNumber: '254712345678',
    amount: 25.00,
    commission: 5.00,  // 20% for personal customers
    paymentDate: ISODate('2023-10-31T12:00:00Z')
  },
  
  // Usage timing fields (set by webhook if enabled)
  usage: {
    // ... existing fields ...
    purchaseExpiresAt: ISODate('2023-11-07T12:00:00Z'),  // 7 days after purchase
    // expectedEndTime: null  ← Will be set at activation (NOT YET IMPLEMENTED)
  },
  
  status: 'paid',  // Changed from 'active'
  updatedAt: ISODate('2023-10-31T12:00:00Z')
}
```

**Transaction Document (new):**
```javascript
{
  customerId: ObjectId('...'),
  routerId: ObjectId('...'),
  voucherId: ObjectId('...'),
  type: 'voucher_sale',
  amount: 25.00,
  commission: 5.00,
  commissionRate: 20.0,
  paymentMethod: 'mpesa',
  transactionId: 'MPESAXXXX',
  phoneNumber: '254712345678',
  status: 'completed',
  metadata: {
    paymentReference: 'VCH1A2B3C4D',  // Public reference used for payment
    packageType: '3hours',
    purchaseExpiresAt: '2023-11-07T12:00:00.000Z',
    webhookProcessingTime: 45
  },
  createdAt: ISODate('2023-10-31T12:00:00Z')
}
```

**Audit Log (new):**
```javascript
{
  userId: ObjectId('...'),
  action: 'voucher_purchased',
  resourceType: 'voucher',
  resourceId: ObjectId('...'),
  details: {
    paymentReference: 'VCH1A2B3C4D',  // Public reference
    transactionId: 'MPESAXXXX',
    amount: 25.00,
    commission: 5.00,
    phoneNumber: '254712345678',
    purchaseExpiresAt: '2023-11-07T12:00:00.000Z',
    processingTime: 45
  },
  ipAddress: 'mpesa-webhook',
  userAgent: 'Safaricom M-Pesa',
  timestamp: ISODate('2023-10-31T12:00:00Z')
}
```

**Webhook Log (new):**
```javascript
{
  type: 'mpesa_confirmation',
  status: 'success',  // or 'failed', 'duplicate', 'error'
  payload: { /* full M-Pesa webhook body */ },
  voucherId: ObjectId('...'),
  paymentReference: 'VCH1A2B3C4D',  // Public reference
  transactionId: 'MPESAXXXX',
  amount: 25.00,
  commission: 5.00,
  timestamp: ISODate('2023-10-31T12:00:00Z'),
  processingTime: 45
}
```

## 🎯 Commission Calculation

**Source:** `system_config` collection

```javascript
{
  key: 'commission_rates',
  value: {
    homeowner: 20.0,   // 20% per voucher sale
    personal: 20.0,    // 20% per voucher sale
    isp: 0.0,          // No commission (pay subscription)
    enterprise: 0.0    // No commission (pay subscription)
  }
}
```

**Formula:**
```javascript
const commissionRate = commissionRates[customerType] || 20.0;
const commissionAmount = paidAmount * (commissionRate / 100);
```

## 🛡️ Error Handling

The webhook handles these scenarios:

| Scenario | Response Code | Action |
|----------|---------------|--------|
| Missing required fields | ResultCode: 1 | Log webhook, return error |
| Voucher not found | ResultCode: 1 | Log attempt, return error |
| Already purchased | ResultCode: 0 | Log duplicate, return success |
| Amount mismatch | ResultCode: 1 | Log mismatch, return error |
| Database error | ResultCode: 1 | Log error, return failure |
| Success | ResultCode: 0 | Update DB, return success |

**Note:** Duplicate purchases return `ResultCode: 0` to prevent Safaricom from retrying.

## ⏰ Expiry Enforcement

**Script:** `scripts/expire-vouchers.ts`

**Triggers purchase expiry when:**
- `usage.purchaseExpiresAt <= now`
- `status = 'paid'` (purchased but not activated)

**Actions:**
1. Updates voucher:
   - `status = 'expired'`
   - `expiry.expiredBy = 'purchase_window_elapsed'`
2. If `autoTerminateOnPurchase` = true:
   - Removes hotspot user from MikroTik
3. Creates audit log entry

## 🚧 What's NOT Yet Implemented

### Activation Handler
When customer logs in to WiFi, need to set:
- `usage.used` = true
- `usage.startTime` = activation timestamp
- `usage.expectedEndTime` = startTime + (maxDurationMinutes * 60000)
- `status` = 'used'

**Options for implementation:**
1. Captive portal login endpoint
2. MikroTik RADIUS accounting callback
3. Periodic sync from MikroTik user list

## 📚 Related Documentation

- **`VOUCHER_PURCHASE_FLOW.md`** - Complete flow documentation with architecture diagram
- **`VOUCHER_EXPIRY_CRON.md`** - Cron job scheduling and setup
- **`components/vouchers/voucher-generator.tsx`** - UI for generating vouchers with expiry options
- **`src/app/api/routers/[id]/vouchers/generate/route.ts`** - Voucher generation API

## 🧪 Testing

### Test M-Pesa Webhook
```bash
curl -X POST http://localhost:3000/api/webhooks/mpesa \
  -H "Content-Type: application/json" \
  -d '{
    "TransactionType": "Pay Bill",
    "TransID": "TEST123456",
    "TransAmount": "25.00",
    "MSISDN": "254712345678",
    "BillRefNumber": "VCH1A2B3C4D",
    "TransTime": "20231031120000",
    "BusinessShortCode": "123456",
    "OrgAccountBalance": "10000.00"
  }'
```

**Note:** Use the `reference` field from voucher generation, NOT the `code` field.

### Verify Database
```javascript
// MongoDB shell
use mikrotik_billing

// Check voucher was updated (using reference, NOT code)
db.vouchers.findOne({ 'reference': 'VCH1A2B3C4D' })

// Check transaction was recorded
db.transactions.find({ type: 'voucher_sale' }).sort({ createdAt: -1 }).limit(1)

// Check audit log
db.audit_logs.find({ action: 'voucher_purchased' }).sort({ timestamp: -1 }).limit(1)

// Check webhook log
db.webhook_logs.find({ type: 'mpesa_confirmation' }).sort({ timestamp: -1 }).limit(1)
```

## 🔐 Security Notes

### Voucher Code vs Payment Reference
- **Voucher Code (`voucherInfo.code`)**: 
  - Also serves as the password for WiFi login
  - **MUST be kept private**
  - Only shared with customer AFTER payment is confirmed
  - Never used in M-Pesa BillRefNumber

- **Payment Reference (`reference`)**: 
  - Public identifier for payment purposes
  - Safe to share before payment
  - Used as M-Pesa BillRefNumber
  - Cannot be used to access WiFi
  - Example format: `VCH1A2B3C4D`, `VCHK7M2P9A`

### Production Checklist
- [ ] Enable webhook signature verification
- [ ] Use environment variables for sensitive config
- [ ] Set up rate limiting for webhook endpoint
- [ ] Monitor webhook logs for suspicious activity
- [ ] Implement retry logic for failed database operations
- [ ] Add alerting for webhook failures

### Signature Verification (TODO)
```typescript
// Uncomment in production
const signature = headers().get('x-safaricom-signature');
await verifyMpesaSignature(body, signature);
```

## 📊 Monitoring

### Key Metrics to Track
1. **Webhook success rate**
   - Query: `db.webhook_logs.find({ type: 'mpesa_confirmation' })`
   - Target: >99% success rate

2. **Average processing time**
   - Field: `webhook_logs.processingTime`
   - Target: <100ms

3. **Duplicate webhook rate**
   - Query: `db.webhook_logs.find({ status: 'duplicate' })`
   - Expected: <5%

4. **Commission accuracy**
   - Verify: `transaction.commission` matches `transaction.amount * commissionRate`

### Dashboard Queries
```javascript
// Webhook stats (last 24h)
db.webhook_logs.aggregate([
  { $match: { 
    type: 'mpesa_confirmation',
    timestamp: { $gte: new Date(Date.now() - 24*60*60*1000) }
  }},
  { $group: {
    _id: '$status',
    count: { $sum: 1 },
    avgProcessingTime: { $avg: '$processingTime' }
  }}
])

// Commission earnings (last 30 days)
db.transactions.aggregate([
  { $match: {
    type: 'voucher_sale',
    createdAt: { $gte: new Date(Date.now() - 30*24*60*60*1000) }
  }},
  { $group: {
    _id: null,
    totalSales: { $sum: '$amount' },
    totalCommission: { $sum: '$commission' },
    count: { $sum: 1 }
  }}
])
```

## ✨ Benefits

1. **Robust Payment Processing**
   - Handles M-Pesa webhooks reliably
   - Prevents duplicate payments
   - Validates amounts before processing

2. **Accurate Commission Tracking**
   - Reads rates from system config
   - Different rates per customer type
   - Recorded in transactions for accounting

3. **Purchase Expiry Support**
   - Anti-hoarding mechanism
   - Configurable per-voucher settings
   - Automated enforcement via cron

4. **Complete Audit Trail**
   - Webhook logs for debugging
   - Audit logs for compliance
   - Transaction records for accounting

5. **Error Resilience**
   - Graceful error handling
   - Detailed error logging
   - Safaricom-compatible responses
