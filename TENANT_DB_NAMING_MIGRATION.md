# Tenant Database Naming Unification

## Date
2025-01-27

## Summary

Unified tenant database naming to use a single pattern: `syra_tenant__<tenantKey>`.

Previously, there were multiple naming patterns:
- `st__<tenantKey>` (short pattern)
- `sira_tenant__<tenantKey>` (old pattern)

## Changes Made

### 1. Code Updates

**File: `lib/db/dbNameHelper.ts`**
- Updated `generateTenantDbName()` to use unified pattern: `syra_tenant__<tenantKey>`
- Removed hash-based naming logic (no longer needed)
- Updated maximum length from 38 to 64 bytes (MongoDB Atlas limit)
- Simplified logic to always use the pattern directly

**File: `lib/models/Tenant.ts`**
- Updated documentation to reflect new naming pattern

### 2. Migration Script

**File: `scripts/migrations/019_unify_tenant_db_names.cjs`**

This script:
1. Lists all databases matching old patterns (`st__*` or `sira_tenant__*`)
2. For each database, extracts tenantKey
3. Creates new database with name: `syra_tenant__<tenantKey>`
4. Copies all collections and indexes from old database
5. Updates tenant records in `syra_platform.tenants` with new `dbName`
6. Verifies migration
7. Provides instructions for dropping old databases (after verification)

## Migration Steps

### Step 1: Run Migration Script

```bash
node scripts/migrations/019_unify_tenant_db_names.cjs
```

Or with dotenv:
```bash
dotenv -e .env.local -- node scripts/migrations/019_unify_tenant_db_names.cjs
```

### Step 2: Verify Migration

The script will output a summary showing:
- Which databases were migrated
- Number of collections and documents copied
- Any errors or skipped databases

### Step 3: Test Application

1. Test login and tenant access
2. Verify data is accessible
3. Check that tenant databases are using new names

### Step 4: Drop Old Databases (After Verification)

⚠️ **WARNING: Only drop old databases after thorough verification!**

Example MongoDB commands:
```bash
# Connect to MongoDB
mongosh

# List databases to verify
show dbs

# Drop old databases (one at a time)
db.getSiblingDB('st__tenant-key').dropDatabase()
db.getSiblingDB('sira_tenant__tenant-key').dropDatabase()
```

Or using mongosh command line:
```bash
mongosh --eval "db.getSiblingDB('st__tenant-key').dropDatabase()"
```

## New Naming Pattern

### Pattern
```
syra_tenant__<tenantKey>
```

### Examples
- Tenant ID: `default` → Database: `syra_tenant__default`
- Tenant ID: `hmg-whh` → Database: `syra_tenant__hmg-whh`
- Tenant ID: `tenant-123` → Database: `syra_tenant__tenant-123`

### Constraints
- MongoDB Atlas maximum database name length: 64 bytes
- Pattern prefix: `syra_tenant__` (13 characters)
- Maximum tenantKey length: 51 characters
- If tenantKey exceeds 51 characters, an error will be thrown

## Code Changes

### Before
```typescript
// lib/db/dbNameHelper.ts
const PREFIX = 'st__'; // Short pattern
// Used hash for long tenantIds
```

### After
```typescript
// lib/db/dbNameHelper.ts
const PREFIX = 'syra_tenant__'; // Unified pattern
// Always uses pattern directly
```

## Verification

### Check Code for Old Patterns

The following command can be used to verify no old patterns remain in active code:

```bash
# Search for old patterns (should only appear in migration scripts and reports)
grep -r "st__\|sira_tenant__" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.cjs" \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git \
  --exclude="*migration*" --exclude="*report*" lib/ app/
```

Expected: No matches (or only in migration scripts/reports)

### Verify Database Names

```bash
# Connect to MongoDB
mongosh

# List all databases
show dbs

# Verify tenant databases use new pattern
# Should see: syra_tenant__*
# Should NOT see: st__* or sira_tenant__* (after migration and cleanup)
```

## Rollback Plan

If rollback is needed:

1. **Revert code changes:**
   ```bash
   git revert <commit-hash>
   ```

2. **Restore old database names:**
   - Re-run old migration scripts if needed
   - Update tenant records with old dbName values

3. **Restore old pattern in code:**
   - Update `lib/db/dbNameHelper.ts` to use old pattern
   - Update `lib/models/Tenant.ts` documentation

**Note:** Rollback is not recommended after migration is complete and verified.

## Notes

- Old migration scripts (015, 016) are kept for historical reference but should not be run
- The new pattern is longer but more descriptive and unified
- All tenant databases should eventually use the new pattern
- Application code now only generates/uses the new pattern

## Related Files

- `lib/db/dbNameHelper.ts` - Database name generation
- `lib/db/tenantDb.ts` - Tenant database connection logic
- `lib/models/Tenant.ts` - Tenant model
- `scripts/migrations/019_unify_tenant_db_names.cjs` - Migration script

---

**Migration Status:** ✅ Code updated, migration script ready
**Verification Status:** ⏳ Pending migration execution

