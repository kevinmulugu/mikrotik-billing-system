# Voucher Management Cron Jobs

This document explains the two complementary scripts for managing voucher lifecycle and router
synchronization.

## Overview

We have **two separate scripts** that work together to maintain voucher state:

1. **`expire-vouchers.ts`** - Time-based expiry (runs every 30 minutes)
2. **`sync-vouchers-with-router.ts`** - Router state sync (runs every hour)

## Why Two Scripts?

### Time-Based Expiry (`expire-vouchers.ts`)

- **Purpose**: Expire vouchers based on calculated time periods
- **Checks**:
  - `expiry.expiresAt` - Activation expiry (voucher never used within 7 days)
  - `usage.purchaseExpiresAt` - Purchase expiry (paid but never activated)
  - `usage.expectedEndTime` - Usage expiry (session duration elapsed)
- **Reliability**: 100% reliable (time-based calculations)
- **Frequency**: Every 30 minutes
- **Failure Mode**: Low risk (no external dependencies)

### Router State Sync (`sync-vouchers-with-router.ts`)

- **Purpose**: Detect sessions that ended on router but DB wasn't updated
- **Checks**:
  - Query MikroTik active sessions
  - Compare with DB vouchers marked as "active"
  - Expire vouchers with no active session on router
- **Reliability**: Depends on router connectivity
- **Frequency**: Every 60 minutes (less frequent to reduce router load)
- **Failure Mode**: Can fail if router unreachable (non-critical)

## Scenarios Handled

### Scenario 1: Normal Expiry (Time-Based) ✓

```
User logs in → Session runs → expectedEndTime reached
expire-vouchers.ts marks as expired → Removes from router
```

### Scenario 2: Session Ends Early (Router Sync) ✓

```
User logs in → Router expires session → Router removes user
DB still shows "active" → sync-vouchers-with-router.ts detects → Marks expired
```

### Scenario 3: Purchase Never Activated (Time-Based) ✓

```
User pays → 7 days pass → Never logs in
expire-vouchers.ts checks purchaseExpiresAt → Marks expired
```

### Scenario 4: Router Disconnects User (Router Sync) ✓

```
Admin manually disconnects user → Router removes session
sync-vouchers-with-router.ts detects no active session → Marks expired
```

## Cron Setup

### Production (crontab)

```bash
# Edit crontab
crontab -e

# Add these lines (adjust path to your project)
# Expire vouchers every 30 minutes
*/30 * * * * cd /path/to/nextjs-mikrotik-customer-portal && /home/kevin/.local/share/pnpm/pnpm expire:vouchers >> /var/log/expire-vouchers.log 2>&1

# Sync with router state every hour
0 * * * * cd /path/to/nextjs-mikrotik-customer-portal && /home/kevin/.local/share/pnpm/pnpm sync:vouchers >> /var/log/sync-vouchers.log 2>&1

# Refresh M-Pesa tokens every 30 minutes
*/30 * * * * cd /path/to/nextjs-mikrotik-customer-portal && /home/kevin/.local/share/pnpm/pnpm refresh:tokens >> /var/log/refresh-tokens.log 2>&1

# Start scripts on system reboot (with 60s delay for services to start)
@reboot sleep 60 && cd /path/to/nextjs-mikrotik-customer-portal && /home/kevin/.local/share/pnpm/pnpm expire:vouchers
@reboot sleep 120 && cd /path/to/nextjs-mikrotik-customer-portal && /home/kevin/.local/share/pnpm/pnpm sync:vouchers
```

### Manual Testing

```bash
# Test expiry script
pnpm expire:vouchers

# Test sync script
pnpm sync:vouchers

# Run both in sequence
pnpm expire:vouchers && pnpm sync:vouchers
```

## Expected Output

### expire-vouchers.ts

```
[ExpireVouchers] Starting expiry check at 2025-11-06T10:30:00.000Z
[ExpireVouchers] Vouchers to process: 15
[ExpireVouchers] Completed. Processed: 15, removedOnRouter: 12
[ExpireVouchers] Script completed successfully
```

### sync-vouchers-with-router.ts

```
[SyncVouchers] Starting router sync at 2025-11-06T11:00:00.000Z
[SyncVouchers] Found 3 active routers

[SyncVouchers] Processing router: Main Office Router
[SyncVouchers]   Active sessions on router: 24
[SyncVouchers]   Vouchers to check: 30
[SyncVouchers]     ✓ VOUCH123 is active on router
[SyncVouchers]     ✗ VOUCH456 NOT active on router - marking expired
[SyncVouchers]       Removed user from router
[SyncVouchers]   Router Main Office Router complete

============================================================
[SyncVouchers] SYNC COMPLETE
============================================================
Routers processed:    3
Vouchers checked:     82
Still active:         76
Expired (synced):     6
Errors:               0
============================================================
```

## Monitoring

### Check Logs

```bash
# View recent expiry logs
tail -f /var/log/expire-vouchers.log

# View recent sync logs
tail -f /var/log/sync-vouchers.log

# Check for errors
grep "Error" /var/log/expire-vouchers.log
grep "Error" /var/log/sync-vouchers.log
```

### Database Verification

```javascript
// MongoDB shell - Check expired vouchers
db.vouchers.countDocuments({ status: 'expired', 'expiry.expiredBy': 'routerSync' });

// Check active vouchers with no router session
db.vouchers.find({
  status: 'active',
  'usage.used': true,
  'usage.startTime': { $ne: null },
});
```

## Troubleshooting

### expire-vouchers.ts fails

```bash
# Check MongoDB connection
pnpm tsx -e "import { MongoClient } from 'mongodb'; MongoClient.connect(process.env.MONGODB_URI).then(() => console.log('OK'))"

# Check environment variables
cat .env.local | grep MONGODB_URI
```

### sync-vouchers-with-router.ts fails

```bash
# Check router connectivity
pnpm tsx scripts/test-router-config.ts

# Check VPN connection (if using VPN)
ping <router-vpn-ip>

# Run with verbose logging
NODE_ENV=development pnpm sync:vouchers
```

### Cron jobs not running

```bash
# Check cron service
sudo systemctl status cron

# Check cron logs
grep CRON /var/log/syslog

# Test cron path resolution
which pnpm  # Should show /home/kevin/.local/share/pnpm/pnpm
```

## Performance Considerations

### expire-vouchers.ts

- **Query Performance**: Uses indexes on `expiry.expiresAt`, `usage.purchaseExpiresAt`,
  `usage.expectedEndTime`
- **Router Load**: Only contacts router for deletion (low impact)
- **Run Time**: ~2-5 seconds for 1000 vouchers

### sync-vouchers-with-router.ts

- **Query Performance**: One query per router for active sessions
- **Router Load**: Higher (queries active sessions per router)
- **Run Time**: ~10-30 seconds depending on number of routers
- **Recommendation**: Run less frequently (hourly) to reduce router load

## Best Practices

1. **Run expire-vouchers.ts more frequently** (every 30 min) - it's fast and reliable
2. **Run sync-vouchers-with-router.ts less frequently** (every 60 min) - it queries routers
3. **Monitor both logs** - different failure modes require different alerts
4. **Use different log files** - easier to diagnose issues
5. **Start with sync on system boot** - ensures clean state after restart

## Database Indexes Required

```javascript
// Vouchers collection
db.vouchers.createIndex({ 'expiry.expiresAt': 1, status: 1 });
db.vouchers.createIndex({ 'usage.purchaseExpiresAt': 1, status: 1 });
db.vouchers.createIndex({ 'usage.expectedEndTime': 1, status: 1 });
db.vouchers.createIndex({ routerId: 1, status: 1, 'usage.used': 1 });
db.vouchers.createIndex({ routerId: 1, 'usage.startTime': 1, status: 1 });
```

## Summary

The two-script approach provides:

- ✅ **Reliability**: Time-based expiry always works
- ✅ **Accuracy**: Router sync catches edge cases
- ✅ **Performance**: Each script optimized for its purpose
- ✅ **Resilience**: One can fail without affecting the other
- ✅ **Maintainability**: Clear separation of concerns
