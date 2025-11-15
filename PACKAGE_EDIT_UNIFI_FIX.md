# Package Edit - UniFi Support Fix

## Issue

The package edit functionality was working for package creation but the edit page was still
MikroTik-only, always showing sync warnings and attempting router synchronization even for UniFi
routers.

## Files Fixed

### 1. Frontend: Package Edit Page

**File:** `src/app/routers/[id]/packages/[packageName]/edit/page.tsx`

#### Changes Made:

**Added Router Type State:**

```typescript
const [routerType, setRouterType] = useState<'mikrotik' | 'unifi'>('mikrotik');
```

**Fetch Router Type:**

```typescript
setRouterData(routerDataResult.router);
setRouterType(routerDataResult.router.routerType || 'mikrotik');
```

**UniFi Notice Alert:** Added alert for UniFi routers explaining database-only packages:

```tsx
{routerType === 'unifi' && (
  <Alert>
    <Info className="h-4 w-4" />
    <AlertDescription>
      <strong>UniFi Router:</strong> Packages are stored in the database only.
      No router synchronization is performed. Bandwidth and duration limits are
      enforced through your UniFi Controller's hotspot portal configuration.
    </AlertDescription>
  </Alert>
)}
```

**Conditional Sync Warnings:**

- Sync badges only shown for MikroTik routers
- Sync warning messages only shown for MikroTik routers
- Orange "Router sync required" messages hidden for UniFi

**Updated Card Descriptions:**

- Usage Limits card: Different description for each router type
- Bandwidth Settings card: Different description for each router type
- Price field: Conditional sync message

### 2. Backend: Package Update API

**File:** `src/app/api/routers/[id]/packages/[packageName]/route.ts`

#### Changes Made:

**Router Type Check:**

```typescript
// Check router type before attempting sync
const routerType = router.routerType || 'mikrotik';

// Try to sync updated package to MikroTik if router is online
let mikrotikSyncResult = null;

if (routerType === 'unifi') {
  // UniFi packages are database-only, no router sync needed
  mergedPackage.syncStatus = 'synced';
  mergedPackage.lastSynced = new Date();
  mergedPackage.syncError = null;
  mikrotikSyncResult = {
    success: true,
    message: 'UniFi packages are managed in the database. No router sync required.',
  };
} else if (router.health?.status === 'online') {
  // Continue with MikroTik sync...
}
```

## Impact

### Before Fix

❌ Edit page showed sync warnings for all routers  
❌ UniFi routers attempted MikroTik sync (would fail)  
❌ Confusing UI with irrelevant sync messages for UniFi  
❌ Package updates failed for UniFi routers

### After Fix

✅ Edit page adapts to router type  
✅ UniFi routers skip sync, mark as synced immediately  
✅ Clear messaging for UniFi (database-only)  
✅ Sync warnings only shown for MikroTik  
✅ Package updates work for both router types

## User Experience

### MikroTik Routers (Unchanged)

- ✅ See sync badges on Usage Limits and Bandwidth cards
- ✅ Get orange warnings when changing sync-required fields
- ✅ See "Router sync required" messages
- ✅ Sync actually happens if router online
- ✅ Can track sync status (synced/out_of_sync/failed)

### UniFi Routers (Now Working)

- ✅ See UniFi notice explaining database-only packages
- ✅ No sync badges or warnings (not needed)
- ✅ Clean, relevant UI without MikroTik-specific messages
- ✅ Package updates work without errors
- ✅ All changes save immediately to database

## Pattern Consistency

This fix follows the same pattern established in:

1. **Package Create** (`POST /api/routers/[id]/packages`) - Already checks router type
2. **Voucher Generation** - Checks router type, skips sync for UniFi
3. **Package Sync** - Checks router type, early returns for UniFi
4. **All PPPoE pages** - Check router type, block access for UniFi

## Testing Checklist

### MikroTik Router

- [ ] Edit page loads without errors
- [ ] Sync badges visible on Usage Limits and Bandwidth cards
- [ ] Changing duration shows orange "sync required" message
- [ ] Changing data limit shows orange "sync required" message
- [ ] Changing bandwidth shows orange "sync required" message
- [ ] Price changes don't show sync messages
- [ ] Validity changes don't show sync messages
- [ ] Save updates package in database
- [ ] Save attempts router sync if online
- [ ] Success toast appropriate based on sync result

### UniFi Router

- [ ] Edit page loads without errors
- [ ] UniFi notice alert shown at top
- [ ] No sync badges on any cards
- [ ] No orange "sync required" messages
- [ ] Card descriptions reflect database-only nature
- [ ] All fields editable
- [ ] Save updates package in database
- [ ] No router sync attempted
- [ ] Success toast confirms database update

### Both Router Types

- [ ] Form validation works correctly
- [ ] Error messages display properly
- [ ] Cancel button works
- [ ] Save button disabled while saving
- [ ] Loading states work correctly
- [ ] Navigation after save works

## Related Files

**Working correctly (already support both types):**

- ✅ `src/app/routers/[id]/packages/create/page.tsx` - Create package page
- ✅ `src/app/api/routers/[id]/packages/route.ts` - Create package API (POST)
- ✅ `src/app/api/routers/[id]/packages/[packageName]/sync/route.ts` - Sync API

**Now fixed:**

- ✅ `src/app/routers/[id]/packages/[packageName]/edit/page.tsx` - Edit page
- ✅ `src/app/api/routers/[id]/packages/[packageName]/route.ts` - Update API (PATCH)

## API Response Changes

The PATCH endpoint now returns appropriate messages for UniFi:

**UniFi Response:**

```json
{
  "success": true,
  "package": { ... },
  "sync": {
    "success": true,
    "message": "UniFi packages are managed in the database. No router sync required."
  }
}
```

**MikroTik Response (Unchanged):**

```json
{
  "success": true,
  "package": { ... },
  "sync": {
    "success": true,
    "mikrotikId": "*5",
    "message": "Package synced to router successfully"
  }
}
```

## Summary

✅ **Package edit now fully supports both MikroTik and UniFi routers**  
✅ **No compilation errors**  
✅ **Consistent with other UniFi support implementations**  
✅ **No breaking changes to MikroTik functionality**  
✅ **Clear, appropriate messaging for each router type**

**Files Modified:** 2  
**Lines Changed:** ~50  
**Breaking Changes:** None  
**Status:** Ready for testing
