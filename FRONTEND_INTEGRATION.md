# Frontend Integration - Billing Settings

## Overview

Completed the integration of billing-settings.tsx component with the real API routes created for
paybill management, commission payouts, payout settings, and invoicing.

## Changes Made

### 1. State Management Updates

**Added real data state variables:**

```typescript
const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
const [invoices, setInvoices] = useState<Invoice[]>([]);
const [commissionPayouts, setCommissionPayouts] = useState<CommissionPayout[]>([]);
const [availableBalance, setAvailableBalance] = useState(0);
const [payoutSchedule, setPayoutSchedule] = useState("monthly");
const [mpesaNumber, setMpesaNumber] = useState("");
const [revenueStats, setRevenueStats] = useState({...});
```

**Removed:**

- Mock data arrays (paymentMethods, invoices, commissionPayouts)
- Hard-coded revenueStats object

### 2. Data Fetching

**Added new useEffect hook to fetch all billing data:**

```typescript
React.useEffect(() => {
  // Fetch paybills from /api/settings/paybills
  // Fetch payout settings from /api/settings/payouts
  // Fetch invoices from /api/invoices
  // Fetch commission payouts from /api/payouts
  // Fetch available balance from /api/payouts/balance
}, []);
```

**API endpoints called:**

- `GET /api/settings/paybills` - Fetch user's paybills
- `GET /api/settings/payouts` - Fetch payout settings and commission rate
- `GET /api/invoices` - Fetch subscription invoices
- `GET /api/payouts` - Fetch commission payout history
- `GET /api/payouts/balance` - Fetch available balance for withdrawal

### 3. Action Handlers Updated

#### Paybill Management

**handleAddPaybill:**

```typescript
- Old: setTimeout stub
+ New: POST /api/settings/paybills with real data
+ Refreshes paybills list after success
```

**handleSetDefault:**

```typescript
- Old: setTimeout stub
+ New: PATCH /api/settings/paybills with action: 'set_default'
+ Refreshes paybills list after success
```

**handleRemovePaybill:**

```typescript
- Old: setTimeout stub
+ New: DELETE /api/settings/paybills?id={paybillId}
+ Refreshes paybills list after success
```

#### Payout Management

**handleRequestPayout:**

```typescript
- Old: setTimeout stub
+ New: POST /api/payouts with amount and method
+ Refreshes payouts and balance after success
```

**handleSaveSettings:**

```typescript
- Old: setTimeout stub
+ New: PATCH /api/settings/payouts with all settings
+ Saves minAmount, autoPayouts, schedule, mpesaNumber
```

#### Invoice Management

**handleDownloadInvoice:**

```typescript
- Old: setTimeout stub
+ New: Shows "coming soon" toast (PDF generation to be implemented)
```

## Commission Model Clarification

The commission system is correctly implemented in the backend and now properly integrated:

### Individual/Homeowner Plans

- **System commission:** 20%
- **User retention:** 80%
- **Monthly fee:** KES 0 (no subscription)
- **How it works:** On each voucher sale, system automatically keeps 20%, user receives 80%

### ISP Plans (ISP & ISP Pro)

- **System commission:** 0% (users keep 100% of sales)
- **User retention:** 100%
- **Monthly fee:**
  - ISP (≤5 routers): KES 2,500/month
  - ISP Pro (unlimited): KES 3,900/month
- **How it works:** Users pay monthly subscription fee, keep all voucher sales

## Data Flow

```
Component Mount
    ↓
Fetch Billing Settings (/api/settings/billing)
    ↓
Fetch All Billing Data (parallel):
    - Paybills
    - Payout Settings
    - Invoices
    - Commission Payouts
    - Available Balance
    ↓
Display in UI with real data
    ↓
User Actions (Add/Edit/Delete)
    ↓
API Call with real endpoints
    ↓
Refresh affected data
    ↓
Update UI
```

## Testing Checklist

- [ ] Paybills load correctly on page load
- [ ] Can add new customer paybill
- [ ] Can set paybill as default
- [ ] Can remove paybill
- [ ] Payout settings load and display correctly
- [ ] Can update payout settings (min amount, schedule, M-Pesa number)
- [ ] Can toggle auto-payouts on/off
- [ ] Invoices display with correct status badges
- [ ] Commission payouts display with transaction IDs
- [ ] Can request manual payout
- [ ] Available balance displays correctly
- [ ] Loading states work properly
- [ ] Error handling shows appropriate toasts

## Next Steps

1. **Add Revenue Stats Calculation** - Calculate revenueStats from commission data
2. **Implement PDF Invoice Generation** - Replace "coming soon" toast in handleDownloadInvoice
3. **Add Form Validation** - Validate paybill credentials before submission
4. **Add Confirmation Dialogs** - Confirm before removing paybill or requesting payout
5. **Add Loading Skeletons** - Show skeleton UI while data is loading
6. **Add Empty States** - Show helpful messages when no data exists
7. **Add Pagination** - Paginate long lists of invoices/payouts
8. **Add Filters** - Filter invoices by status, payouts by date range

## File Modified

- `components/settings/billing-settings.tsx` - Replaced all mock data and stubs with real API
  integration

## Related Files

- `src/app/api/settings/paybills/route.ts` - Paybill management API
- `src/app/api/settings/payouts/route.ts` - Payout settings API
- `src/app/api/payouts/route.ts` - Commission payouts API
- `src/app/api/payouts/balance/route.ts` - Balance checking API
- `src/app/api/invoices/route.ts` - Invoice management API
- `BILLING_IMPLEMENTATION.md` - Complete backend documentation
