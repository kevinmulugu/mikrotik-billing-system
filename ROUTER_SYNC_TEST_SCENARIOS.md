# Router Sync Test Scenarios

This document shows how `sync-vouchers-with-router.ts` handles various edge cases and problematic
voucher states.

## Scenario 1: Voucher Used But Login Callback Never Fired

### **Initial State (Your Example):**

```json
{
  "voucherInfo": { "code": "5SY4Z7VE", "duration": 60 },
  "usage": {
    "used": false, // ❌ Should be true
    "startTime": null, // ❌ Should have timestamp
    "expectedEndTime": null // ❌ Should be calculated
  },
  "mikrotikUserId": "*1", // ✅ Was added to router
  "status": "assigned", // ❌ Should be expired
  "payment": {
    "paymentDate": "2025-11-04T15:15:28.999Z"
  }
}
```

### **Router State:**

- User `5SY4Z7VE` uptime: `01:00:00` (exhausted)
- User `5SY4Z7VE` NOT in active sessions (session ended)

### **What Happens:**

1. **Script queries router active sessions:**

   ```typescript
   const activeSessions = await MikroTikService.getActiveHotspotUsers(conn);
   // Result: [] (no active session for 5SY4Z7VE)
   ```

2. **Script finds voucher by query:**

   ```typescript
   db.collection('vouchers').find({
     routerId: router._id,
     status: { $ne: 'expired' },
     $or: [
       { mikrotikUserId: { $ne: null } }, // ✅ MATCHES (has '*1')
     ],
   })
   ```

3. **Script detects inconsistency:**

   ```
   ✗ 5SY4Z7VE NOT active on router - marking expired
   ```

4. **Script backfills missing data:**

   ```typescript
   // startTime missing - use payment date as estimate
   startTime = paymentDate; // "2025-11-04T15:15:28.999Z"

   // Calculate expectedEndTime from duration
   expectedEndTime = startTime + (60 minutes);
   // Result: "2025-11-04T16:15:28.999Z"
   ```

5. **Script updates voucher:**

   ```json
   {
     "status": "expired",
     "usage": {
       "used": true, // ✅ Fixed
       "startTime": "2025-11-04T15:15:28.999Z", // ✅ Backfilled
       "endTime": "2025-11-04T16:15:28.999Z", // ✅ Set
       "expectedEndTime": "2025-11-04T16:15:28.999Z" // ✅ Calculated
     },
     "expiry": {
       "expiredBy": "routerSync" // ✅ Audit trail
     }
   }
   ```

6. **Script removes from router:**

   ```typescript
   await MikroTikService.deleteHotspotUser(conn, "5SY4Z7VE");
   // Cleanup router user definition
   ```

7. **Script creates audit log:**
   ```json
   {
     "action": {
       "type": "expire",
       "description": "Voucher expired by router sync - session no longer active"
     },
     "metadata": {
       "voucherCode": "5SY4Z7VE",
       "syncReason": "sessionEnded"
     }
   }
   ```

### **Output:**

```
[SyncVouchers]   Active sessions on router: 0
[SyncVouchers]   Vouchers to check: 1
[SyncVouchers]     ✗ 5SY4Z7VE NOT active on router - marking expired
[SyncVouchers]       Backfilling startTime from payment date
[SyncVouchers]       Calculated expectedEndTime: 2025-11-04T16:15:28.999Z
[SyncVouchers]       Removed user from router
```

---

## Scenario 2: Voucher Active with Proper Tracking

### **Initial State:**

```json
{
  "voucherInfo": { "code": "ABC123", "duration": 180 },
  "usage": {
    "used": true,
    "startTime": "2025-11-06T10:00:00.000Z",
    "expectedEndTime": "2025-11-06T13:00:00.000Z"
  },
  "mikrotikUserId": "*2",
  "status": "active"
}
```

### **Router State:**

- User `ABC123` in active sessions ✅
- Uptime: `00:45:23` (still running)

### **What Happens:**

1. Script finds active session on router
2. Script marks as still active
3. Script updates `usage.lastSeen` and `usage.currentUptime`

### **Output:**

```
[SyncVouchers]     ✓ ABC123 is active on router
```

---

## Scenario 3: Voucher Manually Disconnected by Admin

### **Initial State:**

```json
{
  "voucherInfo": { "code": "XYZ789", "duration": 120 },
  "usage": {
    "used": true,
    "startTime": "2025-11-06T09:00:00.000Z",
    "expectedEndTime": "2025-11-06T11:00:00.000Z"
  },
  "mikrotikUserId": "*3",
  "status": "active"
}
```

### **Router State:**

- Admin disconnected user at 09:30
- User `XYZ789` NOT in active sessions
- Current time: 09:45 (before expectedEndTime)

### **What Happens:**

1. Script detects no active session (even though expectedEndTime not reached)
2. Uses `expectedEndTime` as `endTime` (original plan)
3. Marks as expired via routerSync
4. Removes from router

### **Result:**

```json
{
  "status": "expired",
  "usage": {
    "endTime": "2025-11-06T11:00:00.000Z", // Uses expectedEndTime
    "actualSessionTime": "00:30:00" // Session ended early
  },
  "expiry": {
    "expiredBy": "routerSync"
  }
}
```

---

## Scenario 4: Multiple Statuses Covered

The script now handles vouchers in ANY of these states:

| Status     | mikrotikUserId | usage.used | What Script Does                           |
| ---------- | -------------- | ---------- | ------------------------------------------ |
| `assigned` | `*1`           | `false`    | ✅ Checks router, expires if session ended |
| `paid`     | `*5`           | `false`    | ✅ Checks router, expires if session ended |
| `active`   | `*2`           | `true`     | ✅ Checks router, expires if session ended |
| `active`   | `null`         | `true`     | ⚠️ Skips (no router sync possible)         |
| `expired`  | `*3`           | `true`     | ⚠️ Skips (already expired)                 |

---

## Query Logic Explained

### **Old Query (MISSED your voucher):**

```typescript
{
  routerId: router._id,
  $or: [
    { 'usage.used': true, status: 'active' },      // ❌ Requires status='active'
    { mikrotikUserId: { $ne: null }, status: 'active' },  // ❌ Requires status='active'
  ],
}
```

**Problem:** Voucher with `status: 'assigned'` was ignored!

### **New Query (CATCHES your voucher):**

```typescript
{
  routerId: router._id,
  status: { $ne: 'expired' },  // ✅ Any non-expired status
  $or: [
    { 'usage.used': true },
    { mikrotikUserId: { $ne: null } },  // ✅ ANY voucher added to router
    { 'usage.startTime': { $ne: null } },
  ],
}
```

**Solution:** Catches vouchers in `'assigned'`, `'paid'`, `'active'` that have been synced to
router!

---

## Backfilling Logic

When a voucher has `mikrotikUserId` but missing timestamps:

1. **Estimate startTime:**

   ```typescript
   startTime = voucher.payment?.paymentDate || voucher.createdAt
   ```

   - Uses payment date if available (most accurate)
   - Falls back to creation date

2. **Calculate expectedEndTime:**

   ```typescript
   duration = voucher.usage?.maxDurationMinutes || voucher.voucherInfo?.duration || 60
   expectedEndTime = new Date(startTime.getTime() + (duration * 60 * 1000))
   ```

3. **Set endTime:**
   ```typescript
   endTime = expectedEndTime || new Date()
   ```

   - Uses calculated expectedEndTime
   - Falls back to current time

---

## Testing Your Specific Voucher

```bash
# Run sync script
pnpm sync:vouchers

# Expected output for your voucher:
[SyncVouchers] Processing router: <router-name>
[SyncVouchers]   Active sessions on router: X
[SyncVouchers]   Vouchers to check: 1
[SyncVouchers]     ✗ 5SY4Z7VE NOT active on router - marking expired
[SyncVouchers]       Backfilling startTime from payment date
[SyncVouchers]       Calculated expectedEndTime: 2025-11-04T16:15:28.999Z
[SyncVouchers]       Removed user from router

============================================================
[SyncVouchers] SYNC COMPLETE
============================================================
Vouchers checked:     1
Still active:         0
Expired (synced):     1
============================================================
```

### **Verify Fix:**

```javascript
// MongoDB shell
db.vouchers.findOne({ voucherInfo: { code: "5SY4Z7VE" } })

// Should now show:
{
  status: "expired",
  usage: {
    used: true,
    startTime: ISODate("2025-11-04T15:15:28.999Z"),
    endTime: ISODate("2025-11-04T16:15:28.999Z"),
    expectedEndTime: ISODate("2025-11-04T16:15:28.999Z")
  },
  expiry: {
    expiredBy: "routerSync"
  }
}
```

---

## Summary

✅ **YES** - The script NOW handles your voucher!

**Changes Made:**

1. ✅ Removed `status: 'active'` requirement from query
2. ✅ Checks ANY voucher with `mikrotikUserId` (not just `'active'` status)
3. ✅ Backfills missing `startTime` from payment date
4. ✅ Calculates missing `expectedEndTime` from duration
5. ✅ Properly marks `usage.used: true` when expiring
6. ✅ Creates audit trail with `expiredBy: 'routerSync'`

**Your Voucher:**

- Status: `'assigned'` → Will be found ✅
- `mikrotikUserId: '*1'` → Will be checked ✅
- No active session → Will be expired ✅
- Missing timestamps → Will be backfilled ✅
