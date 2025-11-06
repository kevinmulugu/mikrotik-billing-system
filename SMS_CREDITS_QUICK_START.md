# SMS Credits - Quick Start Guide

## 🚀 For Users

### How to Purchase SMS Credits

1. **Navigate to SMS Credits Page**
   - Click the SMS credits badge in navbar
   - Or go to: `/sms-credits`

2. **Choose a Package**
   - Starter (50 credits): KES 50
   - Basic (100 + 5 bonus): KES 95 ⭐ 5% off
   - **Standard (250 + 25 bonus): KES 225** ⭐ Most Popular
   - Premium (500 + 75 bonus): KES 425
   - Business (1,000 + 200 bonus): KES 800
   - Enterprise (2,500 + 625 bonus): KES 1,875

3. **Enter Your M-Pesa Number**
   - Format: 254712345678 or 0712345678

4. **Complete Payment**
   - Check your phone for STK Push prompt
   - Enter M-Pesa PIN
   - Wait for confirmation

5. **Credits Added Automatically**
   - Refresh page to see new balance
   - Check transaction history

### How SMS Credits Work

**Sending SMS:**

- Messages under 160 characters = 1 credit
- Longer messages split into parts (153 chars each)
- Credits deducted automatically after successful delivery
- If insufficient credits, SMS won't send

**Example Costs:**

- "Your voucher code is ABC123" (28 chars) = 1 credit
- Full voucher confirmation (100 chars) = 1 credit
- Long notification (200 chars) = 2 credits

### Checking Balance

**In Navbar:**

- SMS credits badge shows current balance
- Click to view details

**On SMS Credits Page:**

- Current balance (large display)
- Total purchased (lifetime)
- Total used (lifetime)
- Last purchase info

### Transaction History

**View Recent Transactions:**

- Purchase records (green)
- Usage records (red)
- Refunds (blue)
- Adjustments (gray)

**Each Transaction Shows:**

- Type (Purchase/Usage/Refund)
- Amount (+/- credits)
- Description
- Date & Time
- Balance before/after

### Usage Statistics

**Available Metrics:**

- Total SMS sent (period)
- Total cost (credits)
- Average cost per day
- Projected monthly cost

**Time Periods:**

- Last 7 days
- Last 30 days
- Last 90 days
- All time

---

## 👨‍💻 For Developers

### Programmatic Usage

#### Check Balance

```typescript
import { SMSCreditsService } from '@/lib/services/sms-credits';

const balance = await SMSCreditsService.getBalance(userId);
console.log(balance.balance); // 245
```

#### Check if Sufficient

```typescript
const check = await SMSCreditsService.hasSufficientCredits(userId, 10);
if (check.sufficient) {
  // Proceed with sending
} else {
  console.log(`Need ${check.required}, have ${check.balance}`);
}
```

#### Send SMS with Credits

```typescript
import { MessagingService } from '@/lib/services/messaging';

const result = await MessagingService.sendSingleSMS(
  '254712345678',
  'Your voucher code is ABC123',
  undefined, // senderId (optional)
  userId     // Required for credit deduction
);

if (result.success) {
  console.log('SMS sent, credits deducted');
} else {
  console.error(result.error); // "Insufficient credits..."
}
```

#### Calculate Cost

```typescript
const message = 'Your long message here...';
const recipients = 10;

const cost = SMSCreditsService.calculateSMSCost(message, recipients);
console.log(`This will cost ${cost} credits`);
```

#### Get Transaction History

```typescript
const history = await SMSCreditsService.getTransactionHistory(userId, {
  limit: 20,
  skip: 0,
  type: 'usage', // Optional filter
  startDate: new Date('2025-11-01'),
  endDate: new Date('2025-11-30')
});

console.log(history.transactions); // Array of transactions
console.log(history.total); // Total count
console.log(history.summary); // { totalPurchased, totalUsed, totalRefunded }
```

#### Get Usage Statistics

```typescript
const stats = await SMSCreditsService.getUsageStatistics(userId, {
  startDate: new Date('2025-11-01'),
  endDate: new Date('2025-11-30')
});

console.log(stats.totalSent); // 150 SMS
console.log(stats.totalCost); // 150 credits
console.log(stats.averageCostPerDay); // 5 credits/day
console.log(stats.projectedMonthlyCost); // 150 credits/month
```

#### Add Credits Manually (Admin)

```typescript
// For refunds, bonuses, adjustments
const result = await SMSCreditsService.addCredits(
  userId,
  100, // amount
  'adjustment', // type: 'purchase' | 'refund' | 'adjustment'
  'Promotional bonus for new user'
);

console.log(result.newBalance); // 345
```

### API Endpoints

#### Get Balance

```bash
GET /api/sms-credits/balance
Authorization: Session cookie

Response:
{
  "success": true,
  "balance": 245,
  "totalPurchased": 500,
  "totalUsed": 255
}
```

#### Purchase Credits

```bash
POST /api/sms-credits/purchase
Authorization: Session cookie
Content-Type: application/json

{
  "packageId": "standard",
  "phoneNumber": "254712345678"
}

Response:
{
  "success": true,
  "message": "STK Push initiated",
  "checkoutRequestId": "ws_CO_...",
  "amount": 225
}
```

### Database Queries

#### Get User Balance

```javascript
db.users.findOne({ _id: ObjectId('userId') }, { projection: { smsCredits: 1 } });
```

#### Get Recent Transactions

```javascript
db.sms_credit_transactions
  .find({
    userId: ObjectId('userId'),
  })
  .sort({ createdAt: -1 })
  .limit(10);
```

#### Get Usage Summary

```javascript
db.sms_credit_transactions.aggregate([
  { $match: { userId: ObjectId('userId') } },
  {
    $group: {
      _id: '$type',
      total: { $sum: { $abs: '$amount' } },
    },
  },
]);
```

---

## 🔧 Configuration

### Pricing Adjustment

Edit `lib/services/sms-credits.ts`:

```typescript
static readonly PACKAGES: PurchasePackage[] = [
  {
    id: 'starter',
    name: 'Starter Pack',
    credits: 50,
    price: 50,  // Change this
    bonus: 0,   // Change this
  },
  // ... more packages
];
```

### MobileSasa Integration

SMS are sent via MobileSasa API:

- Cost per SMS: ~KES 0.80
- Our markup: KES 1.00 per credit
- Profit margin: KES 0.20 per SMS (25%)

Configure in `.env.local`:

```bash
MOBILESASA_API_KEY=your_api_key
MOBILESASA_SENDERID=MOBILESASA
MOBILESASA_URL_SINGLE_MESSAGE=https://api.mobilesasa.com/v1/send/message
```

---

## ⚠️ Important Notes

### Credit Deduction Rules

1. **Credits deducted AFTER successful delivery**
   - If MobileSasa fails, no deduction
   - If network error, no deduction
   - Only deducted when status=200 & messageId received

2. **Multi-part SMS handling**
   - 1-160 chars = 1 credit
   - 161-306 chars = 2 credits (2x153)
   - 307-459 chars = 3 credits (3x153)
   - etc.

3. **Bulk SMS optimization**
   - Total cost calculated upfront
   - Balance checked before batch send
   - Partial deduction if some fail
   - Example: 10 recipients, 2 fail = deduct 8 credits

### Webhook Idempotency

M-Pesa may send duplicate webhooks. The system handles this:

```typescript
if (stkInitiation.status === 'completed') {
  return 'Already processed';
}
```

Credits added only once per purchase.

### Transaction Atomicity

All credit operations are atomic:

1. Check current balance
2. Update user balance
3. Log transaction
4. All in same database session

If any step fails, all rolled back.

---

## 🐛 Troubleshooting

### "Insufficient credits" error

**Solution:** Purchase more credits or check balance

### STK Push not received

**Causes:**

- Phone number incorrect format
- M-Pesa service down
- Network issues

**Check:**

```javascript
db.stk_initiations.findOne({
  PhoneNumber: '254712345678',
  status: 'pending',
});
```

### Credits not added after payment

**Causes:**

- Webhook not received yet (wait 30s)
- Webhook failed (check logs)

**Check:**

```javascript
db.webhook_logs.find({
  'metadata.type': 'sms_credits_purchase',
  'metadata.TransID': 'ABC123',
});
```

### SMS sent but credits not deducted

**Causes:**

- userId not provided to MessagingService
- Deduction failed (check logs)

**Fix:** Always pass userId when sending:

```typescript
await MessagingService.sendSingleSMS(phone, message, senderId, userId);
//                                                               ^^^^^^ Important!
```

---

## 📞 Support

For issues or questions:

1. Check transaction history for detailed error messages
2. Review webhook logs: `db.webhook_logs`
3. Check application logs for credit operations
4. Contact support with TransID for payment issues

---

**Last Updated:** November 6, 2025  
**Version:** 1.0.0
