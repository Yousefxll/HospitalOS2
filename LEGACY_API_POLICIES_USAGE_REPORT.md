# Legacy `/api/policies/` Usage Report

## 📊 Scan Results

### ✅ **USAGE FOUND** - `/api/policies/` is actively used

---

## 🔍 **Active Usage Locations**

### **1. Frontend Pages**

#### **A. `app/(dashboard)/policies/page.tsx`**
- **Line 1077**: `DELETE /api/policies/delete-all`
  - Used in `handleDeleteAll()` function
  - **Action Required**: Redirect to `/api/sam/policies/delete-all` (or create SAM equivalent)

#### **B. `app/(dashboard)/policies/policy-builder/page.tsx`**
- **Line 200**: `GET /api/policies/list?status=READY`
  - Used in `fetchPolicies()` function
  - **Action Required**: Redirect to `/api/sam/policies/list?status=READY`

- **Line 224**: `POST /api/policies/policy-builder/gap-analysis`
  - Used in `handleGapAnalysis()` function
  - **Action Required**: Keep (policy-builder is separate feature, may need platform detection)

- **Line 271**: `POST /api/policies/policy-builder/generate`
  - Used in `handleGenerate()` function
  - **Action Required**: Keep (policy-builder is separate feature, may need platform detection)

- **Line 670**: `POST /api/policies/policy-builder/validate-role`
  - Used in role validation
  - **Action Required**: Keep (policy-builder is separate feature, may need platform detection)

- **Line 1037**: `POST /api/policies/policy-builder/save-draft`
  - Used in draft saving
  - **Action Required**: Keep (policy-builder is separate feature, may need platform detection)

#### **C. `app/(dashboard)/ai/policy-assistant/page.tsx`**
- **Line 369**: `POST /api/policies/search`
  - Used in search functionality
  - **Action Required**: Redirect to `/api/sam/policies/search`

- **Lines 641, 679, 732**: `router.push(/api/policies/view/${id})`
  - **⚠️ ERROR**: Using `router.push()` for API endpoint (should be direct URL or `/policies/view/${id}`)
  - **Action Required**: Fix to use proper view route or redirect to `/api/sam/policies/view/${id}`

---

### **2. Internal API Calls**

#### **A. `app/api/sam/policies/bulk-upload/route.ts`**
- **Line 185**: Internal fetch to `/api/policies/${policyId}/suggest-tags`
  - **⚠️ ERROR**: Should be `/api/sam/policies/${policyId}/suggest-tags`
  - **Action Required**: Fix to use SAM endpoint

---

### **3. Build Scripts & Tests**

#### **A. `scripts/add-dynamic-exports.py`**
- Contains legacy routes in export list
- **Action Required**: Remove from script (cosmetic only)

#### **B. `lib/core/quality/apiTests.ts`**
- Contains `/api/policies/[id]` in test list
- **Action Required**: Update test list (if tests are active)

---

## 📋 **Summary**

### **Endpoints Used:**

1. **`/api/policies/delete-all`** - DELETE
   - **Location**: `app/(dashboard)/policies/page.tsx`
   - **Action**: Redirect to SAM or create SAM equivalent

2. **`/api/policies/list`** - GET
   - **Location**: `app/(dashboard)/policies/policy-builder/page.tsx`
   - **Action**: Redirect to `/api/sam/policies/list`

3. **`/api/policies/search`** - POST
   - **Location**: `app/(dashboard)/ai/policy-assistant/page.tsx`
   - **Action**: Redirect to `/api/sam/policies/search`

4. **`/api/policies/view/[id]`** - GET (via router.push - ERROR)
   - **Location**: `app/(dashboard)/ai/policy-assistant/page.tsx`
   - **Action**: Fix to use proper route or redirect

5. **`/api/policies/policy-builder/*`** - Multiple endpoints
   - **Location**: `app/(dashboard)/policies/policy-builder/page.tsx`
   - **Action**: **KEEP** (policy-builder is separate feature, may need platform detection later)

6. **`/api/policies/[id]/suggest-tags`** - POST (internal fetch - ERROR)
   - **Location**: `app/api/sam/policies/bulk-upload/route.ts`
   - **Action**: Fix to use `/api/sam/policies/[id]/suggest-tags`

---

## ✅ **Recommendation: Option 2 (Safety Net)**

Since `/api/policies/` is actively used, we should:

1. **Lock policy-builder routes** (keep them, they're separate):
   - `/api/policies/policy-builder/*` → Keep active (separate feature)

2. **Redirect other routes to SAM**:
   - `/api/policies/delete-all` → 301 Redirect to `/api/sam/policies/delete-all`
   - `/api/policies/list` → 301 Redirect to `/api/sam/policies/list`
   - `/api/policies/search` → 301 Redirect to `/api/sam/policies/search`
   - `/api/policies/view/[id]` → 301 Redirect to `/api/sam/policies/view/[id]`
   - `/api/policies/[id]/suggest-tags` → 301 Redirect to `/api/sam/policies/[id]/suggest-tags`

3. **Fix frontend calls** (after redirects are in place):
   - Update `app/(dashboard)/policies/page.tsx` to use `/api/sam/policies/delete-all`
   - Update `app/(dashboard)/policies/policy-builder/page.tsx` to use `/api/sam/policies/list`
   - Update `app/(dashboard)/ai/policy-assistant/page.tsx` to use `/api/sam/policies/search`
   - Fix `router.push()` calls in policy-assistant page

---

## 🎯 **Next Steps**

1. **Fix internal API call** in `bulk-upload/route.ts` (immediate)
2. **Create redirect routes** for legacy endpoints (safety net)
3. **Update frontend calls** to use SAM endpoints directly
4. **Keep policy-builder routes** active (they're separate feature)
