# M-Pesa Webhook SMS Integration

## Overview

Enhanced M-Pesa C2B confirmation webhook to automatically send voucher codes to customers via SMS
using MobileSasa after successful payment.

---

## What Was Updated

### 1. **Seed Database Script** (`scripts/seed-database.ts`)

Added 5 system message templates:

#### **Templates Created:**

1. **Voucher Purchase Confirmation** (Transactional)

   ```
   Thank you for your purchase! Your WiFi voucher code is: {code}.
   Package: {package}. Valid for {duration}. Enjoy your internet!
   ```

   Variables: `{code}`, `{package}`, `{duration}`

2. **Voucher Expiry Reminder** (Notification)

   ```
   Hi {name}, your WiFi voucher will expire in {hours} hours.
   Remaining data: {data}. Purchase a new voucher to stay connected!
   ```

   Variables: `{name}`, `{hours}`, `{data}`

3. **Welcome New Customer** (Marketing)

   ```
   Welcome to {router_name}! Thank you for choosing us.
   Enjoy fast and reliable WiFi. For support, contact us anytime.
   ```

   Variables: `{router_name}`

4. **Payment Received** (Transactional)

   ```
   Payment of KES {amount} received successfully.
   Transaction ID: {transaction_id}. Thank you!
   ```

   Variables: `{amount}`, `{transaction_id}`

5. **Service Maintenance Notice** (Advisory)
   ```
   Scheduled maintenance on {date} from {start_time} to {end_time}.
   WiFi service may be temporarily unavailable. We apologize for any inconvenience.
   ```
   Variables: `{date}`, `{start_time}`, `{end_time}`

---

### 2. **M-Pesa Webhook** (`src/app/api/webhooks/p8ytqrbul/route.ts`)

#### **Changes Made:**

✅ **Imported MessagingService**

```typescript
import { MessagingService } from '@/lib/services/messaging';
```

✅ **SMS on Successful Voucher Assignment** (Line ~270-360)

- Fetches "Voucher Purchase Confirmation" template
- Formats duration (minutes → hours/days)
- Replaces template variables with actual values
- Sends SMS via MobileSasa
- Logs delivery status in `messages` collection
- Increments template usage count

✅ **SMS on Out-of-Stock** (Line ~440-480)

- Sends friendly "voucher will be sent within 24 hours" message
- Uses direct message (no template)
- Logs SMS delivery

✅ **SMS on Manual Payment** (Line ~750-850)

- Handles payments made directly to paybill
- Uses same "Voucher Purchase Confirmation" template
- Sends voucher code to customer

---

## How It Works

### **Flow 1: STK Push Payment (Normal Flow)**

```
1. Customer initiates STK Push
   ├─ Creates stk_initiation record
   └─ Creates purchase_attempt record

2. Customer enters M-Pesa PIN
   └─ Payment processed by Safaricom

3. STK Callback arrives
   ├─ Updates payment status (pending_confirmation)
   └─ Does NOT assign voucher (to avoid race conditions)

4. C2B Confirmation arrives (THIS WEBHOOK)
   ├─ Looks up STK initiation by BillRefNumber
   ├─ Assigns voucher from pool
   ├─ Links to payment record
   └─ 📱 SENDS SMS WITH VOUCHER CODE ✅

5. Customer receives SMS
   └─ "Thank you for your purchase! Your WiFi voucher code is: ABC123..."
```

### **Flow 2: Out-of-Stock Scenario**

```
1-3. Same as above (STK Push → PIN → Callback)

4. C2B Confirmation arrives
   ├─ Tries to assign voucher from pool
   ├─ No active vouchers available
   ├─ Marks payment as pending_voucher
   └─ 📱 SENDS OUT-OF-STOCK SMS ✅

5. Customer receives SMS
   └─ "Payment of KES 100 received successfully. Your voucher code will be sent within 24 hours..."
```

### **Flow 3: Manual Payment**

```
1. Customer pays directly to paybill
   └─ Uses BillRefNumber = voucher.reference

2. C2B Confirmation arrives
   ├─ No STK initiation found
   ├─ Looks up voucher by BillRefNumber
   ├─ Marks voucher as paid
   └─ 📱 SENDS SMS WITH VOUCHER CODE ✅

3. Customer receives SMS
   └─ "Thank you for your purchase! Your WiFi voucher code is: XYZ789..."
```

---

## SMS Message Examples

### **Successful Purchase (STK Push)**

```
Thank you for your purchase! Your WiFi voucher code is: ABC123XYZ.
Package: 1 Hour Access. Valid for 1 hour. Enjoy your internet!
```

### **Successful Purchase (Multi-hour)**

```
Thank you for your purchase! Your WiFi voucher code is: DEF456GHI.
Package: Daily Pass. Valid for 12 hours. Enjoy your internet!
```

### **Successful Purchase (Multi-day)**

```
Thank you for your purchase! Your WiFi voucher code is: JKL789MNO.
Package: Weekly Pass. Valid for 7 days. Enjoy your internet!
```

### **Out-of-Stock**

```
Payment of KES 50 received successfully. Your voucher code will be sent
within 24 hours. Ref: MPESA1234567890. Thank you for your patience!
```

### **Manual Payment**

```
Thank you for your purchase! Your WiFi voucher code is: PQR012STU.
Package: 3 Hour Access. Valid for 3 hours. Enjoy your internet!
```

---

## Duration Formatting Logic

The webhook automatically converts minutes to readable format:

| Duration (Minutes) | Formatted Output |
| ------------------ | ---------------- |
| 30                 | `30 minutes`     |
| 60                 | `1 hour`         |
| 120                | `2 hours`        |
| 180                | `3 hours`        |
| 1440               | `1 day`          |
| 2880               | `2 days`         |
| 10080              | `7 days`         |

```typescript
// Logic in webhook
if (durationMinutes < 60) {
  return `${durationMinutes} minutes`;
} else if (durationMinutes === 60) {
  return '1 hour';
} else if (durationMinutes < 1440) {
  const hours = Math.floor(durationMinutes / 60);
  return `${hours} hour${hours > 1 ? 's' : ''}`;
} else {
  const days = Math.floor(durationMinutes / 1440);
  return `${days} day${days > 1 ? 's' : ''}`;
}
```

---

## Database Records Created

### **messages Collection**

Every SMS sent is logged in the `messages` collection:

```typescript
{
  _id: ObjectId,
  userId: ObjectId,                    // Router owner (if available)
  recipientType: 'individual',         // Single customer
  routerId: ObjectId,                  // Router ID
  templateId: ObjectId,                // Template used (or null)
  message: string,                     // Actual message sent
  recipientCount: 1,
  successfulDeliveries: 1,
  failedDeliveries: 0,
  recipients: [{
    phone: '254712345678',
    status: 'sent',
    messageId: 'msg_abc123',           // MobileSasa message ID
  }],
  status: 'sent',
  sentAt: Date,
  createdAt: Date,
  metadata: {
    trigger: 'voucher_purchase',       // or 'manual_voucher_purchase', 'voucher_out_of_stock'
    voucherId: ObjectId,
    transactionId: 'MPESA1234567890',
    billRefNumber?: string,
    amount?: number,
  }
}
```

### **Template Usage Tracking**

Each time a template is used, its `usageCount` is incremented:

```typescript
{
  name: 'Voucher Purchase Confirmation',
  usageCount: 45,  // ← Incremented after each SMS
  updatedAt: Date,
  // ... other fields
}
```

---

## Error Handling

### **SMS Failure (Non-Critical)**

If SMS fails, the webhook:

- ✅ Still processes payment successfully
- ✅ Assigns voucher to customer
- ✅ Logs error in webhook_logs collection
- ✅ Returns success to Safaricom
- ❌ Customer doesn't receive SMS (manual follow-up needed)

```typescript
try {
  // Send SMS
} catch (smsError) {
  console.error('SMS failed:', smsError);
  // Don't fail the webhook - SMS is nice-to-have
}
```

### **Template Not Found**

If template is missing:

- ⚠ Warning logged: "Template 'Voucher Purchase Confirmation' not found"
- ✅ Payment still processes
- ❌ No SMS sent
- 💡 Solution: Run seed script to create templates

### **Invalid Phone Number**

MobileSasa handles this gracefully:

- Normalizes Kenyan phone numbers
- Returns error if invalid format
- Error logged in webhook_logs
- Payment still successful

---

## Phone Number Support

### **MobileSasa Intelligent Phone Handling**

MobileSasa can accept:

1. **Regular phone number**: `254712345678`
2. **SHA-256 hashed phone**: `abc123def456...` (for privacy)

The webhook uses regular phone numbers by default:

```typescript
const smsResult = await MessagingService.sendSingleSMS(
  phoneNumber,  // Can be plain or SHA-256
  smsMessage
);
```

### **SHA-256 Phone Numbers**

Customers are stored with both formats:

```typescript
{
  phone: '254712345678',
  sha256Phone: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  // ...
}
```

To use SHA-256 for privacy:

```typescript
const smsResult = await MessagingService.sendSingleSMS(
  customer.sha256Phone,  // ← Use hashed version
  smsMessage
);
```

---

## Testing

### **1. Test Template Creation**

Run seed script:

```bash
pnpm tsx scripts/seed-database.ts
```

Verify templates exist:

```javascript
db.message_templates.find({ isSystem: true }).pretty();
```

### **2. Test STK Push Payment**

Initiate payment → Enter PIN → Check SMS received

Expected SMS:

```
Thank you for your purchase! Your WiFi voucher code is: ABC123.
Package: 1 Hour Access. Valid for 1 hour. Enjoy your internet!
```

### **3. Test Manual Payment**

Pay directly to paybill with BillRefNumber → Check SMS

### **4. Test Out-of-Stock**

1. Delete all active vouchers for a package
2. Initiate payment
3. Check out-of-stock SMS received

### **5. Check SMS Logs**

View all sent messages:

```javascript
db.messages
  .find({
    'metadata.trigger': {
      $in: ['voucher_purchase', 'manual_voucher_purchase', 'voucher_out_of_stock'],
    },
  })
  .sort({ sentAt: -1 })
  .limit(10)
  .pretty();
```

### **6. Check Template Usage**

```javascript
db.message_templates.find(
  { name: 'Voucher Purchase Confirmation' },
  { name: 1, usageCount: 1, updatedAt: 1 }
);
```

---

## Monitoring

### **SMS Delivery Success Rate**

```javascript
// Get last 100 voucher purchase SMS
db.messages.aggregate([
  {
    $match: {
      'metadata.trigger': 'voucher_purchase',
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
    },
  },
  {
    $group: {
      _id: null,
      totalSent: { $sum: '$successfulDeliveries' },
      totalFailed: { $sum: '$failedDeliveries' },
      count: { $sum: 1 },
    },
  },
  {
    $project: {
      successRate: {
        $multiply: [{ $divide: ['$totalSent', { $add: ['$totalSent', '$totalFailed'] }] }, 100],
      },
      totalSent: 1,
      totalFailed: 1,
      count: 1,
    },
  },
]);
```

### **Failed SMS Attempts**

```javascript
// Find failed SMS in last 24 hours
db.webhook_logs
  .find({
    type: 'sms_failed',
    timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  })
  .sort({ timestamp: -1 })
  .pretty();
```

### **Template Performance**

```javascript
// Most used templates
db.message_templates
  .find(
    {},
    {
      name: 1,
      category: 1,
      usageCount: 1,
    }
  )
  .sort({ usageCount: -1 });
```

---

## Cost Tracking

### **SMS Cost per Voucher Sale**

Assuming KES 0.80 per SMS:

| Scenario            | SMS Sent | Cost per Transaction |
| ------------------- | -------- | -------------------- |
| Successful purchase | 1 SMS    | KES 0.80             |
| Out-of-stock        | 1 SMS    | KES 0.80             |
| Manual payment      | 1 SMS    | KES 0.80             |

### **Monthly SMS Estimate**

```
100 voucher sales/month × KES 0.80 = KES 80/month
1000 voucher sales/month × KES 0.80 = KES 800/month
```

### **Calculate Actual SMS Costs**

```javascript
// SMS sent in last month
db.messages.aggregate([
  {
    $match: {
      'metadata.trigger': {
        $in: ['voucher_purchase', 'manual_voucher_purchase', 'voucher_out_of_stock'],
      },
      sentAt: {
        $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        $lte: new Date(),
      },
    },
  },
  {
    $group: {
      _id: null,
      totalSMS: { $sum: '$successfulDeliveries' },
      estimatedCost: { $sum: { $multiply: ['$successfulDeliveries', 0.8] } },
    },
  },
]);
```

---

## Troubleshooting

### **Customer Didn't Receive SMS**

**Check 1: Was SMS sent?**

```javascript
db.messages.findOne({
  'metadata.transactionId': 'MPESA1234567890',
});
```

**Check 2: Check webhook logs**

```javascript
db.webhook_logs.findOne({
  'metadata.TransID': 'MPESA1234567890',
});
```

**Check 3: MobileSasa API error**

```javascript
db.webhook_logs.find({
  type: 'sms_failed',
  timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
});
```

### **Wrong Phone Number**

Customer phone might be in different format:

```javascript
// Check customer record
db.customers.findOne({ phone: { $regex: '712345678' } });

// Update if needed
db.customers.updateOne({ _id: ObjectId('...') }, { $set: { phone: '254712345678' } });
```

### **Template Not Working**

Re-create templates:

```bash
pnpm tsx scripts/seed-database.ts
```

Or manually:

```javascript
db.message_templates.insertOne({
  name: 'Voucher Purchase Confirmation',
  category: 'transactional',
  message:
    'Thank you for your purchase! Your WiFi voucher code is: {code}. Package: {package}. Valid for {duration}. Enjoy your internet!',
  variables: ['code', 'package', 'duration'],
  isSystem: true,
  isActive: true,
  usageCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
});
```

---

## Security Considerations

✅ **Voucher Code Privacy**

- Codes sent via SMS (encrypted in transit)
- Not logged in plain text in webhook logs
- Only logged in messages collection (authorized access)

✅ **Phone Number Protection**

- Support for SHA-256 hashed phone numbers
- Customer phone numbers not exposed in logs

✅ **SMS Delivery Confirmation**

- MobileSasa message IDs stored
- Can track delivery status per message

---

## Future Enhancements

### **Planned Features:**

1. **SMS Delivery Status Tracking**
   - Poll MobileSasa for delivery reports
   - Update message status: sent → delivered → read

2. **Retry Failed SMS**
   - Automatic retry for failed deliveries
   - Exponential backoff (5min, 15min, 1hr)

3. **Custom Templates per Router**
   - Router owners can customize SMS messages
   - Branding (business name, support contact)

4. **Multi-language Support**
   - English, Swahili templates
   - Detect customer language preference

5. **SMS Analytics Dashboard**
   - Delivery rates
   - Cost tracking
   - Peak usage times

---

## Summary

✅ **Complete SMS Integration**

- Voucher codes sent automatically after payment
- Uses MobileSasa SMS gateway
- Template-based messaging system
- Comprehensive error handling
- Full audit trail

✅ **Three SMS Scenarios Covered**

1. STK Push successful → Send voucher code
2. Out-of-stock → Send "pending" message
3. Manual payment → Send voucher code

✅ **Production-Ready**

- Non-blocking (doesn't fail webhook if SMS fails)
- Logging and monitoring
- Cost tracking
- Template management

🎉 **Ready to Deploy!**
