# 📚 Voucher System Documentation Index

Welcome to the complete documentation for the MikroTik Hotspot Voucher Management System.

---

## 📖 Documentation Files

### 1. [VOUCHER_SYSTEM_MASTER_GUIDE.md](./VOUCHER_SYSTEM_MASTER_GUIDE.md)

**Complete System Documentation**

The ultimate reference guide covering every aspect of the voucher system:

- System architecture and data flow
- Complete voucher lifecycle explanation
- Detailed component breakdown
- Database schema and indexes
- MikroTik integration guide
- M-Pesa payment webhook details
- Expiry management strategies
- Security best practices
- Complete API reference

**Best for**: Understanding how everything works together, onboarding new developers, architecture
decisions

---

### 2. [VOUCHER_FLOW_DIAGRAMS.md](./VOUCHER_FLOW_DIAGRAMS.md)

**Visual Flow Reference**

ASCII diagrams and flowcharts showing:

- Complete voucher lifecycle (visual timeline)
- Data flow during voucher generation
- M-Pesa payment processing flow
- Expiry timeline visualization
- Security flow (payment reference vs voucher code)
- MikroTik integration points
- Error handling scenarios

**Best for**: Quick visual reference, understanding workflows, debugging flow issues

---

### 3. [VOUCHER_TROUBLESHOOTING.md](./VOUCHER_TROUBLESHOOTING.md)

**Diagnostic & Problem Solving Guide**

Practical troubleshooting information:

- Common issues with step-by-step solutions
- Diagnostic commands (MongoDB, MikroTik)
- Emergency procedures
- Monitoring queries
- Performance optimization
- Support scripts
- Health check procedures

**Best for**: Fixing production issues, customer support, system maintenance

---

## 🚀 Quick Start

### For Developers

1. Read: [System Overview](#system-overview) in Master Guide
2. Study: [Complete Voucher Lifecycle](#complete-voucher-lifecycle) in Flow Diagrams
3. Explore: Code files in order:
   - `src/app/routers/[id]/vouchers/generate/page.tsx`
   - `components/vouchers/voucher-generator.tsx`
   - `src/app/api/routers/[id]/vouchers/generate/route.ts`
   - `lib/services/mikrotik.ts`
   - `src/app/api/webhooks/mpesa/route.ts`

### For Support Staff

1. Read: [Common Issues](#common-issues--solutions) in Troubleshooting
2. Bookmark: [Diagnostic Commands](#quick-diagnostic-commands)
3. Practice: Running queries and checking logs

### For System Administrators

1. Read: [Security Considerations](#security-considerations) in Master Guide
2. Setup: [Monitoring & Alerts](#monitoring--alerts) in Troubleshooting
3. Configure: [Cron Jobs](#expiry-cron-job) for automated cleanup

---

## 🎯 Key Concepts

### Voucher States

| State     | Description                  | Can Purchase? | Can Activate? |
| --------- | ---------------------------- | ------------- | ------------- |
| `active`  | Generated, awaiting purchase | ✅            | ❌            |
| `paid`    | Payment confirmed            | ❌            | ✅            |
| `used`    | Active session on hotspot    | ❌            | ✅            |
| `expired` | Session or timer ended       | ❌            | ❌            |

### Expiry Strategies

#### 1. Activation Expiry

- **Controls**: When unused voucher becomes invalid
- **Configured**: During generation (`autoExpire`, `expiryDays`)
- **Applied to**: Unpurchased vouchers
- **Example**: Voucher generated on Jan 1st expires on Jan 31st if not purchased

#### 2. Purchase Expiry

- **Controls**: When purchased voucher expires from purchase time
- **Configured**: During generation (`usageTimedOnPurchase`)
- **Applied to**: Purchased vouchers
- **Example**: 3-hour package purchased at 7am expires at 10am (regardless of activation)

#### 3. Usage Expiry

- **Controls**: When active session ends
- **Configured**: By package duration (`limit-uptime` on MikroTik)
- **Applied to**: Active sessions
- **Example**: User logs in at 8am, disconnected at 11am (3 hours)

### Security Model

**Payment Reference vs Voucher Code**

```
┌──────────────────────────┐
│  Payment Reference       │  PUBLIC (for payments)
│  VCHXYZ123              │  ← Used in M-Pesa BillRefNumber
└──────────────────────────┘  ← Safe to display in transactions

┌──────────────────────────┐
│  Voucher Code           │  PRIVATE (password)
│  ABCD1234               │  ← Used for hotspot login
└──────────────────────────┘  ← Share only after payment
```

---

## 📁 Key Files Reference

### Frontend Components

```
components/vouchers/
├── voucher-generator.tsx    # Main generation form
├── voucher-list.tsx        # Display vouchers table
└── voucher-stats.tsx       # Statistics dashboard
```

### Backend APIs

```
src/app/api/
├── routers/[id]/vouchers/
│   ├── generate/route.ts   # Create vouchers
│   └── route.ts            # List/fetch vouchers
├── webhooks/mpesa/
│   └── route.ts            # Payment confirmations
└── captive/
    ├── packages/route.ts   # Customer-facing package list
    └── purchase/route.ts   # Initiate M-Pesa payment
```

### Services & Scripts

```
lib/services/
└── mikrotik.ts             # Router API integration

scripts/
├── expire-vouchers.ts      # Cron job for cleanup
└── init-database.ts        # Database setup
```

---

## 🔍 Common Tasks

### Generate Vouchers

```typescript
// Navigate to: /routers/[id]/vouchers/generate
// 1. Select package
// 2. Set quantity (1-1000)
// 3. Configure expiry options
// 4. Click "Generate"
// 5. Download CSV
```

### Check Payment Status

```mongodb
db.vouchers.findOne({
  reference: 'VCHXYZ123'
}, {
  status: 1,
  'payment.transactionId': 1,
  'payment.amount': 1
})
```

### Manually Update Voucher Status

```mongodb
// Mark as paid (after verifying with Safaricom)
db.vouchers.updateOne(
  { reference: 'VCHXYZ123' },
  { $set: {
    status: 'paid',
    'payment.method': 'mpesa',
    'payment.transactionId': 'ABC123XYZ',
    'payment.amount': 25,
    'payment.paymentDate': new Date()
  }}
)
```

### Sync Voucher to Router

```bash
# Via API
POST /api/routers/[id]/vouchers/bulk-sync
```

### Check Active Sessions

```bash
# MikroTik CLI
/ip hotspot active print

# REST API
curl -u admin:password http://192.168.88.1/rest/ip/hotspot/active
```

---

## 🔗 External Resources

### MikroTik Documentation

- [REST API Reference](https://help.mikrotik.com/docs/display/ROS/REST+API)
- [Hotspot User Management](https://help.mikrotik.com/docs/display/ROS/Hotspot)
- [User Manager](https://help.mikrotik.com/docs/display/ROS/User+Manager)

### Safaricom M-Pesa

- [Daraja API Documentation](https://developer.safaricom.co.ke/Documentation)
- [STK Push Guide](https://developer.safaricom.co.ke/docs#lipa-na-m-pesa-online)
- [C2B API (Webhooks)](https://developer.safaricom.co.ke/docs#c2b-api)

### Next.js & MongoDB

- [Next.js App Router](https://nextjs.org/docs/app)
- [MongoDB Node.js Driver](https://www.mongodb.com/docs/drivers/node/)
- [NextAuth.js](https://next-auth.js.org/)

---

## 🆘 Getting Help

### Documentation Not Clear?

1. Check [Flow Diagrams](./VOUCHER_FLOW_DIAGRAMS.md) for visual reference
2. Review [Troubleshooting](./VOUCHER_TROUBLESHOOTING.md) for common issues
3. Search codebase for examples

### Production Issue?

1. Check [Troubleshooting Guide](./VOUCHER_TROUBLESHOOTING.md)
2. Run diagnostic queries
3. Check logs:
   - MongoDB: `db.webhook_logs.find().sort({timestamp: -1}).limit(10)`
   - MikroTik: `/log print where topics~"hotspot"`
   - Application: Check your logging system

### Feature Request or Bug?

1. Document the issue with:
   - Steps to reproduce
   - Expected vs actual behavior
   - Relevant logs/screenshots
2. Check if similar issue exists
3. Create detailed report with context

---

## 📊 System Status Checklist

Daily health check:

- [ ] Check webhook success rate
- [ ] Verify MikroTik sync status
- [ ] Monitor active sessions
- [ ] Review failed transactions
- [ ] Check cron job logs
- [ ] Verify router connectivity

Weekly maintenance:

- [ ] Review expired vouchers cleanup
- [ ] Check database indexes
- [ ] Analyze sales trends
- [ ] Update package pricing if needed
- [ ] Backup database
- [ ] Review audit logs

Monthly tasks:

- [ ] Analyze commission calculations
- [ ] Review customer types and rates
- [ ] Clean up old webhook logs
- [ ] Archive expired voucher data
- [ ] Update documentation
- [ ] Security audit

---

## 🎓 Learning Path

### Level 1: Understanding the Basics

1. Read: System Overview (Master Guide)
2. Study: Voucher Lifecycle (Flow Diagrams)
3. Practice: Generate test vouchers
4. Understand: Database schema

### Level 2: Payment Integration

1. Read: M-Pesa Integration (Master Guide)
2. Study: Payment Flow (Flow Diagrams)
3. Test: STK Push initiation
4. Debug: Webhook handling

### Level 3: MikroTik Integration

1. Read: MikroTik Service (Master Guide)
2. Study: Integration Points (Flow Diagrams)
3. Practice: REST API calls
4. Understand: Hotspot user management

### Level 4: Advanced Operations

1. Master: Expiry strategies
2. Implement: Monitoring and alerts
3. Optimize: Performance tuning
4. Handle: Emergency procedures

---

## 📝 Change Log

### Version 1.0.0 (October 31, 2025)

- Initial documentation release
- Complete system coverage
- Visual flow diagrams
- Troubleshooting guide

---

## 👨‍💻 Contributing

When updating this documentation:

1. Keep examples practical and tested
2. Update all three files if concepts change
3. Maintain consistent terminology
4. Add new troubleshooting scenarios as discovered
5. Update flowcharts when flows change

---

## 📞 Support Contacts

**Technical Support**: [Your contact info] **Emergency Issues**: [Emergency contact] **Documentation
Feedback**: [Feedback channel]

---

**Last Updated**: October 31, 2025  
**Documentation Version**: 1.0.0  
**System Version**: Compatible with Next.js 15, MongoDB 5.0+, RouterOS 7.0+

---

## Quick Links

- [Master Guide](./VOUCHER_SYSTEM_MASTER_GUIDE.md) - Complete reference
- [Flow Diagrams](./VOUCHER_FLOW_DIAGRAMS.md) - Visual workflows
- [Troubleshooting](./VOUCHER_TROUBLESHOOTING.md) - Problem solving
- [Project README](./README.md) - Project overview
