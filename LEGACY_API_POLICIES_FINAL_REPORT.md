# Legacy `/api/policies/` - Final Usage Report & Recommendations

## 📊 Scan Results Summary

### ✅ **USAGE FOUND** - `/api/policies/` is actively used

---

## 🔍 **Active Usage Locations**

### **1. Frontend Pages**

#### **A. `app/(dashboard)/policies/page.tsx`**
- **Line 1077**: `DELETE /api/policies/delete-all`
  - Function: `handleDeleteAll()`
  - **Status**: ⚠️ Active usage
  - **SAM Equivalent**: ❌ **NOT FOUND** (no `/api/sam/policies/delete-all`)
  - **Action Required**: Create SAM equivalent OR keep legacy route

#### **B. `app/(dashboard)/policies/policy-builder/page.tsx`**
- **Line 200**: `GET /api/policies/list?status=READY`
  - Function: `fetchPolicies()`
  - **Status**: ⚠️ Active usage
  - **SAM Equivalent**: ✅ `/api/sam/policies/list`
  - **Action Required**: Redirect to SAM

- **Line 224**: `POST /api/policies/policy-builder/gap-analysis`
  - Function: `handleGapAnalysis()`
  - **Status**: ⚠️ Active usage
  - **Note**: Policy-builder is separate feature
  - **Action Required**: **KEEP** (separate feature, may need platform detection later)

- **Line 271**: `POST /api/policies/policy-builder/generate`
  - Function: `handleGenerate()`
  - **Status**: ⚠️ Active usage
  - **Action Required**: **KEEP** (policy-builder)

- **Line 670**: `POST /api/policies/policy-builder/validate-role`
  - Function: Role validation
  - **Status**: ⚠️ Active usage
  - **Action Required**: **KEEP** (policy-builder)

- **Line 1037**: `POST /api/policies/policy-builder/save-draft`
  - Function: Draft saving
  - **Status**: ⚠️ Active usage
  - **Action Required**: **KEEP** (policy-builder)

#### **C. `app/(dashboard)/ai/policy-assistant/page.tsx`**
- **Line 369**: `POST /api/policies/search`
  - Function: Search functionality
  - **Status**: ⚠️ Active usage
  - **SAM Equivalent**: ✅ `/api/sam/policies/search`
  - **Action Required**: Redirect to SAM

- **Lines 641, 679, 732**: `router.push(/api/policies/view/${id})`
  - **Status**: ⚠️ **ERROR** - Using `router.push()` for API endpoint
  - **SAM Equivalent**: ✅ `/api/sam/policies/view/[id]`
  - **Action Required**: Fix code (use proper URL or redirect)

---

### **2. Internal API Calls**

#### **A. `app/api/sam/policies/bulk-upload/route.ts`**
- **Line 185**: Internal fetch to `/api/policies/${policyId}/suggest-tags`
  - **Status**: ✅ **FIXED** - Now uses `/api/sam/policies/${policyId}/suggest-tags`
  - **Action**: ✅ Completed

---

### **3. Build Scripts & Tests**

#### **A. `scripts/add-dynamic-exports.py`**
- Contains legacy routes in export list
- **Status**: ℹ️ Cosmetic only (doesn't affect functionality)
- **Action Required**: Remove from script (low priority)

#### **B. `lib/core/quality/apiTests.ts`**
- Contains `/api/policies/[id]` in test list
- **Status**: ℹ️ Test code (verify if tests are active)
- **Action Required**: Update test list (if tests are active)

---

## 📋 **Endpoints Breakdown**

### **Endpoints with SAM Equivalents (Redirect Recommended):**

1. ✅ **`/api/policies/list`** → `/api/sam/policies/list`
   - **Usage**: `policy-builder/page.tsx`
   - **Action**: Redirect

2. ✅ **`/api/policies/search`** → `/api/sam/policies/search`
   - **Usage**: `policy-assistant/page.tsx`
   - **Action**: Redirect

3. ✅ **`/api/policies/view/[id]`** → `/api/sam/policies/view/[id]`
   - **Usage**: `policy-assistant/page.tsx` (ERROR - router.push)
   - **Action**: Fix code + Redirect

---

### **Endpoints without SAM Equivalents:**

1. ❌ **`/api/policies/delete-all`**
   - **Usage**: `policies/page.tsx`
   - **SAM Equivalent**: ❌ NOT FOUND
   - **Action**: Create SAM equivalent OR keep legacy route

---

### **Policy-Builder Endpoints (Keep Active):**

1. ✅ **`/api/policies/policy-builder/gap-analysis`**
2. ✅ **`/api/policies/policy-builder/generate`**
3. ✅ **`/api/policies/policy-builder/validate-role`**
4. ✅ **`/api/policies/policy-builder/save-draft`**

**Decision**: **KEEP** - These are separate feature endpoints, not platform-specific

---

## ✅ **Recommendations**

### **Option 1: Redirect Strategy (Recommended)**

1. **Lock non-policy-builder routes with 410 Gone + logging**:
   - `/api/policies/list` → 410 Gone (redirect to `/api/sam/policies/list`)
   - `/api/policies/search` → 410 Gone (redirect to `/api/sam/policies/search`)
   - `/api/policies/view/[id]` → 410 Gone (redirect to `/api/sam/policies/view/[id]`)
   - `/api/policies/delete-all` → 410 Gone (or create SAM equivalent first)

2. **Keep policy-builder routes active**:
   - `/api/policies/policy-builder/*` → Keep active (separate feature)

3. **Update frontend calls** (after redirects):
   - Update `policy-builder/page.tsx` to use `/api/sam/policies/list`
   - Update `policy-assistant/page.tsx` to use `/api/sam/policies/search`
   - Fix `router.push()` calls in policy-assistant page
   - Create `/api/sam/policies/delete-all` OR update `policies/page.tsx` to use bulk-operations

### **Option 2: Direct Migration (Alternative)**

1. **Create missing SAM equivalent**:
   - Create `/api/sam/policies/delete-all` route

2. **Update all frontend calls**:
   - Update all references to use SAM endpoints

3. **Delete legacy routes**:
   - Delete `/api/policies/*` (except policy-builder)

---

## 🎯 **Recommended Next Steps**

1. ✅ **Fix internal API call** in `bulk-upload/route.ts` - **COMPLETED**

2. **Create SAM equivalent for delete-all** (or use bulk-operations):
   - Option A: Create `/api/sam/policies/delete-all`
   - Option B: Update frontend to use `/api/sam/policies/bulk-operations` with delete action

3. **Implement redirects** (safety net):
   - Lock routes with 410 Gone + logging
   - Add redirect headers to SAM endpoints

4. **Update frontend calls**:
   - Update `policy-builder/page.tsx`
   - Update `policy-assistant/page.tsx`
   - Fix `router.push()` calls

5. **Keep policy-builder routes active**:
   - `/api/policies/policy-builder/*` → Keep as-is

---

## 📝 **Final Decision**

**Recommended**: **Option 1 (Redirect Strategy)**

- Provides safety net (logging)
- Allows gradual migration
- Keeps policy-builder routes active (they're separate feature)
- Minimal risk of breaking existing functionality
