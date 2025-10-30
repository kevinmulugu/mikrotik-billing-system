# Merchant Payment Flow Guide

## Overview
This guide explains how merchants should handle voucher sales with the new payment reference system.

## 🔐 Two Types of Identifiers

### 1. Payment Reference (Public)
**What it is:** A unique payment identifier (e.g., `VCH1A2B3C4D`)

**Used for:**
- M-Pesa BillRefNumber when customer pays
- Tracking payment in merchant records
- Safe to share BEFORE payment is confirmed

**Example:** `VCH1A2B3C4D`, `VCHK7M2P9A`, `VCHX3Y5Z8W`

**Security:** ✅ Safe to display publicly (cannot be used to access WiFi)

### 2. Voucher Code (Private/Password)
**What it is:** The actual login credentials (e.g., `ABC123XYZ`)

**Used for:**
- WiFi login username
- WiFi login password (same as username for simplicity)

**Security:** 🔒 Must be kept private until payment is confirmed

---

## 📋 Merchant Workflow

### Step 1: Generate Vouchers
1. Go to Router Dashboard → Vouchers → Generate
2. Select package, quantity, and settings
3. Click "Generate Vouchers"
4. **Download CSV** with both payment references and codes

### Step 2: Customer Inquires About Package
Merchant shares:
- Package details (duration, price)
- **Payment Reference** (e.g., `VCH1A2B3C4D`)
- Payment instructions

**What to say:**
```
"This package costs KSh 25 for 3 hours.
To pay via M-Pesa:
1. Go to M-Pesa → Lipa na M-Pesa → Paybill
2. Business Number: [YOUR_PAYBILL]
3. Account Number: VCH1A2B3C4D
4. Amount: 25
5. Enter your PIN"
```

### Step 3: Customer Pays via M-Pesa
- Customer uses payment reference as BillRefNumber
- Safaricom processes payment
- Webhook confirms payment automatically
- Voucher status changes: `active` → `paid`

### Step 4: Confirm Payment & Share Voucher Code
After payment confirmation (check webhook logs or database):

**What to share with customer:**
```
"Payment received! Your WiFi login details:
Username: ABC123XYZ
Password: ABC123XYZ

Connect to our WiFi and use these credentials to login.
Valid for 3 hours."
```

**⚠️ Important:** Only share the actual voucher code AFTER payment is confirmed!

---

## 📊 CSV Export Format

When you download the CSV, it will have these columns:

| Payment Reference | Code | Password | Package | Duration | Price | Expires |
|------------------|------|----------|---------|----------|-------|---------|
| VCH1A2B3C4D | ABC123XYZ | ABC123XYZ | 3 Hours | 3 hours | KSh 25 | 2024-11-30 |
| VCHK7M2P9A | XYZ789DEF | XYZ789DEF | 3 Hours | 3 hours | KSh 25 | 2024-11-30 |

**How to use:**
1. Show **Payment Reference** to customer for payment
2. Keep **Code/Password** private until payment confirmed
3. Track sales using **Payment Reference**

---

## 🛒 Sales Scenarios

### Scenario 1: Walk-in Customer
1. Customer asks for WiFi package
2. Merchant quotes price and shares payment reference
3. Customer pays via M-Pesa using payment reference
4. Merchant confirms payment (checks system or receives webhook notification)
5. Merchant shares voucher code with customer
6. Customer connects and logs in

### Scenario 2: Pre-printed Vouchers/Cards
**Option A: Scratch Cards**
- Print payment reference on front (visible)
- Print voucher code under scratch panel (hidden)
- Customer pays using visible reference
- After payment, customer scratches to reveal code

**Option B: Sealed Envelopes**
- Print payment reference on envelope
- Seal voucher code inside
- Customer pays using reference on envelope
- After payment confirmation, customer opens envelope

### Scenario 3: Online/Remote Sales
1. Customer contacts via WhatsApp/SMS
2. Merchant sends payment reference: "Pay KSh 25 to Paybill [NUMBER], Account: VCH1A2B3C4D"
3. Customer pays
4. System confirms payment automatically
5. Merchant sends voucher code via WhatsApp/SMS
6. Customer uses code to connect

---

## 💡 Merchant Best Practices

### ✅ DO:
- Share payment reference freely for payment
- Keep voucher codes private until payment confirmed
- Download and backup CSV files regularly
- Track sales using payment references
- Verify payment before sharing voucher codes
- Keep payment references and codes organized

### ❌ DON'T:
- Share voucher codes before payment
- Use voucher code as BillRefNumber (it's also the password!)
- Give out codes without verifying payment
- Mix up payment reference and voucher code

---

## 🔍 Checking Payment Status

### Option 1: Dashboard
1. Go to Router Dashboard → Vouchers
2. Filter by "Paid" status
3. Search by payment reference
4. Check payment details

### Option 2: Database Query
```javascript
// MongoDB shell
db.vouchers.findOne({ reference: 'VCH1A2B3C4D' })

// Check status field:
// - 'active' = Generated, not paid
// - 'paid' = Payment confirmed
// - 'used' = Customer connected
// - 'expired' = Expired
```

### Option 3: Webhook Logs
```javascript
// Check recent payments
db.webhook_logs.find({
  type: 'mpesa_confirmation',
  status: 'success'
}).sort({ timestamp: -1 }).limit(10)
```

---

## 📱 Customer Instructions Template

### SMS/WhatsApp Template
```
WiFi Package: [PACKAGE NAME]
Price: KSh [PRICE]

STEP 1 - PAY:
• M-Pesa → Paybill
• Business: [PAYBILL NUMBER]
• Account: [PAYMENT REFERENCE]
• Amount: [PRICE]

STEP 2 - AFTER PAYMENT:
Reply "PAID" and we'll send your WiFi login code.

Questions? Call [SUPPORT NUMBER]
```

### After Payment Confirmation
```
Payment confirmed! ✓

WiFi LOGIN:
Username: [VOUCHER CODE]
Password: [VOUCHER CODE]

Connect to: [WIFI NAME]
Valid for: [DURATION]

Enjoy your internet!
```

---

## 🎯 Example: Full Transaction Flow

**Merchant generates 10 vouchers:**
```
Generated vouchers:
- VCH1A2B3C4D → ABC123XYZ
- VCHK7M2P9A → XYZ789DEF
- VCHX3Y5Z8W → DEF456GHI
...
```

**Customer walks in:**
- Merchant: "3-hour package is KSh 25"
- Customer: "I'll take it"
- Merchant: "Please pay via M-Pesa to Paybill 123456, Account: VCH1A2B3C4D"

**Customer pays:**
- M-Pesa → Lipa na M-Pesa → Paybill
- Business: 123456
- Account: VCH1A2B3C4D
- Amount: 25
- [Customer receives M-Pesa confirmation]

**System processes payment:**
- Webhook receives payment notification
- Finds voucher by reference: VCH1A2B3C4D
- Updates voucher status: active → paid
- Records transaction and commission

**Merchant confirms & shares:**
- Merchant checks system (voucher status = "paid")
- Merchant: "Payment confirmed! Your WiFi login is ABC123XYZ"
- Customer connects and logs in with ABC123XYZ

---

## 🚨 Troubleshooting

### Issue: Customer paid but didn't receive code
**Solution:**
1. Check payment was sent to correct paybill
2. Verify BillRefNumber matches payment reference
3. Check webhook logs for payment confirmation
4. Look up voucher by payment reference in dashboard
5. If status is "paid", share the code manually

### Issue: Customer used wrong account number
**Solution:**
1. Payment won't match any voucher
2. Webhook logs will show "voucher_not_found"
3. Contact customer to verify payment reference
4. May need to refund incorrect payment

### Issue: Merchant gave out code before payment
**Solution:**
1. Customer might use WiFi without paying
2. Mark voucher as "used" in system
3. Generate replacement voucher for paying customer
4. Add to bad debt/loss report

### Issue: Payment reference and code both visible
**Security Risk:**
- Customer could pay and immediately use code
- No control over when they activate
- Consider pre-payment model or access controls

---

## 📞 Support Resources

**For Merchants:**
- Dashboard: https://yourdomain.com/dashboard
- Support: support@yourdomain.com
- WhatsApp: +254700000000

**Technical Documentation:**
- Setup Guide: `QUICKSTART_MPESA.md`
- Purchase Flow: `VOUCHER_PURCHASE_FLOW.md`
- Implementation: `MPESA_PURCHASE_IMPLEMENTATION.md`

---

**Last Updated:** October 30, 2025
**Version:** 1.0
