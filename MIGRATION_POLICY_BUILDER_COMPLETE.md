# Policy-Builder Routes Migration - Complete ✅

## 🎯 الهدف
نقل `app/api/policies/policy-builder/*` إلى `app/api/sam/policies/policy-builder/*` وتحديثها لاستخدام `getTenantCollection`.

---

## ✅ التغييرات المنفذة

### **1. Delete-All Safety (Idempotent)**

**Updated**: `app/api/sam/policies/delete-all/route.ts`
- ✅ Filesystem delete is now idempotent
- ✅ Missing files log warning but don't throw
- ✅ Continue execution even if file is already deleted

---

### **2. Platform Key Resolution (Pathname-Based)**

**Updated**: `lib/db/platformKey.ts`
- ✅ Added pathname-based platform resolution as fallback
- ✅ Pattern: `/api/sam/*` => `'sam'`
- ✅ Pattern: `/api/syra_health/*` or `/api/health/*` => `'syra_health'`
- ✅ Pattern: `/api/cvision/*` => `'cvision'`
- ✅ Pattern: `/api/edrac/*` => `'edrac'`
- ✅ Resolution order: Cookie → Header → Pathname

---

### **3. Policy-Builder Routes Migration**

#### **Created Routes (SAM):**
1. ✅ `app/api/sam/policies/policy-builder/gap-analysis/route.ts`
2. ✅ `app/api/sam/policies/policy-builder/generate/route.ts`
3. ✅ `app/api/sam/policies/policy-builder/validate-role/route.ts`
4. ✅ `app/api/sam/policies/policy-builder/save-draft/route.ts`

#### **Updated Routes:**
- ✅ All routes use `getTenantCollection(req, baseName, 'sam')`
- ✅ `policy_documents` → `sam_policy_documents`
- ✅ `policy_chunks` → `sam_policy_chunks`
- ✅ `policy_builder_drafts` → `sam_policy_builder_drafts`
- ✅ All queries include explicit `tenantId: tenantId`
- ✅ Removed `createTenantQuery` usage

#### **Frontend Updates:**
- ✅ `app/(dashboard)/policies/policy-builder/page.tsx`:
  - `/api/policies/policy-builder/gap-analysis` → `/api/sam/policies/policy-builder/gap-analysis`
  - `/api/policies/policy-builder/generate` → `/api/sam/policies/policy-builder/generate`
  - `/api/policies/policy-builder/validate-role` → `/api/sam/policies/policy-builder/validate-role`
  - `/api/policies/policy-builder/save-draft` → `/api/sam/policies/policy-builder/save-draft`

#### **Deleted Routes (Legacy):**
1. ✅ `app/api/policies/policy-builder/gap-analysis/route.ts`
2. ✅ `app/api/policies/policy-builder/generate/route.ts`
3. ✅ `app/api/policies/policy-builder/validate-role/route.ts`
4. ✅ `app/api/policies/policy-builder/save-draft/route.ts`

---

### **4. Lock /api/policies/* Completely**

**Updated**: `app/api/policies/route.ts`
- ✅ Updated documentation to reflect all routes are legacy
- ✅ Guard now catches ALL `/api/policies/*` requests
- ✅ Returns 404 with message: "This route has been moved. Use /api/sam/policies/* instead."
- ✅ Logs: `[LEGACY_POLICIES_ROUTE_CALLED]` for monitoring

---

## 📋 Verification Checklist

### ✅ **Policy-Builder Routes**
- ✅ All routes migrated to `/api/sam/policies/policy-builder/*`
- ✅ All routes use `getTenantCollection(req, baseName, 'sam')`
- ✅ All legacy routes deleted
- ✅ Frontend updated to use SAM routes

### ✅ **Platform Key Resolution**
- ✅ Pathname-based resolution added
- ✅ Cookie/Header resolution still works (priority)
- ✅ Pathname fallback works for `/api/sam/*`

### ✅ **Data Isolation**
- ✅ All routes write to `syra_tenant__<id>.sam_*` collections
- ✅ No writes to `hospital_ops` or other legacy databases
- ✅ Hard Guard active

---

## 🎯 **Acceptance Criteria - Met ✅**

- ✅ Policy-builder routes migrated to SAM
- ✅ All routes use `getTenantCollection` with `platformKey: 'sam'`
- ✅ Platform key resolution robust (cookie/header/pathname)
- ✅ `/api/policies/*` completely locked (404 + log)
- ✅ Frontend updated to use SAM routes
- ✅ Delete-all is idempotent

---

## ✅ **Migration Complete**

All policy-builder routes have been:
- ✅ Migrated to `/api/sam/policies/policy-builder/*`
- ✅ Updated to use `getTenantCollection`
- ✅ Frontend updated
- ✅ Legacy routes deleted
- ✅ `/api/policies/*` completely locked

**SAM is now the ONLY source of truth for ALL policy routes!** 🎉
