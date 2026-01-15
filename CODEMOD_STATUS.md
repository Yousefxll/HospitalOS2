# Codemod Status Report

## ✅ Completed

1. **Created codemod script** (`scripts/codemod-apply-auth-wrapper.ts`)
   - Detects routes needing transformation
   - Adds `withAuthTenant` import
   - Attempts to wrap handlers (needs refinement)

2. **Updated `withAuthTenant` wrapper** (`lib/core/guards/withAuthTenant.ts`)
   - Added support for dynamic route params
   - Updated handler signature to accept params

3. **Added npm script** (`package.json`)
   - `yarn codemod:auth <path>` - Run codemod on specific path

4. **Improved route scanner** (`lib/core/quality/routeScanner.ts`)
   - Recognizes `getTenantCollection` and `getTenantDbFromRequest` as valid tenant filtering
   - Recognizes manual role checks after auth
   - Reduced violations from 113 (88 critical/50 high) to 109 (88 critical/42 high)

## ⚠️ Current Issues

1. **Codemod regex limitations:**
   - Function body extraction is incomplete
   - Doesn't properly handle nested braces
   - Leaves old code outside wrapper

2. **Manual transformation required:**
   - The codemod needs significant refinement to properly extract and transform function bodies
   - Complex routes with nested structures require manual review

## 📋 Recommended Approach

Given the complexity of automated transformation, recommend:

### Option A: Enhanced Codemod (Recommended)
- Use a proper AST parser (e.g., `@babel/parser`, `ts-morph`) for accurate code transformation
- This requires additional dependencies but ensures correctness

### Option B: Semi-Automated Approach
1. Use codemod to:
   - Add imports
   - Add TODO comments
   - List routes needing manual transformation
2. Manually transform routes in batches
3. Verify after each batch

### Option C: Manual Transformation (Fastest)
- Transform routes manually following the pattern in `scripts/codemod-manual-transform.md`
- Apply in batches as specified
- Verify with quality gate after each batch

## 🎯 Next Steps

1. **Immediate:** Transform routes manually in batches:
   - Batch 1: `/admin/ehr/**` (10 routes) ✅ Partially done
   - Batch 2: `/admin/**` (remaining routes)
   - Batch 3: `/structure/**`
   - Batch 4: `/sam/**`
   - Batch 5: `/policies/**` + `/risk-detector/**`
   - Batch 6: Remaining routes

2. **After each batch:**
   - Run `yarn test:quality`
   - Ensure critical violations decrease
   - Run `yarn test:e2e` to ensure no regression

3. **Goal:**
   - Critical = 0
   - High = 0
   - No deployment until achieved

## 📊 Current Quality Gate Status

- **Total Routes Scanned:** 218
- **Routes with Violations:** 109
- **Critical Violations:** 88 (missing_tenant_filter)
- **High Violations:** 42 (missing_permission_check)

## 🔧 Tools Created

1. **Codemod Script:** `scripts/codemod-apply-auth-wrapper.ts`
   - Usage: `yarn codemod:auth <path>`
   - Generates report: `codemod-report.json`

2. **Manual Transform Guide:** `scripts/codemod-manual-transform.md`
   - Step-by-step pattern for manual transformation

3. **Quality Gate:** `yarn test:quality`
   - Scans all routes for security violations
   - Reports violations by severity
