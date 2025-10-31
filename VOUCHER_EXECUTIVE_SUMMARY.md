# 🎯 Voucher System - Executive Summary

## What This System Does

A complete **hotspot voucher billing system** that enables merchants to:

1. **Generate** internet vouchers for sale
2. **Accept M-Pesa payments** automatically via STK Push
3. **Manage** voucher lifecycle from creation to expiration
4. **Sync** with MikroTik routers for hotspot authentication
5. **Track** commissions and revenue

---

## How It Works (Simple Explanation)

### For Merchants

```
1. Login to dashboard
2. Select package (e.g., "3 Hours - KSh 25")
3. Generate 10 vouchers
4. Download CSV with payment references
5. Share payment references with customers
6. Customers pay via M-Pesa
7. System auto-confirms payment
8. Merchant shares voucher codes to customers
9. Customers use internet
10. System auto-expires vouchers when time is up
```

### For Customers

```
1. Get payment reference from merchant (e.g., "VCHXYZ123")
2. Pay KSh 25 to M-Pesa paybill with reference
3. Receive M-Pesa confirmation
4. Get voucher code from merchant (e.g., "ABCD1234")
5. Connect to WiFi hotspot
6. Login with voucher code
7. Browse internet for 3 hours
8. Get auto-disconnected when time expires
```

---

## Key Features

### ✅ Automated Payment Processing

- M-Pesa STK Push integration
- Automatic payment confirmation via webhook
- Real-time status updates
- Commission tracking

### ✅ MikroTik Integration

- Automatic hotspot user creation
- Session time management
- Bandwidth limiting
- Automatic user cleanup

### ✅ Multiple Expiry Strategies

- **Activation Expiry**: Unused vouchers expire after X days
- **Purchase Expiry**: Voucher expires after package duration from purchase
- **Usage Expiry**: Active session expires after time limit

### ✅ Security

- Separate payment reference (public) and voucher code (private)
- Webhook signature verification (production)
- Audit logging
- Rate limiting

### ✅ Flexibility

- Bulk voucher generation (up to 1000 at once)
- Multiple packages support
- Customizable commission rates
- ISP zero-commission mode

---

## Architecture Overview

```
┌──────────────┐
│   Merchant   │
│   Dashboard  │
└──────┬───────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐
│   MongoDB    │◄───►│   Next.js    │
│   Database   │     │   Backend    │
└──────────────┘     └──────┬───────┘
                            │
                            ▼
                     ┌──────────────┐
                     │  MikroTik    │
                     │   Router     │
                     └──────┬───────┘
                            │
                            ▼
                     ┌──────────────┐
                     │  Customer    │
                     │  Hotspot     │
                     └──────────────┘
```

---

## Database Collections

### vouchers

Stores all voucher information:

- Voucher codes and passwords
- Payment details
- Usage statistics
- Expiry configurations
- MikroTik sync status

### transactions

Records all sales:

- Payment amounts
- Commission calculations
- M-Pesa transaction IDs
- Timestamps

### webhook_logs

Tracks M-Pesa webhooks:

- Success/failure status
- Processing time
- Error details

### audit_logs

Security and compliance:

- User actions
- System changes
- IP addresses
- Timestamps

---

## API Endpoints

### Merchant APIs (Authenticated)

```
POST   /api/routers/[id]/vouchers/generate    # Generate vouchers
GET    /api/routers/[id]/vouchers             # List vouchers
POST   /api/routers/[id]/vouchers/bulk-sync   # Sync to router
GET    /api/routers/[id]/vouchers/export      # Export CSV
```

### Customer APIs (Public)

```
GET    /api/captive/packages?routerId=xxx     # Browse packages
POST   /api/captive/purchase                  # Initiate M-Pesa payment
GET    /api/captive/payment-status?id=xxx     # Check payment
```

### Webhooks (Safaricom)

```
POST   /api/webhooks/mpesa                    # Payment confirmation
```

---

## Critical Files

### Frontend

```
src/app/routers/[id]/vouchers/
├── generate/page.tsx               # Generation page
└── page.tsx                        # Voucher list

components/vouchers/
├── voucher-generator.tsx           # Generation form
├── voucher-list.tsx               # Display table
└── voucher-stats.tsx              # Statistics
```

### Backend

```
src/app/api/
├── routers/[id]/vouchers/
│   ├── generate/route.ts          # Create vouchers
│   └── route.ts                   # Fetch vouchers
├── webhooks/mpesa/route.ts        # M-Pesa webhook
└── captive/
    ├── packages/route.ts          # Customer packages
    └── purchase/route.ts          # Payment initiation
```

### Services

```
lib/services/
└── mikrotik.ts                    # Router integration

scripts/
└── expire-vouchers.ts             # Cron job
```

---

## Data Flow Summary

### 1. Voucher Generation

```
Merchant → API → Database → MikroTik
         (Generate)  (Store)  (Create user)
```

### 2. Payment Processing

```
Customer → M-Pesa → Webhook → Database
         (Pay)    (Confirm) (Update status)
```

### 3. Activation

```
Customer → Hotspot → MikroTik → Session
         (Login)   (Authenticate) (Connect)
```

### 4. Expiry

```
Cron Job → Database → MikroTik
         (Find expired) (Remove user)
```

---

## Voucher Lifecycle States

```
ACTIVE → PAID → USED → EXPIRED
  ↓       ↓       ↓
(Generated)(Paid)(Active)(Cleaned up)
```

### State Transitions

- `active` → `paid`: M-Pesa payment confirmed
- `paid` → `used`: Customer logs in to hotspot
- `used` → `expired`: Time limit reached or timer expired
- `active` → `expired`: Activation expiry reached (unpurchased)

---

## Commission Model

### Customer Types & Rates

```
Homeowner:  20% commission
Personal:   20% commission
ISP:        0% commission (wholesale)
Enterprise: 0% commission
```

### Calculation

```
Voucher Price: KSh 25
Commission (20%): KSh 5
Merchant Revenue: KSh 20
```

---

## Expiry Strategies Explained

### Scenario 1: Auto Expire Only

```
Day 0:  Generate 10 vouchers (expires in 30 days)
Day 5:  Customer buys and uses voucher
Day 29: Unused vouchers expire automatically
```

### Scenario 2: Time-after-Purchase

```
Time 7:00am: Customer buys 3-hour voucher
Time 7:30am: Customer activates voucher
Time 10:00am: Voucher expires (3 hours from purchase)
```

### Scenario 3: Both Enabled

```
Day 0:  Generate vouchers (expires Day 30)
Day 5:  Customer buys 3-hour voucher
        - Activation expiry no longer applies
        - Purchase timer starts (expires in 3 hours)
Time: 3 hours pass → voucher expires
```

---

## Security Highlights

### 🔐 Payment Reference Separation

```
Payment Reference: VCHXYZ123 (PUBLIC - used in M-Pesa)
Voucher Code:      ABCD1234 (PRIVATE - password)
```

**Why?**

- Payment reference visible in M-Pesa transactions
- Prevents voucher theft from transaction logs
- Voucher code shared only after payment confirmation

### 🔒 Other Security Measures

- Session-based authentication
- Webhook signature verification (production)
- Rate limiting on APIs
- Audit logging
- HTTPS for all APIs
- Input validation and sanitization

---

## Performance Considerations

### Optimizations

- Database indexes on key fields
- Batch voucher creation
- Async MikroTik sync
- Webhook retry logic
- Query result pagination

### Limits

- Max 1000 vouchers per generation
- Payment reference max 12 characters (M-Pesa limit)
- Webhook timeout: 30 seconds
- API rate limiting

---

## Monitoring & Maintenance

### Daily Checks

✅ Webhook success rate  
✅ MikroTik sync status  
✅ Active sessions count  
✅ Failed transactions  
✅ Cron job execution

### Weekly Tasks

✅ Review expired vouchers  
✅ Analyze sales trends  
✅ Check commission calculations  
✅ Backup database  
✅ Update packages if needed

### Monthly Reviews

✅ Security audit  
✅ Performance optimization  
✅ Archive old data  
✅ Update documentation  
✅ Review customer feedback

---

## Common Issues & Quick Fixes

### "Customer can't login"

1. Check voucher status: `db.vouchers.findOne({code: 'ABCD1234'})`
2. Verify MikroTik user exists
3. Check if uptime exhausted
4. Sync voucher if needed

### "Payment not reflecting"

1. Check webhook logs: `db.webhook_logs.find({BillRefNumber: 'VCHXYZ123'})`
2. Verify amount matches
3. Manually update if confirmed
4. Check Safaricom dashboard

### "Vouchers not expiring"

1. Check cron job: `crontab -l`
2. Verify script runs: `tail -f expire-vouchers.log`
3. Check database indexes
4. Run script manually to test

---

## Production Deployment Checklist

### Before Launch

- [ ] Enable M-Pesa production credentials
- [ ] Enable webhook signature verification
- [ ] Configure SSL certificates
- [ ] Set up cron jobs
- [ ] Configure backup schedule
- [ ] Set up monitoring alerts
- [ ] Test complete flow end-to-end
- [ ] Document support procedures
- [ ] Train support staff

### Post-Launch

- [ ] Monitor error rates
- [ ] Watch webhook success rate
- [ ] Track payment confirmations
- [ ] Review customer feedback
- [ ] Optimize based on usage patterns

---

## Support Resources

### Documentation

📖 [Complete Master Guide](./VOUCHER_SYSTEM_MASTER_GUIDE.md)  
🎨 [Flow Diagrams](./VOUCHER_FLOW_DIAGRAMS.md)  
🔧 [Troubleshooting](./VOUCHER_TROUBLESHOOTING.md)  
📚 [Documentation Index](./VOUCHER_DOCS_INDEX.md)

### External Resources

🌐 [MikroTik REST API](https://help.mikrotik.com/docs/display/ROS/REST+API)  
💰 [M-Pesa Daraja API](https://developer.safaricom.co.ke/Documentation)  
⚡ [Next.js Documentation](https://nextjs.org/docs)

---

## Tech Stack Summary

### Frontend

- **Framework**: Next.js 15 (App Router)
- **UI**: React + TailwindCSS
- **State**: React Hooks
- **Auth**: NextAuth.js

### Backend

- **Runtime**: Node.js
- **API**: Next.js API Routes
- **Database**: MongoDB
- **Payments**: M-Pesa Daraja API

### Integration

- **Router**: MikroTik RouterOS (REST API)
- **Hotspot**: MikroTik Hotspot System
- **Automation**: Node.js cron scripts

---

## Key Metrics

### Generated Vouchers

```mongodb
db.vouchers.countDocuments({
  createdAt: { $gte: new Date('2025-10-01') }
})
```

### Sales Revenue

```mongodb
db.transactions.aggregate([
  { $match: { type: 'voucher_sale', status: 'completed' }},
  { $group: { _id: null, total: { $sum: '$amount' }}}
])
```

### Active Sessions

```mongodb
db.vouchers.countDocuments({
  status: 'used',
  'usage.endTime': null
})
```

### Conversion Rate

```javascript
const generated = await db.vouchers.countDocuments({});
const sold = await db.vouchers.countDocuments({ status: { $in: ['paid', 'used', 'expired'] } });
const rate = ((sold / generated) * 100).toFixed(2);
```

---

## Success Criteria

### System Health ✅

- Webhook success rate > 95%
- MikroTik sync success > 90%
- API response time < 2s
- Zero data loss
- 99.9% uptime

### Business Metrics 📈

- Customer satisfaction > 4.5/5
- Payment success rate > 95%
- Support ticket resolution < 24h
- Revenue growth month-over-month
- Commission accuracy 100%

---

## Conclusion

This voucher system provides a **complete, automated solution** for:

- 🎫 Voucher generation and management
- 💰 M-Pesa payment processing
- 🔐 Secure authentication
- 📊 Revenue tracking
- 🤖 Automated expiry and cleanup

**Zero manual intervention** required for normal operations.  
**Fully integrated** with MikroTik and M-Pesa.  
**Production-ready** with comprehensive error handling.

---

**Questions?** Check the [Documentation Index](./VOUCHER_DOCS_INDEX.md)

**Issues?** See [Troubleshooting Guide](./VOUCHER_TROUBLESHOOTING.md)

**Deep Dive?** Read [Master Guide](./VOUCHER_SYSTEM_MASTER_GUIDE.md)

---

**Last Updated**: October 31, 2025  
**Version**: 1.0.0  
**Status**: Production Ready ✅
