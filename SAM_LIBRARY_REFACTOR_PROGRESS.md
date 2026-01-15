# SAM Library Refactor - Progress Report

## ✅ Completed Tasks

### 1. Unified IDs System ✅
- ✅ Added `policyEngineId` field to `PolicyDocument` model (`lib/models/Policy.ts`)
- ✅ Updated `/api/sam/policy-engine/ingest` to store `policyEngineId` when creating/updating MongoDB documents
- ✅ Policy-engine is now the source of truth for files/OCR/chunks/indexing
- ✅ MongoDB stores only governance metadata linked via `policyEngineId`

### 2. New Library Endpoints ✅
- ✅ `/api/sam/library/list` - Joins policy-engine policies with MongoDB metadata
  - Supports filters: departmentIds, scope, tagsStatus, expiryStatus
  - Supports search query (calls policy-engine `/v1/search`)
  - Computes lifecycleStatus: Draft, Active, ExpiringSoon, Expired, Archived, Superseded
  - Returns unified items with policyEngineId + metadata
  
- ✅ `/api/sam/library/metadata` (GET/PUT)
  - GET: Retrieve metadata for a single item
  - PUT: Update metadata (title, departmentIds, scope, tagsStatus, dates, etc.)
  
- ✅ `/api/sam/library/bulk-action` (POST)
  - Actions: delete, archive, reassign-departments, mark-global, mark-shared
  - Operates on multiple policyEngineIds
  
- ✅ `/api/sam/library/view-file` (GET)
  - Proxies to policy-engine `/v1/policies/{id}/file` to serve PDF

### 3. Ingest Route Updates ✅
- ✅ Updated to store `policyEngineId` when creating new documents
- ✅ Updates existing documents to set `policyEngineId` if missing
- ✅ Maintains backward compatibility with legacy `id` field

---

## 🚧 Remaining Tasks

### 4. Upload Flow Refactor (In Progress)
**Current State**: `/api/sam/policy-engine/ingest` accepts classification metadata but UI doesn't enforce it.

**Required Changes**:
- Update upload dialog/component to require classification BEFORE file selection:
  - `classificationType`: Global | DepartmentSpecific | Shared
  - `departmentIds` (multi-select) if DepartmentSpecific or Shared
  - `scope`, `setting`, `policyType` (optional)
  - `effectiveDate`, `expiryDate`, `version` (optional)
- Support Single Upload and Bulk Upload in same dialog
- Call `/api/sam/policy-engine/ingest` with files + classification
- Upsert MongoDB metadata for each returned `policyId`

**Files to Update**:
- Upload component (likely in `components/policies/IntelligentUploadStepper.tsx` or similar)
- Or create new unified upload dialog

### 5. LibraryTab Refactor (Pending)
**Current State**: `app/(dashboard)/policies/page.tsx` exists but needs refactoring.

**Required Changes**:
- Create/update `app/platforms/sam/tabs/LibraryTab.tsx` (or refactor existing page)
- Update data contract to use `/api/sam/library/list`:
  - Expect `{ items: [{ policyEngineId, filename, status, indexedAt, progress, metadata: {...} }] }`
  - Remove old expectation of `data.policies`
- Implement filters:
  - DepartmentIds (multi-select)
  - Scope (department/shared/enterprise)
  - TagsStatus (auto-approved/needs-review/approved)
  - ExpiryStatus (expired/expiringSoon/valid)
  - Search query (calls policy-engine search)
- Show lifecycleStatus with warnings:
  - Draft (if not approved)
  - Active
  - ExpiringSoon (<=30 days) - show warning
  - Expired - show warning
  - Archived
  - Superseded
- Implement actions (Action Layer inside Library):
  - Row actions: View (open PDF), Edit metadata, Delete, Archive, Supersede
  - Bulk actions: Delete selected, Archive selected, Reassign departments, Mark as Global/Shared
- Remove navigation to separate pages for actions (keep everything in table)

### 6. Remove Tag Review Queue (Pending)
**Required Changes**:
- Remove Tag Review Queue tab/concept from SAM UI
- If `tagsStatus === 'needs-review'`, show as badge/filter inside Library only
- No separate queue page

### 7. Deprecate Old Upload Route (Pending)
**Current State**: `/api/sam/policies/upload` does duplicate ingestion (PDF extraction, chunking).

**Required Changes**:
- Mark `/api/sam/policies/upload` as deprecated
- Add warning log: `[DEPRECATED] Use /api/sam/policy-engine/ingest instead`
- Eventually remove or lock with 404

---

## 📋 Architecture Summary

### Data Flow
1. **Upload**: UI → `/api/sam/policy-engine/ingest` → policy-engine (files/OCR/chunks) + MongoDB (metadata)
2. **List**: UI → `/api/sam/library/list` → Join policy-engine policies + MongoDB metadata
3. **Search**: UI → `/api/sam/library/list?search=...` → policy-engine `/v1/search` + MongoDB filter
4. **View File**: UI → `/api/sam/library/view-file?policyEngineId=...` → policy-engine `/v1/policies/{id}/file`
5. **Update Metadata**: UI → `/api/sam/library/metadata` (PUT) → MongoDB only
6. **Bulk Actions**: UI → `/api/sam/library/bulk-action` → MongoDB only

### Key Principles
- ✅ Policy-engine = Source of truth for files/OCR/chunks/indexing
- ✅ MongoDB = Governance metadata only (classification, departments, scope, lifecycle, owners, approvals, expiry)
- ✅ Unified IDs: `policyEngineId` links both systems
- ✅ No duplicate ingestion logic

---

## 🎯 Next Steps

1. **Refactor Upload Component**: Add classification form BEFORE file selection
2. **Create/Update LibraryTab**: Use new endpoints, implement filters, lifecycle, actions
3. **Remove Tag Review Queue**: Delete tab, show as badge in Library
4. **Deprecate Old Upload**: Mark `/api/sam/policies/upload` as deprecated

---

## 📝 Notes

- All new endpoints use `withAuthTenant` with `platformKey: 'sam'`
- Tenant isolation enforced via `getTenantCollection(req, 'policy_documents', 'sam')`
- Lifecycle status computed from MongoDB metadata (expiryDate, archivedAt, status, approvedAt)
- Search uses policy-engine for content search, MongoDB for metadata filtering
