# SAM Library Frontend Refactoring - Complete ✅

## ✅ Completed Tasks

### **1. LibraryTab Component Created** ✅
- ✅ Created `app/(dashboard)/sam/policies/library/page.tsx`
- ✅ Uses unified endpoints:
  - `GET /api/sam/library/list` - Single source for listing
  - `GET/PUT /api/sam/library/metadata` - Edit metadata
  - `POST /api/sam/library/bulk-action` - Bulk actions
  - `GET /api/sam/library/view-file` - View PDF

### **2. Upload Dialog (Classification-First)** ✅
- ✅ Created `components/sam/library/LibraryUploadDialog.tsx`
- ✅ **Step 1: Classification (Required)**:
  - `classificationType`: Global | DepartmentSpecific | Shared
  - `departmentIds`: Required if DepartmentSpecific or Shared (multi-select)
  - `scope`, `entityType`, `effectiveDate`, `expiryDate`, `version` (optional)
  - `tagsStatus`: Default 'approved', can toggle 'needs-review'
- ✅ **Step 2: Files**:
  - Single or multiple file select in same dialog
  - On submit: Calls `POST /api/sam/policy-engine/ingest` with files + metadata
  - After ingest: Upserts metadata via `PUT /api/sam/library/metadata` for each `policyEngineId`
  - Refreshes list on success

### **3. LibraryTab UI Features** ✅
- ✅ **Top Bar**:
  - Search input (calls list endpoint with search query)
  - Filters: departmentIds, scope, entityType, tagsStatus, expiryStatus, lifecycleStatus
  - Upload button opens new Upload dialog
- ✅ **Table**:
  - Columns: Title/filename, Department(s), Scope, EntityType, Lifecycle badge, Indexed status, Expiry date, Actions
  - Shows 'Unclassified' if metadata missing
  - Lifecycle badges: Active, ExpiringSoon (warning), Expired (warning), Archived, Superseded, Draft
  - TagsStatus badge: Shows "Review" badge if `needs-review`
- ✅ **Row Actions** (in-table dropdown, no navigation):
  - View (opens PDF via view-file proxy in new tab)
  - Edit metadata (opens dialog inline)
  - Archive / Unarchive
  - Delete (with confirmation)
- ✅ **Bulk Actions**:
  - Select multiple rows
  - Bulk: Archive, Delete, Reassign departments, Mark Global/Shared
  - All actions happen in-table, no navigation

### **4. Metadata Drawer** ✅
- ✅ Created `components/sam/library/LibraryMetadataDrawer.tsx`
- ✅ Inline dialog for editing metadata
- ✅ Fields: title, departmentIds, scope, tagsStatus, dates, version, entityType, category, source
- ✅ Saves via `PUT /api/sam/library/metadata`

### **5. Tag Review Queue Removed** ✅
- ✅ Removed from `PolicyQuickNav` navigation
- ✅ TagsStatus shown as badge/filter inside Library only
- ✅ No separate queue page

### **6. Old Upload Route Deprecated** ✅
- ✅ Marked `/api/sam/policies/upload` as deprecated with code comments
- ✅ UI never calls old upload route (uses `/api/sam/policy-engine/ingest`)

---

## 📋 Architecture Summary

### **Data Flow**
1. **Upload**: 
   - UI → Classification form → Files selection → `POST /api/sam/policy-engine/ingest` → `PUT /api/sam/library/metadata` (for each policyEngineId)
2. **List**: 
   - UI → `GET /api/sam/library/list?filters...` → Join policy-engine + MongoDB
3. **Search**: 
   - UI → `GET /api/sam/library/list?search=...` → policy-engine search + MongoDB filter
4. **View File**: 
   - UI → `GET /api/sam/library/view-file?policyEngineId=...` → policy-engine proxy
5. **Edit Metadata**: 
   - UI → `PUT /api/sam/library/metadata` → MongoDB only
6. **Bulk Actions**: 
   - UI → `POST /api/sam/library/bulk-action` → MongoDB only

### **Key Features**
- ✅ Classification-first upload (no files without classification)
- ✅ Single dialog for single + bulk upload
- ✅ All actions in-table (no navigation)
- ✅ Lifecycle status with warnings
- ✅ TagsStatus as badge/filter (no separate queue)
- ✅ Unified endpoints only (no old routes)

---

## 🎯 Deliverables - Complete ✅

- ✅ Library tab works end-to-end: upload → list → search → lifecycle badges → actions/bulk actions → view PDF
- ✅ No extra pages; everything happens inside Library tab with dialogs
- ✅ Classification required before file selection
- ✅ Tag Review Queue removed from navigation
- ✅ Old upload route deprecated

---

## 📝 Files Created/Modified

### **Created:**
- `app/(dashboard)/sam/policies/library/page.tsx` - Main Library tab
- `components/sam/library/LibraryUploadDialog.tsx` - Classification-first upload
- `components/sam/library/LibraryMetadataDrawer.tsx` - Metadata editor

### **Modified:**
- `components/policies/PolicyQuickNav.tsx` - Removed Tag Review Queue
- `app/api/sam/policies/upload/route.ts` - Marked as deprecated
- `app/api/sam/library/bulk-action/route.ts` - Added 'unarchive' action

---

## ✅ **Frontend Refactoring Complete**

All requirements met:
- ✅ Unified endpoints only
- ✅ Classification-first upload
- ✅ Single page with dialogs (no navigation)
- ✅ Tag Review Queue removed
- ✅ Old upload deprecated

**SAM Library is now a unified, coherent system!** 🎉
