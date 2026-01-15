# Codemod Improvements Summary

## ✅ Completed Improvements

1. **Created improved codemod v2** (`scripts/codemod-improved-v2.ts`)
   - Uses balanced brace matching for accurate function body extraction
   - Handles dynamic routes with params
   - Removes requireAuth checks from main body
   - Replaces request with req throughout
   - Adds createTenantQuery for DB queries
   - Adds tenantId to object definitions used in insertOne
   - Removes unused requireAuth imports
   - Normalizes indentation

2. **Fixed route transformation** (manual fix for `/api/admin/ehr/tasks` as reference)
   - ✅ Properly wraps with withAuthTenant
   - ✅ Removes requireAuth from main body
   - ✅ Uses createTenantQuery for patient lookup
   - ✅ Adds tenantId to task object
   - ✅ Adds tenantId to audit log (both main body and catch block)
   - ✅ Fixes catch block to use user from context
   - ✅ Removes unused requireAuth import

## ⚠️ Known Issues with Codemod v2

1. **Audit log transformation:**
   - Sometimes removes `success` property when adding tenantId
   - Needs to preserve all existing properties while adding tenantId

2. **Catch block handling:**
   - Sometimes removes audit log code entirely when removing requireAuth
   - Needs to preserve audit log but update it to use user from context

3. **Indentation:**
   - Extra blank lines after try block
   - Needs better normalization

4. **Duplicate comments:**
   - Sometimes creates duplicate "CRITICAL" comments
   - Needs to check for existing comments before adding

## 🎯 Next Improvements Needed

1. **Preserve audit log structure:**
   - When adding tenantId to createAuditLog, preserve all existing properties
   - Add tenantId before success (for success cases) or errorMessage (for error cases)
   - Keep all other properties intact

2. **Better catch block handling:**
   - Find audit log in catch block before removing requireAuth
   - Update audit log to use user from context instead of authResult.user
   - Add tenantId to audit log if missing
   - Preserve try-catch structure around audit log if it exists

3. **Indentation normalization:**
   - Better algorithm to preserve relative indentation
   - Remove excessive blank lines
   - Ensure consistent 2-space indentation for body content

4. **Object transformation:**
   - Better handling of multi-line object definitions
   - Preserve all properties when adding tenantId
   - Handle trailing commas correctly

## 📊 Current Status

- **Total Routes Scanned:** 218
- **Routes with Violations:** 107
- **Critical Violations:** 86 (missing_tenant_filter)
- **High Violations:** 40 (missing_permission_check)

## 🔧 Usage

```bash
# Transform a single route
yarn codemod:v2 admin/ehr/tasks

# Transform all routes in a directory (needs batch script)
# TODO: Create batch transformation script
```

## 📝 Notes

The codemod is working but needs refinement for edge cases. Manual fixes may still be needed for complex routes until all edge cases are handled.
