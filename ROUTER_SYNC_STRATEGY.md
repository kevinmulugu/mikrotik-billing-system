# Router Voucher Sync Strategy

## Overview

The `sync-vouchers-with-router.ts` script synchronizes voucher state between the database and
MikroTik router by checking **actual uptime usage** rather than active session presence.

## Key Concept: Persistence Model

**We persist voucher credentials on the router until uptime is exhausted.**

This allows users to:

- Disconnect and reconnect within their purchased time
- Have temporary network issues without losing their time
- Switch devices (if not MAC-locked) within their session

## MikroTik Architecture

### User Definition (`/ip/hotspot/user`)

- **What**: Account template with credentials and limits
- **Created**: During voucher generation
- **Persists**: Until manually deleted
- **Contains**:
  - `name`: Voucher code
  - `password`: Voucher password
  - `limit-uptime`: Maximum time (e.g., "3h", "1d")
  - `uptime`: Actual time used so far
  - `profile`: Package settings

### Active Session (`/ip/hotspot/active`)

- **What**: Current live connection
- **Created**: When user logs in
- **Auto-removed**: When user disconnects OR uptime exhausted
- **Purpose**: Track current network usage

## Sync Logic Flow (Simple!)

```typescript
For each voucher with mikrotikUserId (synced to router):

  1. Query router: getHotspotUser(voucherCode)

     ├─ If NOT exists:
     │  → Router removed it → Mark expired in DB
     │
     └─ If EXISTS:
        → Check limit-uptime field

        ├─ If limit-uptime is used up (uptime >= limit-uptime):
        │  → Mark as used in DB
        │  → Delete from router
        │  → Done!
        │
        └─ If still has time (uptime < limit-uptime):
           → Keep it (user can reconnect)
           → Update currentUptime in DB
```

**That's it! Simple and effective.**## Example Scenarios

### Scenario 1: User Disconnects Mid-Session

```
User: Purchased 3-hour voucher
Time used: 1h 30m
Action: Closes laptop (disconnects)

Router State (query getHotspotUser):
  - User definition: EXISTS
  - limit-uptime: "3h"
  - uptime: "1h30m"

Sync Script:
  ✓ User exists
  ✓ Check: 1h30m < 3h → Still has time!
  ✓ Keep user on router
  ✓ Update DB: currentUptime = "1h30m"

Result: User can reconnect and use remaining 1h 30m ✓
```

### Scenario 2: Time Exhausted

```
User: Purchased 3-hour voucher
Time used: 3h 0m
Action: Time runs out

Router State (query getHotspotUser):
  - User definition: EXISTS
  - limit-uptime: "3h"
  - uptime: "3h"

Sync Script:
  ✓ User exists
  ✗ Check: 3h >= 3h → Time used up!
  → Mark as used in DB
  → Delete from router

Result: User cannot login anymore (deleted) ✗
```

### Scenario 3: Manual Admin Removal

```
User: Purchased 3-hour voucher
Time used: 2h 0m
Action: Admin manually deleted user from router

Router State (query getHotspotUser):
  - User definition: DOES NOT EXIST

Sync Script:
  ✗ User doesn't exist
  → Mark expired in DB

Result: Voucher marked expired (respects router state) ✓
```

## Benefits of This Approach

### 1. Better User Experience

- Users can disconnect/reconnect freely within their time
- Temporary network issues don't waste purchased time
- More forgiving for intermittent usage patterns

### 2. Accurate Time Tracking

- Only actual connection time (uptime) counts
- Router manages uptime tracking automatically
- No manual time calculations needed

### 3. Single Source of Truth

- Router's uptime counter is authoritative
- Database reflects router's actual state
- No discrepancies between systems

## Benefits of This Simple Approach

### 1. Dead Simple Logic

```javascript
// Just 3 checks!
const user = getHotspotUser(voucherCode);
if (!user) → expire in DB
else if (user.uptime >= user['limit-uptime']) → mark used in DB + delete from router
else → keep (user can reconnect)
```

### 2. Single API Call

- Only need `getHotspotUser()` - one call per voucher
- No need for `getActiveHotspotUsers()` (was checking active sessions)
- Router does all the work tracking uptime

### 3. Router is Source of Truth

- `limit-uptime` field tells us the limit
- `uptime` field tells us what's been used
- Simple comparison: `uptime >= limit-uptime`
- No complex calculations needed

## Comparison with Previous Approach

### Old Approach: Session-Based

```
Check if voucher in active sessions
  ├─ In active sessions → OK
  └─ NOT in active sessions → EXPIRE + DELETE

Problems:
  ✗ Expires immediately on disconnect
  ✗ User can't reconnect within their time
  ✗ Network issues waste purchased time
  ✗ Poor user experience
```

### New Approach: Uptime-Based

```
Check user uptime vs limit-uptime
  ├─ Uptime < limit → KEEP (allow reconnection)
  └─ Uptime >= limit → EXPIRE + DELETE

Benefits:
  ✓ User can disconnect/reconnect
  ✓ Only pays for actual usage time
  ✓ Better user experience
  ✓ Accurate time tracking
```

## Integration with Other Systems

### expire-vouchers.ts (Time-Based Expiry)

- **Purpose**: Handle purchase expiry and scheduled expiry
- **Checks**: `expiry.expiresAt`, `usage.purchaseExpiresAt`
- **Frequency**: Every 30 minutes
- **Use Case**: "Must use within 7 days" type restrictions

### sync-vouchers-with-router.ts (Uptime-Based Expiry)

- **Purpose**: Handle actual usage time exhaustion
- **Checks**: MikroTik `uptime` vs `limit-uptime`
- **Frequency**: Every 60 minutes
- **Use Case**: "3 hours of internet" type vouchers

### They Work Together

```
Example: 3-hour voucher, must use within 7 days

expire-vouchers.ts:
  - Checks if 7 days have passed since purchase
  - Expires voucher if not used in time

sync-vouchers-with-router.ts:
  - Checks if 3 hours of actual usage exhausted
  - Expires voucher when uptime limit reached

User gets 7 days to start using it,
but only 3 hours of actual connection time.
```

## Monitoring Queries

### Find vouchers with time remaining

```javascript
db.vouchers.find({
  status: { $ne: 'expired' },
  mikrotikUserId: { $ne: null },
  'usage.currentUptime': { $exists: true },
});
```

### Find vouchers that should be synced

```javascript
db.vouchers.find({
  status: { $ne: 'expired' },
  mikrotikUserId: { $ne: null },
  'usage.lastSeen': {
    $lt: new Date(Date.now() - 2 * 60 * 60 * 1000), // Not seen in 2 hours
  },
});
```

### Check sync effectiveness

```javascript
db.vouchers.aggregate([
  { $match: { 'expiry.expiredBy': { $exists: true } } },
  {
    $group: {
      _id: '$expiry.expiredBy',
      count: { $sum: 1 },
    },
  },
]);
// Should show:
// - routerSync-uptimeExhausted: Most common (normal expiry)
// - routerSync-removed: Rare (manual intervention)
// - timeExpiry: From expire-vouchers.ts
```

## Testing Checklist

- [ ] Generate voucher with 1-hour limit
- [ ] Login and use for 30 minutes
- [ ] Disconnect manually
- [ ] Run sync script → Should KEEP voucher
- [ ] Reconnect successfully → Should work
- [ ] Use remaining 30 minutes
- [ ] Run sync script after exhaustion → Should EXPIRE
- [ ] Try to login again → Should fail (user removed)
- [ ] Check DB: status='expired', expiredBy='routerSync-uptimeExhausted'

## Configuration

### Cron Setup

```bash
# Time-based expiry (purchase deadlines)
*/30 * * * * cd /path/to/project && pnpm expire:vouchers

# Uptime-based expiry (usage exhaustion)
0 * * * * cd /path/to/project && pnpm sync:vouchers
```

### Environment Variables

```env
# None required - uses router config from database
```

## Troubleshooting

### Voucher Not Expiring

1. Check if user exists on router: `/ip/hotspot/user/print where name="VOUCHERCODE"`
2. Check uptime: Look for `uptime` and `limit-uptime` fields
3. Verify limit: Should be in format "3h", "1d", etc.
4. Run sync manually: `pnpm sync:vouchers`

### User Can't Reconnect

1. Check voucher status in DB: Should NOT be 'expired'
2. Check router user: Should still exist in `/ip/hotspot/user`
3. Check uptime remaining: `uptime < limit-uptime`
4. Check router logs: `/log/print where topics~"hotspot"`

### Sync Taking Too Long

1. Reduce check frequency (currently 60 minutes)
2. Add index: `db.vouchers.createIndex({ routerId: 1, mikrotikUserId: 1, status: 1 })`
3. Batch router queries (already implemented)
4. Monitor script execution time

## Security Considerations

### Single-Use Enforcement

Even though we persist credentials, vouchers are single-use because:

- Database tracks customerId (one voucher per customer)
- Once uptime exhausted, user removed from router
- Cannot purchase same voucher code twice

### Shared Vouchers

To prevent sharing:

- Enable MAC address binding in hotspot profile
- Set `shared-users=1` in profile
- Monitor concurrent sessions

### Admin Override

Admins can forcefully expire vouchers:

- Manually remove from router → Sync detects and expires in DB
- Database expiry → Next sync removes from router
- Both systems stay in sync

## Future Enhancements

- [ ] WebSocket real-time sync
- [ ] Configurable sync intervals per router
- [ ] Usage analytics (average session duration, peak times)
- [ ] Predictive expiry warnings (90% uptime used)
- [ ] Automated refunds for unused time (if business model allows)
