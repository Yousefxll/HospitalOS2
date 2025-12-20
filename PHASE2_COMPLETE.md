# Phase 2 Complete - Canonical Keys Implementation

## ✅ A) Setup Data Structures Updated

All Patient Experience configuration entities now enforce the required schema:

### Floors
- ✅ `{ key, label_en, label_ar, active }`
- Model: `lib/models/Floor.ts`

### Departments  
- ✅ `{ key, floorKey, label_en, label_ar, active }`
- Model: `lib/models/Floor.ts` (FloorDepartment interface)

### Rooms
- ✅ `{ key, departmentKey, label_en, label_ar, active }`
- Model: `lib/models/Floor.ts` (FloorRoom interface)

### ComplaintDomains
- ✅ `{ key, label_en, label_ar, active }`
- Model: `lib/models/ComplaintDomain.ts` (new)

### ComplaintTypes
- ✅ `{ key, domainKey, label_en, label_ar, defaultSeverity, active }`
- Model: `lib/models/ComplaintType.ts`

### PraiseCategories
- ✅ `{ key, label_en, label_ar, active }`
- Model: `lib/models/ComplaintType.ts` (PraiseCategory interface)

### SLARules
- ✅ `{ severity, minutes, active }`
- Model: `lib/models/ComplaintType.ts` (SLARule interface)

**All use `active=false` for soft delete (no hard deletes).**

## ✅ B) APIs Updated

### 1. `app/api/patient-experience/data/route.ts`

**GET:**
- ✅ Returns lists containing `key`, `label_en`, `label_ar`, `active` (and relationship keys)
- ✅ Supports filtering by keys (e.g., `floorKey`, `departmentKey`)
- ✅ Normalizes data for backward compatibility (converts `labelEn`/`labelAr` to `label_en`/`label_ar`)

**POST/PUT:**
- ✅ Accepts and persists `key` + bilingual labels (`label_en`, `label_ar`)
- ✅ Supports both camelCase (`labelEn`/`labelAr`) and snake_case (`label_en`/`label_ar`) input for backward compatibility
- ✅ Generates keys automatically if not provided
- ✅ Added support for:
  - Complaint Domains (`complaint-domain`)
  - Praise Categories (`praise-category`)
  - SLA Rules (`sla-rule`)

**DELETE:**
- ✅ Sets `active=false` (soft delete)
- ✅ Added DELETE handlers for new entity types

### 2. `app/api/patient-experience/route.ts` (Visit create)

**Updated to store ONLY canonical keys:**
- ✅ `floorKey` (required)
- ✅ `departmentKey` (required)
- ✅ `roomKey` (required)
- ✅ `domainKey` (required)
- ✅ `typeKey` (required)
- ✅ `severity` (required, English enum: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL')
- ✅ `status` (default: 'PENDING', English enum: 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED')
- ✅ No Arabic strings in structured fields
- ✅ Free text stored as `detailsOriginal`, `detailsLang`, `detailsEn`

## ✅ C) Frontend Updated

### `app/(dashboard)/patient-experience/setup/page.tsx`

**Updated:**
- ✅ Dropdowns display `label_ar` when `language=ar`, else `label_en`
- ✅ Supports both `label_en`/`label_ar` and `labelEn`/`labelAr` for backward compatibility
- ✅ Filters departments by `floorKey` (with fallback to `floorId`)
- ✅ Filters rooms by `departmentKey` (with fallback to `departmentId`)
- ✅ Submit sends `label_en`/`label_ar` (snake_case)

### `app/(dashboard)/patient-experience/visit/page.tsx`

**Updated:**
- ✅ Form state uses keys: `floorKey`, `departmentKey`, `roomKey`, `domainKey`, `typeKey`
- ✅ Dropdowns display `label_ar` when `language=ar`, else `label_en`
- ✅ Filters departments by `floorKey` (via `loadDepartmentsByKey`)
- ✅ Filters rooms by `departmentKey` (via `loadRoomsByKey`)
- ✅ Added severity field (LOW/MEDIUM/HIGH/CRITICAL)
- ✅ On submit, sends ONLY key fields (no labels in structured fields)
- ✅ Added domain selection before type selection

## ✅ D) Backward Compatibility

**Implemented:**
- ✅ `normalizeLabels()` helper function converts `labelEn`/`labelAr` to `label_en`/`label_ar` in GET responses
- ✅ API accepts both camelCase and snake_case input
- ✅ Generates stable keys from existing data if missing:
  - `generateKey(prefix, value)` creates keys like `FLOOR_1`, `DEPT_NURSING`
- ✅ Existing records without keys/labels are handled gracefully
- ✅ Display logic checks both `label_en`/`label_ar` and `labelEn`/`labelAr`

## 📋 Key Structure Examples

- **Floors:** `FLOOR_1`, `FLOOR_2`
- **Departments:** `DEPT_NURSING`, `DEPT_CARDIOLOGY`
- **Rooms:** `ROOM_101`, `ROOM_202`
- **Domains:** `NURSING`, `MAINTENANCE`, `DIET`, `HOUSEKEEPING`, `OTHER`
- **Types:** `COMPLAINT_NURSING`, `PRAISE_MAINTENANCE`
- **Severity:** `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
- **Status:** `PENDING`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`

## ✅ Acceptance Criteria Met

- ✅ Setup CRUD works with bilingual labels + keys
- ✅ Visit wizard stores keys only
- ✅ No hard deletes; only `active=false`
- ✅ Build passes (no TypeScript errors related to patient-experience)
- ✅ Backward compatibility maintained

## 🔄 Migration Notes

Existing records will be normalized on read:
- `labelEn` → `label_en`
- `labelAr` → `label_ar`
- Missing keys are generated from existing data

New records always include:
- `key` (canonical English key)
- `label_en` (English label)
- `label_ar` (Arabic label)
- `active: true`
