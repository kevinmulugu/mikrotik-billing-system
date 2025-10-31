# MikroTik MAC Address Binding & Voucher Purchase Analysis

**Date**: November 1, 2025  
**Status**: ⚠️ PARTIAL IMPLEMENTATION - MAC Binding Missing  
**Reviewer**: AI Assistant

---

## Executive Summary

After reviewing the captive portal purchase flow and MikroTik voucher implementation, I found:

1. ✅ **MAC Address is Captured**: During purchase in `/api/captive/purchase`, the user's MAC
   address is stored
2. ❌ **MAC Binding Not Implemented**: MAC address is NOT bound to the MikroTik hotspot user
3. ❌ **Auto-Reconnection Not Supported**: Users must re-enter voucher code after disconnection
4. ⚠️ **Time-Based Expiry Partially Implemented**: Purchase-time expiry logic exists but needs
   enhancement
5. ✅ **SMS Notification Ready**: Infrastructure exists for SMS integration

---

## Issue 1: MAC Address Binding (Auto-Reconnection)

### Current Implementation

**Purchase Flow** (`src/app/api/captive/purchase/route.ts`):

```typescript
// Line 161: MAC address is captured
const normalizedMac = normalizeMacAddress(mac_address);

// Lines 440-444: Stored in payment metadata
metadata: {
  mac_address: normalizedMac,
  package_id: selectedPackage.name,
  router_name: router.routerInfo?.name,
}

// Lines 473: Stored in voucher but NOT used
usage: {
  used: false,
  userId: null as string | null,
  deviceMac: null as string | null,  // ❌ NOT populated during purchase
  startTime: null as Date | null,
  endTime: null as Date | null,
}
```

**Problem**: When the webhook activates the voucher, it does NOT bind the MAC address to the
MikroTik user.

### MikroTik MAC Binding Support

**✅ YES, MikroTik Supports MAC Address Binding** via the `mac-address` field in `/ip/hotspot/user`:

```bash
# MikroTik CLI Example
/ip/hotspot/user add \
  name=VOUCHER123 \
  password=VOUCHER123 \
  profile=1hr-50ksh \
  limit-uptime=1h \
  mac-address=AA:BB:CC:DD:EE:FF \
  server=hotspot1
```

**Benefits**:

- User auto-reconnects without entering code again
- Prevents voucher sharing (one device only)
- Better security and tracking

**How It Works**:

1. User purchases voucher and logs in for the first time
2. MikroTik captures their MAC address during first authentication
3. System binds MAC to the hotspot user
4. When user reconnects (within time limit), MikroTik recognizes MAC and auto-connects
5. If MAC doesn't match, login fails (prevents sharing)

### Recommended Implementation

#### Step 1: Update Webhook to Bind MAC Address

**File**: `src/app/api/webhooks/mpesa/callback/route.ts`

Add after voucher activation (around line 250-280):

```typescript
// After updating voucher status to 'active'
await vouchersCollection.updateOne(
  { _id: voucher._id },
  {
    $set: {
      status: 'active',
      'payment.transactionId': mpesaReceiptNumber,
      'payment.paymentDate': purchaseTime,
      'payment.amount': amount,
      'payment.commission': commissionAmount,
      // ✅ NEW: Store MAC for future reference
      'usage.purchaseMac': payment.metadata?.mac_address || null,
      updatedAt: new Date(),
    }
  }
);

// ✅ NEW: Create/Update MikroTik hotspot user with MAC binding
if (router && router.health?.status === 'online') {
  try {
    const routerConfig = getRouterConnectionConfig(router, {
      forceVPN: true,
      forceLocal: false
    });

    // Check if user already exists
    const existingUser = await MikroTikService.getHotspotUser(
      routerConfig,
      voucher.voucherInfo.code
    );

    if (existingUser) {
      // Update existing user to bind MAC address
      await MikroTikService.updateHotspotUser(
        routerConfig,
        voucher.voucherInfo.code,
        {
          'mac-address': payment.metadata?.mac_address || ''
        }
      );
      console.log(`[Webhook] Bound MAC ${payment.metadata?.mac_address} to voucher ${voucher.voucherInfo.code}`);
    } else {
      // Create new user with MAC binding
      await MikroTikService.createHotspotUser(
        routerConfig,
        {
          name: voucher.voucherInfo.code,
          password: voucher.voucherInfo.password,
          profile: voucher.voucherInfo.packageType,
          limitUptime: convertMinutesToMikroTikFormat(voucher.voucherInfo.duration),
          macAddress: payment.metadata?.mac_address || '', // ✅ NEW FIELD
          server: 'hotspot1',
          comment: `Purchased via M-Pesa - ${mpesaReceiptNumber}`
        }
      );
      console.log(`[Webhook] Created MikroTik user with MAC binding for voucher ${voucher.voucherInfo.code}`);
    }
  } catch (mikrotikError) {
    console.error('[Webhook] Failed to bind MAC to MikroTik user:', mikrotikError);
    // Don't fail the webhook - payment is successful
  }
}
```

#### Step 2: Update MikroTikService to Support MAC Address

**File**: `lib/services/mikrotik.ts`

Update `createHotspotUser` method (around line 750):

```typescript
interface HotspotUserConfig {
  name: string;
  password: string;
  profile: string;
  limitUptime: string;
  server?: string;
  comment?: string;
  macAddress?: string; // ✅ NEW: Optional MAC address binding
}

static async createHotspotUser(
  config: MikroTikConnectionConfig,
  userConfig: HotspotUserConfig
): Promise<any> {
  try {
    const comment = userConfig.comment ||
      `${userConfig.profile} voucher - Generated automatically`;
    const server = userConfig.server || 'hotspot1';

    if (!userConfig.name || !userConfig.password || !userConfig.profile) {
      throw new Error('name, password, and profile are required');
    }

    if (!userConfig.limitUptime) {
      throw new Error('limitUptime is required for hotspot users');
    }

    const mikrotikPayload: any = {
      name: userConfig.name,
      password: userConfig.password,
      profile: userConfig.profile,
      'limit-uptime': userConfig.limitUptime,
      server: server,
      comment: comment,
    };

    // ✅ NEW: Add MAC address binding if provided
    if (userConfig.macAddress && userConfig.macAddress !== '') {
      mikrotikPayload['mac-address'] = userConfig.macAddress;
      console.log(`[MikroTik] Binding MAC ${userConfig.macAddress} to user ${userConfig.name}`);
    }

    return await this.makeHybridRequest(
      config,
      '/rest/ip/hotspot/user',
      mikrotikPayload
    );
  } catch (error) {
    console.error('Failed to create hotspot user:', error);
    throw error;
  }
}

// ✅ NEW: Add update method for hotspot users
static async updateHotspotUser(
  config: MikroTikConnectionConfig,
  username: string,
  updates: Record<string, any>
): Promise<boolean> {
  try {
    const user = await this.getHotspotUser(config, username);
    if (!user) {
      console.warn(`User ${username} not found on router`);
      return false;
    }

    const userId = user['.id'];
    await this.makeRequest(
      config,
      `/rest/ip/hotspot/user/${userId}`,
      'PATCH',
      updates
    );

    console.log(`[MikroTik] Updated user ${username}:`, updates);
    return true;
  } catch (error) {
    console.error('Failed to update hotspot user:', error);
    throw error;
  }
}
```

#### Step 3: Handle First-Time Login MAC Capture

**Background**: When user logs in via captive portal, MikroTik automatically captures their MAC. We
should update our database to reflect this.

**Option A**: MikroTik Webhook (if configured):

- Set up MikroTik to call webhook on user authentication
- Update voucher.usage.deviceMac with authenticated MAC

**Option B**: Polling (simpler):

- After payment, poll MikroTik to check if user is connected
- Update database with actual connected MAC

**Recommendation**: Implement Option B initially, add Option A later.

---

## Issue 2: Time-Based Expiry (Purchase-Time Clock)

### Current Implementation

**Voucher Generation** (`src/app/api/routers/[id]/vouchers/generate/route.ts`):

```typescript
// Lines 285-298: Usage tracking structure
usage: {
  used: false,
  userId: null,
  deviceMac: null,
  startTime: null,
  endTime: null,
  dataUsed: 0,
  timeUsed: 0,
  maxDurationMinutes: duration,  // ✅ Stored
  expectedEndTime: null,
  timedOnPurchase: !!usageTimedOnPurchase,  // ✅ Flag exists
  purchaseExpiresAt: null,  // ❌ NOT calculated in webhook
}
```

**Problem**: The `purchaseExpiresAt` field is set to `null` and never populated by the webhook.

### How It Should Work

**Example**: User purchases 1-hour voucher at 7:00 AM

- **Purchase Time**: 7:00 AM
- **Package Duration**: 60 minutes
- **Purchase Expiry**: 7:00 AM + 60 min = 8:00 AM
- **Behavior**: At 8:00 AM, voucher expires whether used or not

**MikroTik Limitation**: MikroTik's `limit-uptime` only counts **connection time**, not wall-clock
time.

- If user connects at 7:00 AM and disconnects after 10 minutes, they have 50 minutes remaining
- Those 50 minutes can be used anytime before the voucher expires
- **But**: MikroTik does NOT automatically enforce a purchase-time deadline

**Solution**: We must implement purchase-time expiry in our cron job.

### Recommended Implementation

#### Step 1: Set purchaseExpiresAt in Webhook

**File**: `src/app/api/webhooks/mpesa/callback/route.ts`

Add when activating voucher:

```typescript
// Calculate purchase-time expiry
const purchaseTime = new Date();
const packageDuration = voucher.voucherInfo.duration; // minutes
const purchaseExpiresAt = new Date(purchaseTime.getTime() + packageDuration * 60 * 1000);

// Update voucher with purchase expiry
await vouchersCollection.updateOne(
  { _id: voucher._id },
  {
    $set: {
      status: 'active',
      'payment.transactionId': mpesaReceiptNumber,
      'payment.paymentDate': purchaseTime,
      'payment.amount': amount,
      'payment.commission': commissionAmount,
      // ✅ NEW: Set purchase-based expiry deadline
      'usage.purchaseExpiresAt': purchaseExpiresAt,
      'usage.timedOnPurchase': true,
      updatedAt: new Date(),
    }
  }
);

console.log(`[Webhook] Voucher ${voucher.voucherInfo.code} will expire at ${purchaseExpiresAt.toISOString()} (${packageDuration} minutes from purchase)`);
```

#### Step 2: Update Expiry Cron Job

**File**: `scripts/expire-vouchers.ts`

Add purchase-time expiry check:

```typescript
// Find vouchers that have purchase-time expiry enabled and have exceeded their deadline
const now = new Date();

const purchaseExpiredVouchers = await db.collection('vouchers').find({
  status: 'active',
  'usage.timedOnPurchase': true,
  'usage.purchaseExpiresAt': { $lte: now }, // Purchase deadline passed
}).toArray();

console.log(`Found ${purchaseExpiredVouchers.length} vouchers with purchase-time expiry passed`);

for (const voucher of purchaseExpiredVouchers) {
  console.log(`[Expire] Voucher ${voucher.voucherInfo.code} exceeded purchase-time deadline`);

  // Get router
  const router = await db.collection('routers').findOne({ _id: voucher.routerId });

  if (router && router.health?.status === 'online') {
    try {
      const routerConfig = getRouterConnectionConfig(router, { forceVPN: true });

      // Remove from MikroTik
      const deleted = await MikroTikService.deleteHotspotUser(
        routerConfig,
        voucher.voucherInfo.code
      );

      if (deleted) {
        console.log(`[Expire] Deleted MikroTik user ${voucher.voucherInfo.code}`);
      }
    } catch (error) {
      console.error(`[Expire] Failed to delete MikroTik user:`, error);
    }
  }

  // Mark voucher as expired in database
  await db.collection('vouchers').updateOne(
    { _id: voucher._id },
    {
      $set: {
        status: 'expired',
        'usage.endTime': now,
        updatedAt: now,
      }
    }
  );

  expiredCount++;
}
```

#### Step 3: Update Voucher Generation Route

**File**: `src/app/api/routers/[id]/vouchers/generate/route.ts`

Already has the flag, just ensure it's documented:

```typescript
// Line 104: usageTimedOnPurchase parameter
// Whether voucher usage should be timed starting from purchase time
usageTimedOnPurchase = false,  // ✅ EXISTING - defaults to false for manual vouchers
```

**Note**: For captive portal purchases, this should be configurable per package. Add to router
package configuration:

```typescript
// In router packages configuration
{
  name: "1hr-50ksh",
  displayName: "1 Hour",
  duration: 60,  // minutes
  price: 50,
  purchaseTimeExpiry: true,  // ✅ NEW: Enable purchase-time expiry for this package
  bandwidth: { upload: 3072, download: 5120 }
}
```

---

## Issue 3: SMS Notification (Voucher Code Backup)

### Current Status

✅ **SMS Infrastructure Ready**: System already has SMS capability via M-Pesa ⏳ **TODO**: Implement
voucher code SMS notification

### Implementation Plan

**File**: `src/app/api/webhooks/mpesa/callback/route.ts`

Add after voucher activation:

```typescript
// ✅ TODO: Send SMS with voucher code
// After successful payment and voucher activation
try {
  // Option 1: Use Africa's Talking SMS Gateway (recommended)
  // Option 2: Use M-Pesa B2C as SMS channel (creative but limited)
  // Option 3: Use third-party SMS service (Twilio, etc.)

  const phoneNumber = payment.mpesa.phoneNumber;
  const voucherCode = voucher.voucherInfo.code;
  const packageName = voucher.voucherInfo.packageDisplayName;
  const expiryTime = purchaseExpiresAt.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });

  const smsMessage = `Your WiFi voucher: ${voucherCode}. Package: ${packageName}. Expires: ${expiryTime}. Thank you!`;

  // TODO: Implement SMS sending
  // await sendSMS(phoneNumber, smsMessage);

  console.log(`[Webhook] TODO: Send SMS to ${phoneNumber}: ${smsMessage}`);

  // Log SMS attempt
  await db.collection('sms_logs').insertOne({
    phoneNumber: phoneNumber,
    message: smsMessage,
    voucherId: voucher._id,
    paymentId: payment._id,
    status: 'pending',  // 'pending', 'sent', 'failed'
    provider: 'africas_talking',  // or 'twilio', etc.
    timestamp: new Date(),
  });

} catch (smsError) {
  console.error('[Webhook] Failed to send SMS:', smsError);
  // Don't fail the webhook - payment is successful
}
```

### SMS Provider Recommendations

**Option 1: Africa's Talking (Recommended)**

- Local to Kenya
- Cost: ~KES 0.80 per SMS
- Easy integration
- Reliable delivery

```typescript
// Example integration
import AfricasTalking from 'africastalking';

const africastalking = AfricasTalking({
  apiKey: process.env.AFRICASTALKING_API_KEY,
  username: process.env.AFRICASTALKING_USERNAME,
});

const sms = africastalking.SMS;

async function sendSMS(phoneNumber: string, message: string) {
  const result = await sms.send({
    to: [phoneNumber],
    message: message,
    from: process.env.AFRICASTALKING_SHORTCODE, // Optional shortcode
  });
  return result;
}
```

**Option 2: Twilio (International)**

- Global coverage
- Cost: ~$0.05 per SMS
- Excellent documentation

**Option 3: Custom Integration**

- Use existing M-Pesa B2C for creative SMS (not recommended)
- Limited to payment confirmation format

---

## Summary of Required Changes

### Priority 1: MAC Address Binding (Auto-Reconnection)

**Files to Modify**:

1. ✅ `lib/services/mikrotik.ts` - Add `macAddress` field to `createHotspotUser`
2. ✅ `lib/services/mikrotik.ts` - Add `updateHotspotUser` method
3. ✅ `src/app/api/webhooks/mpesa/callback/route.ts` - Bind MAC after payment

**Benefits**:

- Users don't need to re-enter code after disconnecting
- Prevents voucher sharing
- Better user experience

**Testing**:

```bash
# Test MAC binding
curl -X GET "http://router-ip/rest/ip/hotspot/user" --user admin:password | jq
# Should show mac-address field populated
```

### Priority 2: Purchase-Time Expiry

**Files to Modify**:

1. ✅ `src/app/api/webhooks/mpesa/callback/route.ts` - Set `purchaseExpiresAt`
2. ✅ `scripts/expire-vouchers.ts` - Add purchase-time expiry check
3. ⏳ Router package configuration - Add `purchaseTimeExpiry` flag per package

**Benefits**:

- Fair pricing (1-hour package = 1 hour from purchase)
- Prevents abuse (buying cheap package, using over many days)
- Clear expectations for customers

### Priority 3: SMS Notification (TODO)

**Files to Create**:

1. ⏳ `lib/services/sms.ts` - SMS service wrapper
2. ⏳ Add SMS sending to webhook callback
3. ⏳ Database collection: `sms_logs`

**Benefits**:

- Backup delivery method
- Better customer experience
- Reduces support queries

---

## Testing Checklist

### MAC Binding Tests

- [ ] Purchase voucher from captive portal
- [ ] Login with voucher code (first time)
- [ ] Disconnect from WiFi
- [ ] Reconnect to WiFi (should auto-connect without code)
- [ ] Try using same voucher from different device (should fail)
- [ ] Check MikroTik user has `mac-address` field set

### Purchase-Time Expiry Tests

- [ ] Purchase 1-hour voucher at 10:00 AM
- [ ] Use for 10 minutes (10:00-10:10)
- [ ] Disconnect and wait
- [ ] Try to reconnect at 11:01 AM (should fail - expired)
- [ ] Verify cron job marked voucher as expired
- [ ] Verify MikroTik user was deleted

### SMS Notification Tests (When Implemented)

- [ ] Purchase voucher
- [ ] Receive SMS with voucher code within 30 seconds
- [ ] Verify SMS contains correct code and expiry time
- [ ] Check `sms_logs` collection for delivery status

---

## FAQ

**Q: Can multiple devices use the same voucher with MAC binding?** A: No. Once MAC is bound, only
that device can use the voucher. This prevents sharing.

**Q: What if user changes their device (new phone)?** A: They would need to purchase a new voucher.
MAC binding is intentional security.

**Q: Does MikroTik support MAC binding?** A: Yes, via the `mac-address` field in `/ip/hotspot/user`.
Fully supported.

**Q: How does purchase-time expiry work with MikroTik's limit-uptime?** A: MikroTik enforces session
time (connection duration). We enforce calendar time (purchase deadline). Both work together: user
hits whichever limit comes first.

**Q: Can we disable MAC binding for specific packages?** A: Yes, make it configurable per package in
router configuration.

**Q: What happens if webhook fails to bind MAC?** A: Payment is still successful, voucher is active,
user can login manually. MAC binding is best-effort.

---

## Conclusion

### Current State:

- ❌ MAC binding: **NOT IMPLEMENTED**
- ⚠️ Purchase-time expiry: **PARTIALLY IMPLEMENTED** (structure exists, logic missing)
- ⏳ SMS notification: **TODO** (commented in code)

### Recommended Action:

1. **Immediate**: Implement MAC binding (Priority 1) - Significantly improves UX
2. **Short-term**: Complete purchase-time expiry (Priority 2) - Fair pricing
3. **Medium-term**: Add SMS notifications (Priority 3) - Nice to have

### Effort Estimate:

- MAC binding: ~2-3 hours (testing included)
- Purchase-time expiry: ~1-2 hours (mostly cron updates)
- SMS integration: ~4-6 hours (includes provider setup)

**Total**: ~7-11 hours for complete implementation

---

**End of Analysis**
