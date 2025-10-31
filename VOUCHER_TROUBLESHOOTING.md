# 🔧 Voucher System Troubleshooting Guide

## Quick Diagnostic Commands

### Check Voucher Status

```mongodb
// Find voucher by code
db.vouchers.findOne({ 'voucherInfo.code': 'ABCD1234' })

// Find voucher by payment reference
db.vouchers.findOne({ reference: 'VCHXYZ123' })

// Find voucher by M-Pesa transaction
db.vouchers.findOne({ 'payment.transactionId': 'ABC123XYZ' })
```

### Check MikroTik User

```bash
# Via REST API
curl -u admin:password http://192.168.88.1/rest/ip/hotspot/user?name=ABCD1234

# Via CLI
/ip hotspot user print where name="ABCD1234"
```

### Check Active Sessions

```bash
# REST API
curl -u admin:password http://192.168.88.1/rest/ip/hotspot/active

# CLI
/ip hotspot active print
```

---

## Common Issues & Solutions

### 1. Customer Can't Login with Voucher Code

#### Symptoms

- "Invalid username or password"
- "Access denied"

#### Diagnostics

```mongodb
// 1. Check voucher exists and is paid
db.vouchers.findOne({
  'voucherInfo.code': 'ABCD1234',
  status: 'paid'
})

// 2. Check if voucher has MikroTik ID
// If mikrotikUserId is null, user not synced to router
```

#### Possible Causes & Fixes

**A. Voucher not synced to router**

```bash
# Symptom: mikrotikUserId is null
# Fix: Manually sync voucher

POST /api/routers/[id]/vouchers/bulk-sync
```

**B. Voucher expired**

```mongodb
// Check expiry status
db.vouchers.findOne(
  { 'voucherInfo.code': 'ABCD1234' },
  { status: 1, 'expiry.expiresAt': 1, 'usage.purchaseExpiresAt': 1 }
)

// If expired, extend expiry (admin action)
db.vouchers.updateOne(
  { 'voucherInfo.code': 'ABCD1234' },
  { $set: {
    status: 'paid',
    'expiry.expiresAt': new Date('2025-12-31')
  }}
)

// Then re-create on MikroTik
```

**C. MikroTik user removed prematurely**

```bash
# Check if user exists on router
curl -u admin:password http://192.168.88.1/rest/ip/hotspot/user?name=ABCD1234

# If not found, recreate user
POST /rest/ip/hotspot/user
{
  "name": "ABCD1234",
  "password": "ABCD1234",
  "profile": "3hours-25ksh",
  "limit-uptime": "3h"
}
```

**D. Uptime limit already exhausted**

```bash
# Check uptime in MikroTik
/ip hotspot user print detail where name="ABCD1234"

# If uptime shows "3h/3h", voucher is fully used
# Solution: Issue refund or new voucher
```

---

### 2. M-Pesa Payment Not Reflecting

#### Symptoms

- Customer paid but voucher still shows status: 'active'
- No payment info in database

#### Diagnostics

```mongodb
// 1. Check webhook logs
db.webhook_logs.find({
  'payload.BillRefNumber': 'VCHXYZ123'
}).sort({ timestamp: -1 })

// 2. Check if payment updated
db.vouchers.findOne(
  { reference: 'VCHXYZ123' },
  { status: 1, payment: 1 }
)
```

#### Possible Causes & Fixes

**A. Webhook never received**

```mongodb
// Check if webhook log exists
db.webhook_logs.findOne({ 'payload.BillRefNumber': 'VCHXYZ123' })

// If not found:
// 1. Check Safaricom dashboard for callback status
// 2. Verify webhook URL is accessible
// 3. Check server logs for incoming requests
// 4. Manually trigger webhook if needed
```

**B. Webhook failed validation**

```mongodb
// Check webhook error logs
db.webhook_logs.find({
  status: 'failed',
  'payload.BillRefNumber': 'VCHXYZ123'
})

// Common validation errors:
// - Amount mismatch
// - Voucher not found
// - Duplicate transaction
```

**C. Manual fix: Update payment manually**

```mongodb
// ONLY if you've verified payment with Safaricom
db.vouchers.updateOne(
  { reference: 'VCHXYZ123' },
  { $set: {
    status: 'paid',
    'payment.method': 'mpesa',
    'payment.transactionId': 'ABC123XYZ',
    'payment.phoneNumber': '254712345678',
    'payment.amount': 25,
    'payment.commission': 5,
    'payment.paymentDate': new Date(),
    updatedAt: new Date()
  }}
)

// Then create transaction record
db.transactions.insertOne({
  voucherId: ObjectId('...'),
  type: 'voucher_sale',
  amount: 25,
  commission: 5,
  paymentMethod: 'mpesa',
  transactionId: 'ABC123XYZ',
  status: 'completed',
  createdAt: new Date()
})
```

---

### 3. Voucher Generation Fails

#### Symptoms

- Error: "Failed to generate vouchers"
- Some vouchers synced, some failed

#### Diagnostics

```mongodb
// Check audit logs
db.audit_logs.find({
  'action.resource': 'voucher',
  'action.type': 'create'
}).sort({ timestamp: -1 }).limit(10)

// Check error logs (if you have a logging system)
```

#### Possible Causes & Fixes

**A. Router offline during sync**

```javascript
// In response, check:
{
  routerSync: {
    synced: 0,
    failed: 10,
    details: [
      { code: "ABCD1234", success: false, error: "Connection timeout" }
    ]
  }
}

// Fix: Router is offline
// 1. Check router connectivity
// 2. Verify VPN connection if using remote access
// 3. Sync vouchers later via bulk sync
```

**B. MikroTik profile doesn't exist**

```bash
# Check if profile exists on router
/ip hotspot user profile print where name="3hours-25ksh"

# If not found, create profile:
/ip hotspot user profile add \
  name="3hours-25ksh" \
  rate-limit="1M/2M" \
  shared-users=1
```

**C. Database write failure**

```mongodb
// Check if vouchers were created
db.vouchers.find({
  'batch.batchId': 'BATCH-1698765432'
}).count()

// If 0, database insert failed
// Check MongoDB connection and permissions
```

---

### 4. Customer Disconnected Prematurely

#### Symptoms

- Customer reports being kicked off before time expired
- Session ended early

#### Diagnostics

```mongodb
// Check voucher usage
db.vouchers.findOne(
  { 'voucherInfo.code': 'ABCD1234' },
  {
    'usage.startTime': 1,
    'usage.endTime': 1,
    'usage.timeUsed': 1,
    'usage.maxDurationMinutes': 1,
    'usage.expectedEndTime': 1
  }
)
```

```bash
# Check MikroTik logs
/log print where topics~"hotspot"
```

#### Possible Causes & Fixes

**A. Purchase expiry triggered**

```mongodb
// Check if purchase expiry was enabled
db.vouchers.findOne(
  { 'voucherInfo.code': 'ABCD1234' },
  {
    'usage.timedOnPurchase': 1,
    'usage.purchaseExpiresAt': 1,
    'payment.paymentDate': 1
  }
)

// If timedOnPurchase: true and purchaseExpiresAt passed:
// Customer purchased at 7am, package is 3 hours
// purchaseExpiresAt = 10am (regardless of activation time)
// This is expected behavior
```

**B. Router restarted**

```bash
# Check router uptime
/system resource print

# If uptime < session duration, router was rebooted
# Customer should be able to re-login (uptime persists)
```

**C. Manual disconnection**

```bash
# Check if admin manually removed user
/log print where message~"ABCD1234"

# Look for manual removal or profile change
```

---

### 5. Cron Job Not Expiring Vouchers

#### Symptoms

- Expired vouchers still showing status: 'active' or 'used'
- MikroTik users not being removed

#### Diagnostics

```bash
# Check if cron job is running
crontab -l | grep expire-vouchers

# Check cron logs
tail -f /var/log/cron

# Or check script output
tail -f /path/to/expire-vouchers.log
```

```mongodb
// Check vouchers that should be expired
db.vouchers.find({
  'expiry.expiresAt': { $lte: new Date() },
  status: { $ne: 'expired' }
}).count()
```

#### Possible Causes & Fixes

**A. Cron job not configured**

```bash
# Add to crontab
crontab -e

# Add this line (run every 5 minutes)
*/5 * * * * cd /path/to/project && /usr/bin/node --loader ts-node/esm scripts/expire-vouchers.ts >> /var/log/expire-vouchers.log 2>&1
```

**B. Script crashes**

```bash
# Check error logs
tail -f /var/log/expire-vouchers.log

# Common errors:
# - MongoDB connection failed
# - Router connection timeout
# - Permission errors
```

**C. Manual trigger**

```bash
# Run script manually to test
cd /path/to/project
npx ts-node scripts/expire-vouchers.ts

# Check output for errors
```

**D. MongoDB indexes missing**

```mongodb
// Check indexes
db.vouchers.getIndexes()

// Should have:
// { 'expiry.expiresAt': 1 }
// { 'usage.purchaseExpiresAt': 1 }
// { 'usage.expectedEndTime': 1 }

// Create if missing
db.vouchers.createIndex({ 'expiry.expiresAt': 1 })
db.vouchers.createIndex({ 'usage.purchaseExpiresAt': 1 })
db.vouchers.createIndex({ 'usage.expectedEndTime': 1 })
```

---

### 6. Duplicate Voucher Codes

#### Symptoms

- Error: "Voucher code already exists"
- Multiple vouchers with same code

#### Diagnostics

```mongodb
// Find duplicate codes
db.vouchers.aggregate([
  { $group: {
    _id: '$voucherInfo.code',
    count: { $sum: 1 },
    vouchers: { $push: '$_id' }
  }},
  { $match: { count: { $gt: 1 } }}
])
```

#### Fix

```mongodb
// Create unique index (should prevent future duplicates)
db.vouchers.createIndex(
  { 'voucherInfo.code': 1 },
  { unique: true }
)

// For existing duplicates, manually resolve:
// 1. Check which voucher is legitimate (by createdAt, payment status)
// 2. Cancel or delete duplicates
db.vouchers.updateOne(
  { _id: ObjectId('duplicate_id') },
  { $set: { status: 'cancelled' }}
)
```

---

### 7. Commission Calculation Issues

#### Symptoms

- Commission amount incorrect
- ISP customers charged commission

#### Diagnostics

```mongodb
// Check transaction commission
db.transactions.findOne(
  { voucherId: ObjectId('...') },
  { commission: 1, commissionRate: 1, amount: 1 }
)

// Check customer type
db.customers.findOne(
  { _id: ObjectId('...') },
  { type: 1, 'subscription.plan': 1, 'paymentSettings.commissionRate': 1 }
)
```

#### Fix

```mongodb
// Update customer commission rate
db.customers.updateOne(
  { _id: ObjectId('...') },
  { $set: { 'paymentSettings.commissionRate': 20 }}
)

// For ISPs (should be 0%)
db.customers.updateOne(
  { _id: ObjectId('...') },
  { $set: {
    type: 'isp',
    'paymentSettings.commissionRate': 0
  }}
)

// Recalculate transaction commission
// (This requires manual adjustment or script)
```

---

## Monitoring & Alerts

### Key Metrics to Monitor

```mongodb
// 1. Vouchers generated today
db.vouchers.countDocuments({
  createdAt: {
    $gte: new Date(new Date().setHours(0,0,0,0))
  }
})

// 2. Vouchers sold today
db.vouchers.countDocuments({
  status: 'paid',
  'payment.paymentDate': {
    $gte: new Date(new Date().setHours(0,0,0,0))
  }
})

// 3. Active sessions
db.vouchers.countDocuments({
  status: 'used',
  'usage.endTime': null
})

// 4. Failed sync count
db.vouchers.countDocuments({
  status: { $in: ['active', 'paid'] },
  mikrotikUserId: null
})

// 5. Webhook failures today
db.webhook_logs.countDocuments({
  status: 'failed',
  timestamp: {
    $gte: new Date(new Date().setHours(0,0,0,0))
  }
})

// 6. Revenue today
db.transactions.aggregate([
  {
    $match: {
      type: 'voucher_sale',
      status: 'completed',
      createdAt: {
        $gte: new Date(new Date().setHours(0,0,0,0))
      }
    }
  },
  {
    $group: {
      _id: null,
      totalRevenue: { $sum: '$amount' },
      totalCommission: { $sum: '$commission' }
    }
  }
])
```

### Alert Thresholds

```javascript
// Set up alerts for:
1. Webhook failure rate > 5%
2. MikroTik sync failure rate > 10%
3. Voucher generation errors
4. Router offline for > 5 minutes
5. Database connection failures
6. Duplicate payment attempts
```

---

## Emergency Procedures

### Emergency: Bulk Voucher Invalidation

```mongodb
// If vouchers need to be disabled immediately
// (e.g., security breach, pricing error)

db.vouchers.updateMany(
  {
    'batch.batchId': 'BATCH-1698765432',
    status: { $ne: 'used' }
  },
  { $set: {
    status: 'cancelled',
    updatedAt: new Date()
  }}
)

// Then remove from MikroTik (run script)
```

### Emergency: Refund Customer

```mongodb
// 1. Find customer's voucher
const voucher = db.vouchers.findOne({
  'payment.phoneNumber': '254712345678',
  'payment.transactionId': 'ABC123XYZ'
})

// 2. Mark as refunded
db.vouchers.updateOne(
  { _id: voucher._id },
  { $set: {
    status: 'cancelled',
    'payment.refunded': true,
    'payment.refundDate': new Date(),
    'payment.refundReason': 'Customer request'
  }}
)

// 3. Remove from MikroTik if synced
// 4. Process M-Pesa reversal via Safaricom API
// 5. Create audit log
```

### Emergency: Router Compromise

```bash
# If router is compromised:
1. Immediately disable hotspot service
   /ip hotspot set [find] disabled=yes

2. Remove all hotspot users
   /ip hotspot user remove [find]

3. Change router admin password
   /user set admin password="new_password"

4. Update password in database
   db.routers.updateOne(
     { _id: ObjectId('...') },
     { $set: { 'credentials.password': 'encrypted_new_password' }}
   )

5. Regenerate all vouchers with new sync
```

---

## Support Scripts

### Check Voucher Health

```javascript
// scripts/check-voucher-health.ts
const now = new Date();

// Find anomalies
const results = {
  paidButNotSynced: await db.vouchers.countDocuments({
    status: 'paid',
    mikrotikUserId: null,
  }),

  expiredButStillActive: await db.vouchers.countDocuments({
    'expiry.expiresAt': { $lte: now },
    status: { $nin: ['expired', 'cancelled'] },
  }),

  usedButNoEndTime: await db.vouchers.countDocuments({
    status: 'used',
    'usage.used': true,
    'usage.endTime': null,
    'usage.expectedEndTime': { $lte: now },
  }),

  purchasedButNoTransaction: await db.vouchers.countDocuments({
    status: 'paid',
    'payment.transactionId': null,
  }),
};

console.log('Health Check Results:', results);
```

### Sync All Unsynced Vouchers

```javascript
// scripts/sync-unsynced-vouchers.ts
const unsyncedVouchers = await db.vouchers
  .find({
    status: { $in: ['active', 'paid'] },
    mikrotikUserId: null,
  })
  .toArray();

for (const voucher of unsyncedVouchers) {
  try {
    const router = await db.routers.findOne({ _id: voucher.routerId });
    const config = getRouterConnectionConfig(router);

    const result = await MikroTikService.createHotspotUser(config, {
      name: voucher.voucherInfo.code,
      password: voucher.voucherInfo.password,
      profile: voucher.voucherInfo.packageType,
      limitUptime: convertMinutesToMikroTikFormat(voucher.voucherInfo.duration),
    });

    await db.vouchers.updateOne({ _id: voucher._id }, { $set: { mikrotikUserId: result.ret } });

    console.log(`✓ Synced ${voucher.voucherInfo.code}`);
  } catch (error) {
    console.error(`✗ Failed ${voucher.voucherInfo.code}:`, error.message);
  }
}
```

---

## Performance Optimization

### Database Query Optimization

```mongodb
// Ensure proper indexes exist
db.vouchers.createIndex({ routerId: 1, status: 1 })
db.vouchers.createIndex({ 'voucherInfo.code': 1 }, { unique: true })
db.vouchers.createIndex({ reference: 1 })
db.vouchers.createIndex({ 'payment.transactionId': 1 })
db.vouchers.createIndex({ 'expiry.expiresAt': 1 })
db.vouchers.createIndex({ 'usage.purchaseExpiresAt': 1 })
db.vouchers.createIndex({ 'usage.expectedEndTime': 1 })

// Add compound indexes for common queries
db.vouchers.createIndex({ customerId: 1, status: 1, createdAt: -1 })
db.transactions.createIndex({ customerId: 1, createdAt: -1 })
```

### MikroTik Performance

```bash
# Limit query results
GET /rest/ip/hotspot/user?.proplist=.id,name,uptime

# Use batch operations
# Instead of creating users one-by-one, use CLI API with multiple commands

# Monitor router load
/system resource monitor once
```

---

## Useful Queries

### Find All Active Vouchers for a Customer

```mongodb
db.vouchers.find({
  customerId: ObjectId('...'),
  status: 'used',
  'usage.endTime': null
})
```

### Find Unpaid Vouchers Older Than 30 Days

```mongodb
db.vouchers.find({
  status: 'active',
  createdAt: {
    $lte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  }
})
```

### Calculate Total Sales by Package

```mongodb
db.transactions.aggregate([
  {
    $lookup: {
      from: 'vouchers',
      localField: 'voucherId',
      foreignField: '_id',
      as: 'voucher'
    }
  },
  { $unwind: '$voucher' },
  {
    $group: {
      _id: '$voucher.voucherInfo.packageType',
      totalSales: { $sum: '$amount' },
      count: { $sum: 1 }
    }
  },
  { $sort: { totalSales: -1 }}
])
```

---

**Need more help?** Check:

- `VOUCHER_SYSTEM_MASTER_GUIDE.md` - Complete documentation
- `VOUCHER_FLOW_DIAGRAMS.md` - Visual flow diagrams
- MongoDB logs: `/var/log/mongodb/mongod.log`
- Application logs: Check your logging system
- MikroTik logs: `/log print`
