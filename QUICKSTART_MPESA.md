# Quick Start: M-Pesa Voucher Purchase Setup

## 🚀 Setup Steps

### 1. Configure M-Pesa Credentials
Add to your `.env` file:
```bash
# M-Pesa Configuration
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_SHORTCODE=your_paybill_number
MPESA_PASSKEY=your_passkey

# Webhook URL (publicly accessible)
MPESA_CONFIRMATION_URL=https://yourdomain.com/api/webhooks/mpesa
```

### 2. Register Webhook with Safaricom
Register your confirmation URL with M-Pesa:
```bash
curl -X POST https://sandbox.safaricom.co.ke/mpesa/c2b/v1/registerurl \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ShortCode": "YOUR_SHORTCODE",
    "ResponseType": "Completed",
    "ConfirmationURL": "https://yourdomain.com/api/webhooks/mpesa",
    "ValidationURL": "https://yourdomain.com/api/webhooks/mpesa/validate"
  }'
```

### 3. Initialize System Configuration
Ensure `system_config` collection has commission rates:
```javascript
// Run once in MongoDB shell
db.system_config.insertOne({
  category: 'general',
  key: 'commission_rates',
  value: {
    homeowner: 20.0,
    personal: 20.0,
    isp: 0.0,
    enterprise: 0.0
  },
  encrypted: false,
  description: 'Commission rates by customer type',
  metadata: {
    lastModified: new Date(),
    version: 1,
    environment: 'production'
  }
})
```

Or run the initialization script:
```bash
pnpm tsx scripts/init-database.ts
```

### 4. Setup Cron Job for Expiry
Schedule the expiry enforcement script:

**Using cron:**
```bash
# Edit crontab
crontab -e

# Add line to run every 15 minutes
*/15 * * * * cd /path/to/project && pnpm expire:vouchers >> /var/log/expire-vouchers.log 2>&1
```

**Using systemd timer:**
```bash
# Copy service and timer files
sudo cp scripts/systemd/expire-vouchers.service /etc/systemd/system/
sudo cp scripts/systemd/expire-vouchers.timer /etc/systemd/system/

# Enable and start timer
sudo systemctl daemon-reload
sudo systemctl enable expire-vouchers.timer
sudo systemctl start expire-vouchers.timer

# Check status
sudo systemctl status expire-vouchers.timer
```

See `VOUCHER_EXPIRY_CRON.md` for more scheduling options.

### 5. Test the Flow

#### Step 1: Generate a Voucher
```bash
# Via UI or API
POST /api/routers/{routerId}/vouchers/generate
{
  "packageName": "3hours",
  "quantity": 1,
  "autoExpire": true,
  "expiryDays": 30,
  "usageTimedOnPurchase": true,
  "purchaseExpiryDays": 7,
  "autoTerminateOnPurchase": true,
  "syncToRouter": true
}
```

**Response:** Note the voucher code (e.g., `ABC123XYZ`)

#### Step 2: Simulate M-Pesa Payment
```bash
curl -X POST http://localhost:3000/api/webhooks/mpesa \
  -H "Content-Type: application/json" \
  -d '{
    "TransactionType": "Pay Bill",
    "TransID": "TEST123456",
    "TransAmount": "25.00",
    "MSISDN": "254712345678",
    "BillRefNumber": "ABC123XYZ",
    "TransTime": "20231031120000",
    "BusinessShortCode": "123456",
    "OrgAccountBalance": "10000.00"
  }'
```

**Expected Response:**
```json
{
  "ResultCode": 0,
  "ResultDesc": "Payment processed successfully"
}
```

#### Step 3: Verify Database Updates
```javascript
// MongoDB shell
use mikrotik_billing

// Check voucher status
db.vouchers.findOne({ 'voucherInfo.code': 'ABC123XYZ' })
// Should show:
// - status: 'paid'
// - payment.transactionId: 'TEST123456'
// - payment.commission: 5.00
// - usage.purchaseExpiresAt: (7 days from now)

// Check transaction
db.transactions.find({ voucherCode: 'ABC123XYZ' })
// Should show new transaction record

// Check webhook log
db.webhook_logs.find({ voucherCode: 'ABC123XYZ' })
// Should show successful webhook processing
```

#### Step 4: Test Expiry Enforcement
```bash
# Run expiry job manually
pnpm expire:vouchers

# Check output for any expired vouchers
```

## 📱 Customer Purchase Flow

### For Customers:
1. **Get Voucher Code**
   - From merchant/shop
   - Or displayed on captive portal

2. **Pay via M-Pesa**
   - Go to M-Pesa menu
   - Select "Lipa na M-Pesa"
   - Select "Paybill"
   - Enter business number: `YOUR_SHORTCODE`
   - Enter account number: `VOUCHER_CODE`
   - Enter amount: `KES 25` (or package price)
   - Enter PIN and confirm

3. **Receive Confirmation**
   - M-Pesa SMS confirmation
   - (Optional) System SMS with voucher details

4. **Connect to WiFi**
   - Connect to hotspot
   - Login with voucher code
   - Start browsing

### What Happens Behind the Scenes:
```
Customer Payment (M-Pesa)
    ↓
Safaricom processes
    ↓
Webhook → /api/webhooks/mpesa
    ↓
System validates & updates DB
    ↓
Status: active → paid
    ↓
Customer can now use voucher
    ↓
Expiry timer starts (if enabled)
    ↓
Cron enforces expiry
```

## 🧪 Testing Checklist

### Basic Flow
- [ ] Generate voucher via UI
- [ ] Voucher appears in database with `status: 'active'`
- [ ] Simulate M-Pesa payment
- [ ] Webhook returns `ResultCode: 0`
- [ ] Voucher status changes to `'paid'`
- [ ] Transaction record created
- [ ] Commission calculated correctly
- [ ] Audit log entry created
- [ ] Webhook log entry created

### Expiry Testing
- [ ] Generate voucher with `usageTimedOnPurchase: true`
- [ ] Purchase voucher
- [ ] Verify `usage.purchaseExpiresAt` is set
- [ ] Wait for expiry (or manually update timestamp)
- [ ] Run expiry job
- [ ] Verify voucher status changes to `'expired'`
- [ ] Verify MikroTik user removed (if `autoTerminateOnPurchase: true`)

### Error Handling
- [ ] Test with invalid voucher code → Returns `ResultCode: 1`
- [ ] Test with wrong amount → Returns `ResultCode: 1`
- [ ] Test duplicate payment → Returns `ResultCode: 0` (idempotent)
- [ ] Test with missing fields → Returns `ResultCode: 1`

## 🔍 Troubleshooting

### Webhook Not Being Called
**Check:**
1. Is your server publicly accessible?
2. Is the URL registered with M-Pesa?
3. Check Safaricom logs/dashboard
4. Verify webhook endpoint is not blocked by firewall

**Test:**
```bash
# Test webhook endpoint is accessible
curl -X POST https://yourdomain.com/api/webhooks/mpesa \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Should return 400 or validation error (not 404)
```

### Voucher Not Updating
**Check:**
1. Database connection working?
2. Voucher exists with exact code?
3. Voucher status is `'active'` or `'pending'`?
4. Check server logs for errors
5. Check `webhook_logs` collection for error details

**Debug:**
```javascript
// Check webhook logs
db.webhook_logs.find({ 
  type: 'mpesa_confirmation',
  status: { $in: ['failed', 'error'] }
}).sort({ timestamp: -1 }).limit(10)
```

### Commission Not Calculating
**Check:**
1. `system_config` collection has `commission_rates` document
2. Customer type matches one of the keys in `commission_rates`
3. Commission rate is a number (not string)

**Verify:**
```javascript
// Check system config
db.system_config.findOne({ key: 'commission_rates' })

// Check customer type
db.customers.findOne({ _id: ObjectId('...') })
```

### Expiry Not Working
**Check:**
1. Cron job is running (check cron logs)
2. Script has execute permissions
3. Script can connect to database
4. Timestamps are in correct format (Date objects)

**Test:**
```bash
# Run script manually with debug
NODE_ENV=development pnpm expire:vouchers

# Check script logs
tail -f logs/expire-vouchers.log
```

## 📊 Monitoring

### Key Logs to Monitor
```bash
# Application logs
tail -f logs/app.log | grep "M-Pesa Webhook"

# Expiry cron logs
tail -f logs/expire-vouchers.log

# Nginx/server logs (for webhook calls)
tail -f /var/log/nginx/access.log | grep "/api/webhooks/mpesa"
```

### Database Queries
```javascript
// Webhook success rate (last 24h)
db.webhook_logs.aggregate([
  { $match: {
    type: 'mpesa_confirmation',
    timestamp: { $gte: new Date(Date.now() - 24*60*60*1000) }
  }},
  { $group: {
    _id: '$status',
    count: { $sum: 1 }
  }}
])

// Recent failed webhooks
db.webhook_logs.find({
  type: 'mpesa_confirmation',
  status: { $in: ['failed', 'error'] }
}).sort({ timestamp: -1 }).limit(10)

// Vouchers awaiting expiry
db.vouchers.find({
  status: 'paid',
  'usage.purchaseExpiresAt': {
    $lt: new Date(Date.now() + 24*60*60*1000)
  }
}).count()
```

## 🎓 Next Steps

### Recommended Implementations
1. **Activation Handler**
   - Track when customer actually uses voucher
   - Set `usage.startTime` and `usage.expectedEndTime`
   - See `VOUCHER_PURCHASE_FLOW.md` for details

2. **SMS Notifications**
   - Send voucher code after purchase
   - Send expiry warnings
   - Send usage reminders

3. **Webhook Signature Verification**
   - Enable in production for security
   - Verify requests are from Safaricom

4. **Admin Dashboard**
   - View webhook logs
   - Monitor success rates
   - Trigger manual expiry runs

5. **RADIUS Integration**
   - Track exact connection times
   - Auto-update usage statistics

### Documentation References
- **Full Flow:** `VOUCHER_PURCHASE_FLOW.md`
- **Implementation Details:** `MPESA_PURCHASE_IMPLEMENTATION.md`
- **Cron Setup:** `VOUCHER_EXPIRY_CRON.md`
- **UI Configuration:** `components/vouchers/voucher-generator.tsx`

## 🆘 Support

### Common Issues
See `TROUBLESHOOTING.md` (to be created)

### Contact
- GitHub Issues: [repo]/issues
- Email: support@yourdomain.com
- Docs: https://docs.yourdomain.com

---

**Status:** ✅ Purchase flow implemented and tested
**Last Updated:** October 30, 2025
