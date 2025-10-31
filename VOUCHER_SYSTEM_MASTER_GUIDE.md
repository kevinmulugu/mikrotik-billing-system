# 🎫 MikroTik Voucher System - Complete Master Guide

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Architecture & Data Flow](#architecture--data-flow)
3. [Voucher Lifecycle](#voucher-lifecycle)
4. [Core Components Deep Dive](#core-components-deep-dive)
5. [Database Schema](#database-schema)
6. [MikroTik Integration](#mikrotik-integration)
7. [M-Pesa Payment Integration](#m-pesa-payment-integration)
8. [Expiry Management](#expiry-management)
9. [Security Considerations](#security-considerations)
10. [API Reference](#api-reference)

---

## 🎯 System Overview

This is a **complete hotspot voucher management system** that integrates:

- **Next.js 15** (App Router)
- **MongoDB** for data persistence
- **MikroTik RouterOS REST API** for hotspot user management
- **M-Pesa Daraja API** for payment processing
- **Automated cron jobs** for voucher expiry management

### Key Features

- ✅ Bulk voucher generation with MikroTik sync
- ✅ M-Pesa STK Push payment integration
- ✅ Multiple expiry strategies (activation, purchase, usage)
- ✅ Commission tracking per customer type
- ✅ Automated hotspot user cleanup
- ✅ Real-time voucher status tracking
- ✅ Captive portal API for end-user purchases

---

## 🏗️ Architecture & Data Flow

### High-Level Architecture

```
┌─────────────────┐
│  Merchant Web   │  (Generate Vouchers)
│   Dashboard     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│     Voucher Generation API              │
│  /api/routers/[id]/vouchers/generate    │
└────────┬─────────────────────┬──────────┘
         │                     │
         ▼                     ▼
┌─────────────────┐   ┌──────────────────┐
│   MongoDB       │   │  MikroTik Router │
│  (vouchers)     │   │  (hotspot users) │
└────────┬────────┘   └──────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│     Customer Portal / Captive Portal     │
│   /api/captive/packages                  │
│   /api/captive/purchase  (STK Push)      │
└────────┬─────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│      M-Pesa Payment Webhook              │
│    /api/webhooks/mpesa                   │
│  (Updates voucher with payment info)     │
└────────┬─────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│   User Activates Voucher on Hotspot     │
│   (MikroTik handles authentication)      │
└────────┬─────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│      Expiry Cron Job (Cleanup)           │
│   scripts/expire-vouchers.ts             │
│  (Expires vouchers & removes users)      │
└──────────────────────────────────────────┘
```

---

## 🔄 Voucher Lifecycle

### State Diagram

```
┌─────────┐
│ active  │ (Generated, not purchased)
└────┬────┘
     │
     │ M-Pesa Payment Confirmed
     ▼
┌─────────┐
│  paid   │ (Purchased, not activated)
└────┬────┘
     │
     │ User logs in to hotspot
     ▼
┌─────────┐
│  used   │ (Active session on MikroTik)
└────┬────┘
     │
     │ Session ends OR timer expires
     ▼
┌─────────┐
│ expired │ (Cleanup completed)
└─────────┘
```

### Detailed States

| Status        | Description                  | Can Purchase?   | Can Activate?         | MikroTik User Exists?         |
| ------------- | ---------------------------- | --------------- | --------------------- | ----------------------------- |
| **active**    | Generated, awaiting purchase | ✅ Yes          | ❌ No (needs payment) | ✅ Yes (if syncToRouter=true) |
| **paid**      | Payment confirmed            | ❌ Already paid | ✅ Yes                | ✅ Yes                        |
| **used**      | Active session on hotspot    | ❌ Already paid | ✅ Already active     | ✅ Yes                        |
| **expired**   | Voucher or session ended     | ❌ No           | ❌ No                 | ❌ Removed by cron            |
| **cancelled** | Manually cancelled           | ❌ No           | ❌ No                 | ❌ Should be removed          |

---

## 🧩 Core Components Deep Dive

### 1. Voucher Generation Page

**File**: `src/app/routers/[id]/vouchers/generate/page.tsx`

**Purpose**: Server component that renders the voucher generation form

**Key Features**:

- Authentication check via `getServerSession`
- Displays `VoucherGenerator` component
- Info banner with generation guidelines
- Back button to voucher list

**Code Flow**:

```typescript
1. Check user session → redirect if not authenticated
2. Await params (Next.js 15 requirement)
3. Render VoucherGenerator with routerId
```

---

### 2. Voucher Generator Component

**File**: `components/vouchers/voucher-generator.tsx`

**Purpose**: Client component for voucher generation form

**State Management**:

```typescript
- selectedPackage: string       // Package name (e.g., "3hours-25ksh")
- quantity: string              // Number of vouchers (1-1000)
- autoExpire: boolean           // Enable activation expiry
- expiryDays: string           // Days until activation expiry
- usageTimedOnPurchase: boolean // Enable purchase-based timer
- syncToRouter: boolean         // Create MikroTik users immediately
- generationResult: any         // API response with generated vouchers
```

**Key Functions**:

#### `fetchPackages()`

```typescript
// Fetches router packages from /api/routers/[id]
// Filters only synced packages (syncStatus === 'synced')
// Auto-selects first package
```

#### `validateForm()`

```typescript
Validation Rules:
- Package must be selected
- Quantity: 1-1000
- Expiry days (if enabled): 1-365
```

#### `handleGenerate()`

```typescript
POST /api/routers/[id]/vouchers/generate
Body: {
  packageName: string,
  quantity: number,
  autoExpire: boolean,
  expiryDays: number | null,
  usageTimedOnPurchase: boolean,
  syncToRouter: boolean
}
```

#### `handleDownloadCSV()`

```typescript
// Generates CSV with columns:
// Payment Reference | Code | Password | Package | Duration | Price | Expires
```

**UI Sections**:

1. **Package Selection** - Dropdown with package details
2. **Quantity Input** - Number input (1-1000)
3. **Auto Expire Toggle** - Enable activation expiry
4. **Expiry Days Input** - Conditional input
5. **Usage Timer Toggle** - Enable purchase-based expiry
6. **Sync Toggle** - Create MikroTik users immediately
7. **Summary Card** - Display total value and commission
8. **Generate Button** - Trigger generation
9. **Results Card** - Show generated vouchers with download option

---

### 3. Voucher Generation API

**File**: `src/app/api/routers/[id]/vouchers/generate/route.ts`

**Purpose**: Backend API for voucher generation

**Request Body**:

```typescript
{
  packageName: string,          // Required: Package name from router
  quantity: number,             // Required: 1-1000
  autoExpire: boolean,          // Default: true
  expiryDays: number,          // Required if autoExpire=true
  usageTimedOnPurchase: boolean, // Default: false
  syncToRouter: boolean         // Default: true
}
```

**Processing Steps**:

#### Step 1: Authentication & Validation

```typescript
1. Verify session (getServerSession)
2. Validate routerId (ObjectId format)
3. Validate quantity (1-1000)
4. Validate packageName exists on router
5. Validate autoExpire + expiryDays combination
```

#### Step 2: Database Queries

```typescript
const customer = await db.collection('customers').findOne({ userId })
const router = await db.collection('routers').findOne({ _id, customerId })
const packageData = router.packages.hotspot.find(pkg => pkg.name === packageName)
```

#### Step 3: Commission Calculation

```typescript
const commissionRate = (customer.subscription?.plan === 'isp')
  ? 0  // ISPs get 0% commission
  : (customer.paymentSettings?.commissionRate ?? 20); // Default 20%
```

#### Step 4: Voucher Code Generation

```typescript
function generateVoucherCode(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No confusing chars
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
```

#### Step 5: Payment Reference Generation

```typescript
// Capped to 12 characters for M-Pesa AccountReference
const paymentReference = `VCH${(Date.now().toString(36) + Math.random().toString(36).slice(2, 4)).toUpperCase().slice(-9)}`;
```

#### Step 6: MikroTik Sync (if enabled)

```typescript
if (syncToRouter && router.health?.status === 'online') {
  const routerConfig = getRouterConnectionConfig(router, { forceVPN: true });

  const userResult = await MikroTikService.createHotspotUser(routerConfig, {
    name: code,           // Voucher code (username)
    password: code,       // Same as code
    profile: packageName, // MikroTik profile
    limitUptime: limitUptime, // e.g., "3h", "1d"
    server: 'hotspot1',
    comment: `${displayName} - Generated automatically`
  });

  // CRITICAL: 'ret' field contains MikroTik user ID
  mikrotikUserId = userResult?.['ret'] || null;
}
```

#### Step 7: Voucher Document Structure

```typescript
{
  _id: ObjectId,
  routerId: ObjectId,
  customerId: ObjectId,
  reference: string,            // Payment reference (PUBLIC - for M-Pesa)
  voucherInfo: {
    code: string,               // Voucher code (PRIVATE - password)
    password: string,           // Same as code
    packageType: string,        // e.g., "3hours-25ksh"
    packageDisplayName: string, // e.g., "3 Hours - KSh 25"
    duration: number,           // Minutes (e.g., 180)
    dataLimit: number,          // 0 = unlimited
    bandwidth: {
      upload: number,           // kbps
      download: number          // kbps
    },
    price: number,              // KES
    currency: 'KES'
  },
  usage: {
    used: false,
    userId: null,               // Set when activated
    deviceMac: null,            // Set when activated
    startTime: null,            // Set when activated
    endTime: null,              // Set when session ends
    dataUsed: 0,
    timeUsed: 0,
    maxDurationMinutes: number, // Package duration
    expectedEndTime: null,      // Set when activated (startTime + maxDurationMinutes)
    timedOnPurchase: boolean,   // Enable purchase-based timer
    purchaseExpiresAt: null     // Set by webhook when purchased
  },
  payment: {
    method: null,               // 'mpesa'
    transactionId: null,        // M-Pesa transaction ID
    phoneNumber: null,          // Customer phone
    amount: number,
    commission: number,
    paymentDate: null
  },
  batch: {
    batchId: string,            // e.g., "BATCH-1234567890"
    batchSize: number,
    generatedBy: ObjectId
  },
  expiry: {
    expiresAt: Date | null,     // Activation expiry
    autoDelete: boolean
  },
  mikrotikUserId: string | null, // MikroTik user .id
  status: 'active',             // 'active' | 'paid' | 'used' | 'expired' | 'cancelled'
  createdAt: Date,
  updatedAt: Date
}
```

#### Step 8: Database Operations

```typescript
// Insert vouchers
await db.collection('vouchers').insertMany(vouchers);

// Update router statistics
await db.collection('routers').updateOne(
  { _id: routerId },
  { $inc: { 'statistics.totalUsers': quantity } }
);

// Create audit log
await db.collection('audit_logs').insertOne({...});
```

#### Step 9: Response Format

```typescript
{
  success: true,
  batchId: string,
  vouchers: [
    {
      id: string,
      reference: string,        // Payment reference (PUBLIC)
      code: string,             // Voucher code (PRIVATE)
      password: string,
      packageName: string,
      packageDisplayName: string,
      duration: string,         // Human-readable (e.g., "3 hours")
      durationMinutes: number,
      price: number,
      expiresAt: string | null,
      mikrotikUserId: string | null,
      syncedToRouter: boolean
    }
  ],
  summary: {
    totalGenerated: number,
    totalValue: number,
    commission: number,
    packageName: string,
    duration: string,
    expiryDate: string | null
  },
  routerSync: {
    enabled: boolean,
    synced: number,
    failed: number,
    successRate: string,
    details: [...]
  }
}
```

---

### 4. Voucher List Page

**File**: `src/app/routers/[id]/vouchers/page.tsx`

**Purpose**: Display and manage vouchers

**Key Features**:

- Tabbed view (All, Active, Used, Expired, Cancelled)
- Bulk sync to router functionality
- Export to CSV
- Quick stats display
- Filter by status and package type

**Components Used**:

- `VoucherList` - Fetches and displays vouchers
- `VoucherStats` - Real-time statistics

---

### 5. Voucher Fetch API

**File**: `src/app/api/routers/[id]/vouchers/route.ts`

**Purpose**: Retrieve vouchers with filtering

**Query Parameters**:

```typescript
{
  status?: 'all' | 'active' | 'paid' | 'used' | 'expired' | 'cancelled',
  packageType?: string,
  search?: string,      // Search by code, phone, or transaction ID
  limit?: number,       // Default: 100
  skip?: number         // Default: 0
}
```

**Response**:

```typescript
{
  success: true,
  vouchers: [...],
  pagination: {
    total: number,
    limit: number,
    skip: number,
    hasMore: boolean
  }
}
```

---

### 6. MikroTik Service

**File**: `lib/services/mikrotik.ts`

**Purpose**: Interface with MikroTik RouterOS REST API

**Key Methods**:

#### `makeRequest()`

```typescript
// Base HTTP request to MikroTik REST API
// Handles authentication, timeouts, and error handling
```

#### `makeHybridRequest()`

```typescript
// Automatic fallback strategy for POST operations
// Strategy 1: POST (standard REST)
// Strategy 2: POST /add (older RouterOS)
// Strategy 3: CLI API fallback
```

#### `testConnection()`

```typescript
// Verify router connectivity and get system info
// Returns: version, model, CPU, memory, uptime
```

#### `createHotspotUser()`

```typescript
async createHotspotUser(
  config: MikroTikConnectionConfig,
  userConfig: {
    name: string,           // Voucher code (username)
    password: string,       // Voucher password
    profile: string,        // MikroTik profile name
    limitUptime: string,    // Session duration (e.g., "3h", "1d")
    server?: string,        // Default: "hotspot1"
    comment?: string
  }
): Promise<any>

// CRITICAL: Returns 'ret' field with MikroTik user ID
// Example response: { ret: "*1A2B3C" }
```

#### `getHotspotUser()`

```typescript
// Find hotspot user by username (voucher code)
```

#### `deleteHotspotUser()`

```typescript
// Remove hotspot user from MikroTik
// Used by expiry cron job
```

#### `getActiveHotspotUsers()`

```typescript
// List all active hotspot sessions
// Returns: username, MAC, IP, uptime, data usage
```

#### Duration Conversion

```typescript
function convertMinutesToMikroTikFormat(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h${remainingMinutes}m` : `${hours}h`;
  }
  if (minutes < 10080) {
    const days = Math.floor(minutes / 1440);
    const remainingHours = Math.floor((minutes % 1440) / 60);
    return remainingHours > 0 ? `${days}d${remainingHours}h` : `${days}d`;
  }
  const weeks = Math.floor(minutes / 10080);
  const remainingDays = Math.floor((minutes % 10080) / 1440);
  return remainingDays > 0 ? `${weeks}w${remainingDays}d` : `${weeks}w`;
}

// Examples:
// 60 minutes → "1h"
// 180 minutes → "3h"
// 1440 minutes → "1d"
// 10080 minutes → "1w"
```

---

### 7. M-Pesa Payment Webhook

**File**: `src/app/api/webhooks/mpesa/route.ts`

**Purpose**: Handle M-Pesa payment confirmations

**Webhook Flow**:

#### Step 1: Parse Safaricom Payload

```typescript
{
  TransID: string,              // M-Pesa transaction ID
  TransAmount: string,          // Payment amount
  MSISDN: string,              // Customer phone (254...)
  BillRefNumber: string,       // Payment reference (NOT voucher code!)
  TransTime: string,           // Transaction timestamp
  BusinessShortCode: string,   // Paybill number
  OrgAccountBalance: string    // Account balance after transaction
}
```

#### Step 2: Validate Required Fields

```typescript
if (!TransID || !TransAmount || !BillRefNumber) {
  return { ResultCode: 1, ResultDesc: 'Missing required fields' };
}
```

#### Step 3: Find Voucher by Payment Reference

```typescript
// SECURITY: Find by reference (PUBLIC), NOT by code (PRIVATE)
const voucher = await db.collection('vouchers').findOne({
  reference: BillRefNumber,     // Payment reference
  status: { $in: ['active', 'pending'] }
});
```

#### Step 4: Validate Payment Amount

```typescript
const expectedAmount = voucher.voucherInfo.price;
const paidAmount = parseFloat(TransAmount);

if (Math.abs(paidAmount - expectedAmount) > 0.01) {
  return { ResultCode: 1, ResultDesc: 'Amount mismatch' };
}
```

#### Step 5: Calculate Commission

```typescript
const commissionRates = {
  homeowner: 20.0,
  personal: 20.0,
  isp: 0.0,
  enterprise: 0.0
};

const customerType = customer?.type || 'personal';
const commissionRate = commissionRates[customerType] || 20.0;
const commissionAmount = paidAmount * (commissionRate / 100);
```

#### Step 6: Calculate Purchase Expiry

```typescript
let purchaseExpiresAt: Date | null = null;

// If purchase-based timer is enabled, calculate expiry
if (voucher.usage?.timedOnPurchase && voucher.usage?.maxDurationMinutes) {
  const minutesToAdd = voucher.usage.maxDurationMinutes;
  purchaseExpiresAt = new Date(purchaseTime.getTime() + minutesToAdd * 60 * 1000);

  console.log(`[M-Pesa Webhook] Purchase expiry set to: ${purchaseExpiresAt.toISOString()} (${minutesToAdd} minutes from purchase)`);
}
```

#### Step 7: Update Voucher

```typescript
await db.collection('vouchers').updateOne(
  { _id: voucher._id },
  {
    $set: {
      'payment.method': 'mpesa',
      'payment.transactionId': TransID,
      'payment.phoneNumber': MSISDN,
      'payment.amount': paidAmount,
      'payment.commission': commissionAmount,
      'payment.paymentDate': purchaseTime,
      'usage.purchaseExpiresAt': purchaseExpiresAt,
      status: 'paid',           // Change status to 'paid'
      updatedAt: purchaseTime
    }
  }
);
```

#### Step 8: Record Transaction

```typescript
await db.collection('transactions').insertOne({
  customerId: voucher.customerId,
  routerId: voucher.routerId,
  voucherId: voucher._id,
  type: 'voucher_sale',
  amount: paidAmount,
  commission: commissionAmount,
  commissionRate: commissionRate,
  paymentMethod: 'mpesa',
  transactionId: TransID,
  phoneNumber: MSISDN,
  status: 'completed',
  metadata: {
    paymentReference: BillRefNumber,
    packageType: voucher.voucherInfo.packageType,
    purchaseExpiresAt: purchaseExpiresAt?.toISOString() || null,
    webhookProcessingTime: Date.now() - startTime
  },
  createdAt: purchaseTime
});
```

#### Step 9: Create Audit Log

```typescript
await db.collection('audit_logs').insertOne({
  userId: voucher.customerId,
  action: 'voucher_purchased',
  resourceType: 'voucher',
  resourceId: voucher._id,
  details: {
    paymentReference: BillRefNumber,
    transactionId: TransID,
    amount: paidAmount,
    commission: commissionAmount,
    phoneNumber: MSISDN,
    purchaseExpiresAt: purchaseExpiresAt?.toISOString() || null
  },
  timestamp: purchaseTime
});
```

#### Step 10: Log Webhook

```typescript
await db.collection('webhook_logs').insertOne({
  type: 'mpesa_confirmation',
  status: 'success',
  payload: body,
  voucherId: voucher._id,
  paymentReference: BillRefNumber,
  transactionId: TransID,
  amount: paidAmount,
  commission: commissionAmount,
  timestamp: purchaseTime,
  processingTime: Date.now() - startTime
});
```

#### Step 11: Respond to Safaricom

```typescript
return NextResponse.json({
  ResultCode: 0,
  ResultDesc: 'Payment processed successfully'
});
```

**Important Notes**:

- Always use `reference` field for payment lookup (NOT `code`)
- Voucher `code` is the password and should remain private
- `BillRefNumber` in M-Pesa = `voucher.reference`
- Status transitions: `active` → `paid` (after webhook) → `used` (after activation)

---

### 8. Expiry Cron Job

**File**: `scripts/expire-vouchers.ts`

**Purpose**: Automated cleanup of expired vouchers

**Execution**: Run periodically via cron (e.g., every 5 minutes)

**Expiry Types Handled**:

#### 1. Activation Expiry

```typescript
// Vouchers that can no longer be activated
{
  'expiry.expiresAt': { $ne: null, $lte: now },
  status: { $ne: 'expired' }
}
```

#### 2. Purchase Expiry

```typescript
// Purchase-based timer expired
{
  'usage.purchaseExpiresAt': { $ne: null, $lte: now },
  status: { $ne: 'expired' }
}
```

#### 3. Usage Expiry

```typescript
// Active session time limit reached
{
  'usage.expectedEndTime': { $ne: null, $lte: now },
  'usage.startTime': { $ne: null },
  status: { $ne: 'expired' }
}
```

**Processing Steps**:

#### Step 1: Query Expired Vouchers

```typescript
const toExpireMap = new Map<string, any>();

// Deduplicate across all expiry types
for await (const v of activationCursor) {
  toExpireMap.set(v._id.toString(), { voucher: v, reason: 'activationExpiry' });
}
for await (const v of purchaseCursor) {
  toExpireMap.set(v._id.toString(), { voucher: v, reason: 'purchaseExpiry' });
}
for await (const v of usageCursor) {
  toExpireMap.set(v._id.toString(), { voucher: v, reason: 'usageEnded' });
}
```

#### Step 2: Remove from MikroTik

```typescript
if (v.mikrotikUserId || v.voucherInfo?.code) {
  const router = await db.collection('routers').findOne({ _id: v.routerId });
  const conn = getRouterConnectionConfig(router, { forceVPN: true });
  const username = v.voucherInfo?.code;

  await MikroTikService.deleteHotspotUser(conn, username);
}
```

#### Step 3: Update Voucher Status

```typescript
await db.collection('vouchers').updateOne(
  { _id: v._id },
  {
    $set: {
      status: 'expired',
      'usage.endTime': v.usage?.endTime ?? new Date(),
      updatedAt: new Date(),
      'expiry.expiredBy': reason
    }
  }
);
```

#### Step 4: Log Audit

```typescript
await db.collection('audit_logs').insertOne({
  action: {
    type: 'expire',
    resource: 'voucher',
    description: `Voucher expired by cron (${reason})`
  },
  timestamp: new Date()
});
```

**Cron Configuration**:

```bash
# Run every 5 minutes
*/5 * * * * cd /path/to/project && node --loader ts-node/esm scripts/expire-vouchers.ts
```

---

### 9. Captive Portal APIs

#### Packages API

**File**: `src/app/api/captive/packages/route.ts`

**Purpose**: Provide available packages to captive portal

**Endpoint**: `GET /api/captive/packages?routerId=<id>`

**Response**:

```typescript
{
  success: true,
  packages: [
    {
      id: string,
      name: string,
      displayName: string,
      description: string,
      price: number,
      currency: 'KES',
      duration: number,        // minutes
      durationDisplay: string, // "3 Hours"
      bandwidth: {
        upload: number,
        download: number
      },
      bandwidthDisplay: string, // "1Mbps/2Mbps"
      features: string[],
      dataLimit: number,
      recommended: boolean
    }
  ],
  router: {
    name: string,
    location: string
  }
}
```

#### Purchase API

**File**: `src/app/api/captive/purchase/route.ts`

**Purpose**: Initiate M-Pesa STK Push for voucher purchase

**Endpoint**: `POST /api/captive/purchase`

**Request Body**:

```typescript
{
  router_id: string,
  package_id: string,
  phone_number: string,   // Kenyan format: 0712345678 or 254712345678
  mac_address: string     // Device MAC address
}
```

**Flow**:

1. Validate inputs
2. Find package on router
3. Generate unique voucher code
4. Normalize phone number (254 format)
5. Initiate M-Pesa STK Push
6. Create pending transaction
7. Return transaction reference

**Response**:

```typescript
{
  success: true,
  transaction_id: string,
  message: 'Payment initiated. Please check your phone.',
  stk_push: {
    CheckoutRequestID: string,
    MerchantRequestID: string,
    ResponseCode: string,
    ResponseDescription: string
  }
}
```

---

## 💾 Database Schema

### Vouchers Collection

```typescript
{
  _id: ObjectId,
  routerId: ObjectId,
  customerId: ObjectId,
  reference: string,              // Payment reference (PUBLIC)

  voucherInfo: {
    code: string,                 // Username (PRIVATE - password)
    password: string,             // Same as code
    packageType: string,          // MikroTik profile name
    packageDisplayName: string,
    duration: number,             // Minutes
    dataLimit: number,            // Bytes (0 = unlimited)
    bandwidth: {
      upload: number,             // kbps
      download: number
    },
    price: number,
    currency: string
  },

  usage: {
    used: boolean,
    userId: ObjectId | null,      // Customer who activated
    deviceMac: string | null,
    startTime: Date | null,
    endTime: Date | null,
    dataUsed: number,             // Bytes
    timeUsed: number,             // Seconds
    maxDurationMinutes: number,
    expectedEndTime: Date | null, // startTime + maxDurationMinutes
    timedOnPurchase: boolean,
    purchaseExpiresAt: Date | null
  },

  payment: {
    method: string | null,        // 'mpesa'
    transactionId: string | null,
    phoneNumber: string | null,
    amount: number,
    commission: number,
    paymentDate: Date | null
  },

  batch: {
    batchId: string,
    batchSize: number,
    generatedBy: ObjectId
  },

  expiry: {
    expiresAt: Date | null,       // Activation expiry
    autoDelete: boolean,
    expiredBy: string | null      // 'activationExpiry' | 'purchaseExpiry' | 'usageEnded'
  },

  mikrotikUserId: string | null,  // MikroTik .id field
  status: string,                 // 'active' | 'paid' | 'used' | 'expired' | 'cancelled'
  createdAt: Date,
  updatedAt: Date
}
```

### Indexes

```typescript
// Performance indexes
{ routerId: 1, status: 1 }
{ 'voucherInfo.code': 1 }         // Unique
{ reference: 1 }                  // Payment lookup
{ 'expiry.expiresAt': 1 }         // Expiry cron
{ 'usage.purchaseExpiresAt': 1 }  // Purchase expiry cron
{ 'usage.expectedEndTime': 1 }    // Usage expiry cron
{ 'payment.transactionId': 1 }    // M-Pesa lookup
```

---

## 🔐 Security Considerations

### Critical Security Rules

1. **NEVER expose voucher code in URLs or public APIs**

   ```typescript
   ❌ BAD: /api/voucher/activate?code=ABCD1234
   ✅ GOOD: Use payment reference for lookups, share code only after payment
   ```

2. **Use payment reference for M-Pesa transactions**

   ```typescript
   // Public reference for M-Pesa BillRefNumber
   reference: "VCHXYZ123ABC"

   // Private voucher code (password)
   voucherInfo.code: "ABCD1234"
   ```

3. **Validate all webhook signatures in production**

   ```typescript
   // TODO: Uncomment in production
   const signature = headers().get('x-safaricom-signature');
   await verifyMpesaSignature(body, signature);
   ```

4. **Sanitize database queries**

   ```typescript
   // Always validate ObjectId format
   if (!ObjectId.isValid(routerId)) {
     return { error: 'Invalid router ID' };
   }
   ```

5. **Rate limit API endpoints**

   ```typescript
   // Especially:
   // - Voucher generation
   // - Payment initiation
   // - Webhook endpoints
   ```

6. **Use HTTPS for all captive portal APIs**

   ```typescript
   const corsHeaders = {
     'Access-Control-Allow-Origin': '*',
     'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
     'Access-Control-Allow-Headers': 'Content-Type'
   };
   ```

7. **Audit all sensitive operations**
   ```typescript
   await db.collection('audit_logs').insertOne({
     userId: session.user.id,
     action: 'voucher_purchased',
     details: { ... },
     ipAddress: request.headers.get('x-forwarded-for'),
     timestamp: new Date()
   });
   ```

---

## 📡 API Reference

### Merchant APIs

#### Generate Vouchers

```http
POST /api/routers/[id]/vouchers/generate
Authorization: Bearer <session>
Content-Type: application/json

{
  "packageName": "3hours-25ksh",
  "quantity": 10,
  "autoExpire": true,
  "expiryDays": 30,
  "usageTimedOnPurchase": false,
  "syncToRouter": true
}
```

#### List Vouchers

```http
GET /api/routers/[id]/vouchers?status=active&limit=100&skip=0
Authorization: Bearer <session>
```

#### Get Voucher Details

```http
GET /api/routers/[id]/vouchers/[voucherId]
Authorization: Bearer <session>
```

### Captive Portal APIs

#### Get Packages

```http
GET /api/captive/packages?routerId=<id>
```

#### Initiate Purchase

```http
POST /api/captive/purchase
Content-Type: application/json

{
  "router_id": "507f1f77bcf86cd799439011",
  "package_id": "3hours-25ksh",
  "phone_number": "0712345678",
  "mac_address": "AA:BB:CC:DD:EE:FF"
}
```

#### Check Payment Status

```http
GET /api/captive/payment-status?transaction_id=<id>
```

### Webhook

#### M-Pesa Confirmation

```http
POST /api/webhooks/mpesa
Content-Type: application/json

{
  "TransID": "ABC123XYZ",
  "TransAmount": "25.00",
  "MSISDN": "254712345678",
  "BillRefNumber": "VCHXYZ123ABC",
  "TransTime": "20250131123456",
  "BusinessShortCode": "174379",
  "OrgAccountBalance": "1000.00"
}
```

---

## 🎯 Key Takeaways

### Voucher Generation

1. Generates unique voucher codes with MikroTik sync
2. Creates payment reference separate from voucher code
3. Supports multiple expiry strategies
4. Calculates commission based on customer type

### Payment Flow

1. Customer initiates purchase via captive portal
2. M-Pesa STK Push sent to phone
3. Customer enters PIN
4. Webhook updates voucher to 'paid' status
5. Customer receives voucher code (NOT via API)

### Expiry Strategies

1. **Activation Expiry** - Unused vouchers expire after X days
2. **Purchase Expiry** - Purchased vouchers expire after package duration from purchase
3. **Usage Expiry** - Active sessions expire after package duration from activation

### MikroTik Integration

1. Users created during voucher generation (if sync enabled)
2. `limitUptime` controls session duration
3. MikroTik handles authentication and session management
4. Cron job removes expired users from router

### Security

1. Payment reference (PUBLIC) ≠ Voucher code (PRIVATE)
2. Webhook signature validation required in production
3. Rate limiting on all public endpoints
4. Audit logging for sensitive operations

---

## 🚀 Next Steps

### Development Tasks

- [ ] Implement webhook signature verification
- [ ] Add rate limiting to APIs
- [ ] Create SMS/email notification system
- [ ] Build customer voucher lookup portal
- [ ] Add bulk voucher import/export
- [ ] Implement voucher analytics dashboard

### Production Checklist

- [ ] Enable M-Pesa production credentials
- [ ] Set up SSL certificates for APIs
- [ ] Configure cron jobs on server
- [ ] Set up monitoring and alerts
- [ ] Test webhook failover scenarios
- [ ] Document customer support procedures

---

## 📞 Support

For questions or issues:

- Check logs in `webhook_logs` collection
- Review audit logs for user actions
- Test MikroTik connectivity with `testConnection()`
- Verify voucher status in database

---

**Last Updated**: October 31, 2025  
**Version**: 1.0.0  
**Author**: System Documentation
