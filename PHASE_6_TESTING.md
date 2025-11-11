# Phase 6: Testing & Migration Guide

This document provides instructions for testing the multi-router implementation and migrating
existing data.

## Overview

The multi-router transformation is complete! This phase focuses on:

- Running migration scripts for existing data
- Testing with real MikroTik and UniFi routers
- Validating all API endpoints
- Preparing for production deployment

---

## 1. Pre-Migration Backup

**⚠️ CRITICAL: Always backup your database before running migrations!**

```bash
# MongoDB backup
mongodump --uri="$MONGODB_URI" --out=./backup/$(date +%Y%m%d_%H%M%S)

# Or use MongoDB Atlas backup if using Atlas
```

---

## 2. Run Migration Scripts

### Step 1: Migrate Routers

This script adds multi-router fields to existing router documents.

```bash
# Run router migration
npx tsx scripts/migrate-routers-to-multi-vendor.ts
```

**What it does:**

- Adds `routerType` field (defaults to 'mikrotik')
- Creates `services` structure from legacy `configuration`
- Adds `capabilities` object
- Creates `vendorConfig.mikrotik` from existing data
- Maintains backward compatibility

**Expected output:**

```
✅ Connected to MongoDB
📊 Found X router(s) to migrate
🔄 Migrating: Router Name (id)
  ✅ Successfully migrated
     - Router Type: mikrotik
     - Services: hotspot, pppoe
     - Supported Services: hotspot, pppoe
```

### Step 2: Migrate Vouchers

This script adds multi-router fields to existing voucher documents.

```bash
# Run voucher migration
npx tsx scripts/migrate-vouchers-to-multi-vendor.ts
```

**What it does:**

- Adds `routerType` field (matches parent router)
- Adds `serviceType` field (hotspot or pppoe)
- Creates `vendorSpecific.mikrotik` from existing fields
- Maintains backward compatibility

**Expected output:**

```
✅ Connected to MongoDB
📊 Found X voucher(s) to migrate
📦 Processing vouchers from Y router(s)...
✅ Migration completed successfully!
```

---

## 3. Verify Migrations

After running migrations, verify the data:

```bash
# Connect to MongoDB and check a router
mongo "$MONGODB_URI"

# Check router structure
db.routers.findOne({}, {
  routerType: 1,
  services: 1,
  capabilities: 1,
  vendorConfig: 1
})

# Check voucher structure
db.vouchers.findOne({}, {
  routerType: 1,
  serviceType: 1,
  vendorSpecific: 1
})
```

**Expected router fields:**

- `routerType`: "mikrotik" or "unifi"
- `services.hotspot`: { enabled, packages, lastSynced }
- `services.pppoe`: { enabled, interface, packages, lastSynced }
- `capabilities`: { supportsVPN, supportedServices, captivePortalMethod, voucherFormat }
- `vendorConfig.mikrotik`: { firmwareVersion, identity, architecture }

**Expected voucher fields:**

- `routerType`: "mikrotik" or "unifi"
- `serviceType`: "hotspot" or "pppoe"
- `vendorSpecific.mikrotik`: { username, password, profile, service }

---

## 4. Test Multi-Router Functionality

Run the test script to validate the implementation:

```bash
npx tsx scripts/test-multi-router.ts
```

**Expected output:**

```
🧪 Multi-Router Functionality Tests
✅ MikroTik provider created successfully
✅ UniFi provider created successfully
✅ All tests passed successfully!
```

---

## 5. Test API Endpoints

### Test 1: Add Router (MikroTik)

```bash
curl -X POST http://localhost:3000/api/routers/add \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test MikroTik",
    "routerType": "mikrotik",
    "model": "MikroTik hAP ac²",
    "ipAddress": "192.168.88.1",
    "port": 8728,
    "apiUser": "admin",
    "apiPassword": "your_password",
    "hotspotEnabled": true,
    "pppoeEnabled": false
  }'
```

### Test 2: Add Router (UniFi)

```bash
curl -X POST http://localhost:3000/api/routers/add \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test UniFi",
    "routerType": "unifi",
    "model": "UniFi Dream Machine",
    "controllerUrl": "https://unifi.local:8443",
    "apiUser": "admin",
    "apiPassword": "your_password",
    "siteId": "default",
    "hotspotEnabled": true
  }'
```

### Test 3: Sync Packages (Hotspot)

```bash
# MikroTik Hotspot
curl -X POST "http://localhost:3000/api/routers/{routerId}/packages/sync?service=hotspot"

# UniFi Hotspot
curl -X POST "http://localhost:3000/api/routers/{routerId}/packages/sync?service=hotspot"
```

### Test 4: Sync Packages (PPPoE - MikroTik only)

```bash
curl -X POST "http://localhost:3000/api/routers/{routerId}/packages/sync?service=pppoe"
```

### Test 5: Generate Vouchers (Hotspot)

```bash
curl -X POST "http://localhost:3000/api/routers/{routerId}/vouchers/generate?service=hotspot" \
  -H "Content-Type: application/json" \
  -d '{
    "packageId": "1hour-10ksh",
    "quantity": 5
  }'
```

### Test 6: Generate Vouchers (PPPoE)

```bash
curl -X POST "http://localhost:3000/api/routers/{routerId}/vouchers/generate?service=pppoe" \
  -H "Content-Type: application/json" \
  -d '{
    "packageId": "daily-100ksh",
    "quantity": 3
  }'
```

---

## 6. Test UI Components

### Router Add Form

1. Navigate to `/routers/add`
2. Verify router type selector (MikroTik/UniFi)
3. Select MikroTik → verify MikroTik models appear
4. Select UniFi → verify UniFi models appear
5. Enable Hotspot → verify SSID field appears
6. Enable PPPoE (MikroTik only) → verify interface field appears
7. Submit form → verify router created with correct schema

### Router Dashboard

1. Navigate to `/routers`
2. Verify router type badges (MikroTik/UniFi icons)
3. Verify service badges (Hotspot/PPPoE with colors)
4. Click router → verify details page shows correct info

### Voucher Generation

1. Navigate to router vouchers page
2. Verify service selector (Hotspot/PPPoE)
3. Generate hotspot vouchers → verify username/password format
4. Generate PPPoE vouchers → verify profile is set correctly

---

## 7. Test Real Router Connections

### MikroTik Router Test

```bash
# Prerequisites:
# - MikroTik router with IP 192.168.88.1
# - API enabled on port 8728
# - Admin user with password

# Test steps:
1. Add router via UI with real credentials
2. Test package sync (should fetch actual user profiles)
3. Generate 1 test voucher
4. Verify voucher created on MikroTik:
   - Login to router via WinBox
   - Go to IP → Hotspot → Users
   - Verify user exists with correct profile
5. Test voucher on actual device:
   - Connect to WiFi
   - Open browser → should redirect to captive portal
   - Enter voucher credentials
   - Verify internet access
```

### UniFi Controller Test

```bash
# Prerequisites:
# - UniFi Controller (Dream Machine, Cloud Key, or self-hosted)
# - HTTPS enabled
# - Admin credentials
# - At least one site configured

# Test steps:
1. Add router via UI with controller URL and credentials
2. Select site from dropdown
3. Test package sync (should fetch voucher profiles)
4. Generate 5 test vouchers
5. Verify vouchers created in UniFi:
   - Login to UniFi Controller
   - Go to Settings → Guest Control → Vouchers
   - Verify vouchers exist
6. Test voucher on actual device:
   - Connect to guest WiFi
   - Open browser → captive portal
   - Enter voucher code
   - Verify internet access
```

---

## 8. Performance Testing

### Load Test: Voucher Generation

```bash
# Generate 100 vouchers
time curl -X POST "http://localhost:3000/api/routers/{routerId}/vouchers/generate?service=hotspot" \
  -H "Content-Type: application/json" \
  -d '{
    "packageId": "1hour-10ksh",
    "quantity": 100
  }'

# Expected: < 5 seconds for 100 vouchers
```

### Load Test: Package Sync

```bash
# Sync packages with 50+ profiles
time curl -X POST "http://localhost:3000/api/routers/{routerId}/packages/sync?service=hotspot"

# Expected: < 3 seconds
```

---

## 9. Common Issues & Solutions

### Issue: Migration fails with "routerType already exists"

**Solution:** Routers already migrated. Check database manually.

### Issue: UniFi provider fails to connect

**Solution:**

- Verify controller URL (must include https://)
- Check firewall rules (port 8443)
- Verify SSL certificate (self-signed may need NODE_TLS_REJECT_UNAUTHORIZED=0)

### Issue: MikroTik API connection timeout

**Solution:**

- Verify API enabled on router (IP → Services → API)
- Check API port (default 8728)
- Verify firewall rules allow connection
- Test with WinBox first to confirm connectivity

### Issue: Vouchers not showing service type

**Solution:** Run voucher migration script again.

### Issue: PPPoE option not showing for UniFi

**Solution:** This is expected. UniFi doesn't support PPPoE service yet.

---

## 10. Rollback Plan

If issues occur, rollback procedure:

```bash
# 1. Stop the application
pm2 stop nextjs-mikrotik-portal

# 2. Restore database from backup
mongorestore --uri="$MONGODB_URI" --drop ./backup/TIMESTAMP

# 3. Checkout previous commit
git checkout main  # or previous stable commit

# 4. Restart application
pm2 start nextjs-mikrotik-portal
```

---

## 11. Sign-off Checklist

Before proceeding to Phase 7 (Production Deployment):

- [ ] Router migration completed successfully
- [ ] Voucher migration completed successfully
- [ ] All API endpoints tested and working
- [ ] UI components display correctly
- [ ] MikroTik router tested with real hardware
- [ ] UniFi controller tested with real controller
- [ ] 100+ vouchers generated successfully
- [ ] Package sync works for both router types
- [ ] Webhook handler tested with M-Pesa payments
- [ ] No TypeScript errors
- [ ] No console errors in browser
- [ ] Database backup created
- [ ] Rollback plan documented and understood

---

## Next Steps

Once all tests pass:

1. ✅ Mark Phase 6 complete
2. 📝 Update documentation (Phase 7)
3. 🚀 Deploy to production (Phase 7)

---

## Support

For issues or questions:

- Check `/AUTHENTICATION.md` for auth-related issues
- Check `/VOUCHER_PURCHASE_FLOW.md` for payment issues
- Check `/MPESA_PURCHASE_IMPLEMENTATION.md` for M-Pesa issues
- Review code in `/lib/providers/` for provider-specific issues
