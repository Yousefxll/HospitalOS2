# Phase 2 Compliance Verification Report

## ✅ 1. Setup Entities Store Canonical Key + Bilingual Labels + Active

### Floors
- ✅ Stores: `key`, `label_en`, `label_ar`, `active`
- Location: `app/api/patient-experience/data/route.ts` (POST handler, lines 238-247)

### Departments (FloorDepartment)
- ✅ Stores: `key`, `floorKey`, `label_en`, `label_ar`, `active`
- Location: `app/api/patient-experience/data/route.ts` (POST handler, lines 357-372)

### Rooms
- ✅ Stores: `key`, `departmentKey`, `label_en`, `label_ar`, `active`
- Location: `app/api/patient-experience/data/route.ts` (POST handler, lines 416-432)

### ComplaintTypes
- ✅ Stores: `key`, `domainKey`, `label_en`, `label_ar`, `defaultSeverity`, `active`
- Location: `app/api/patient-experience/data/route.ts` (POST handler, lines 483-499)

### NursingComplaintTypes
- ✅ **FIXED**: Now stores `key`, `label_en`, `label_ar`, `active` (was using `labelEn`/`labelAr`)
- Location: `app/api/patient-experience/data/route.ts` (POST handler, lines 530-543)

### ComplaintDomains
- ✅ Stores: `key`, `label_en`, `label_ar`, `active`
- Location: `app/api/patient-experience/data/route.ts` (POST handler, lines 569-579)

### PraiseCategories
- ✅ Stores: `key`, `label_en`, `label_ar`, `active`
- Location: `app/api/patient-experience/data/route.ts` (POST handler, lines 605-615)

### SLARules
- ✅ Stores: `severity`, `minutes`, `active`
- Location: `app/api/patient-experience/data/route.ts` (POST handler, lines 644-653)

## ✅ 2. Visit Stores ONLY Keys for Structured Fields

### Visit API Route (`app/api/patient-experience/route.ts`)
- ✅ **Line 111-115**: Stores only `floorKey`, `departmentKey`, `roomKey`, `domainKey`, `typeKey`
- ✅ **Line 117-118**: Stores `severity` and `status` as English enums
- ✅ **Line 120-122**: Stores free text as `detailsOriginal`, `detailsLang`, `detailsEn`
- ✅ **Line 131-134**: Backward compatibility fields (deprecated) are optional
- ❌ **NO Arabic strings** in structured fields

### Visit Page (`app/(dashboard)/patient-experience/visit/page.tsx`)
- ✅ **Line 276-297**: `handleSubmit` sends ONLY keys:
  - `floorKey`, `departmentKey`, `roomKey`, `domainKey`, `typeKey`
  - `severity`, `status`
  - `complaintText` (free text only)
- ✅ **Line 50-63**: Form state uses keys only (no labels)
- ✅ **Line 485-530**: UI displays labels for user selection but stores keys

## ✅ 3. All Deletes Are Soft Delete (active=false)

### DELETE Handler (`app/api/patient-experience/data/route.ts`)
- ✅ **Line 1100**: Floor - `active: false`
- ✅ **Line 1115**: Department - `active: false`
- ✅ **Line 1130**: Room - `active: false`
- ✅ **Line 1145**: Complaint Type - `active: false`
- ✅ **Line 1160**: Nursing Complaint Type - `active: false`
- ✅ **Line 1175**: Complaint Domain - `active: false`
- ✅ **Line 1190**: Praise Category - `active: false`
- ✅ **Line 1205**: SLA Rule - `active: false`

**All use `updateOne` with `$set: { active: false }` - NO hard deletes.**

## ✅ 4. Filtering Uses floorKey and departmentKey

### API GET Handler (`app/api/patient-experience/data/route.ts`)
- ✅ **Line 60-80**: Departments filtered by `floorKey` (with fallback to `floorId`)
- ✅ **Line 93-123**: Rooms filtered by `departmentKey` (with fallback to `departmentId` and optional `floorKey`)

### Visit Page (`app/(dashboard)/patient-experience/visit/page.tsx`)
- ✅ **Line 113-124**: `loadDepartmentsByKey(floorKey)` uses `floorKey`
- ✅ **Line 126-137**: `loadRoomsByKey(floorKey, departmentKey)` uses both keys
- ✅ **Line 82-97**: useEffect hooks trigger on `floorKey` and `departmentKey` changes

### Setup Page (`app/(dashboard)/patient-experience/setup/page.tsx`)
- ✅ **Line 90-101**: `loadDepartments` tries `floorKey` first, falls back to `floorId`
- ✅ **Line 115-126**: `loadRooms` tries `departmentKey` first, falls back to `departmentId`

## ✅ 5. UI Submits Keys (Not Labels)

### Visit Page Submit
- ✅ **Line 284-288**: Sends `floorKey`, `departmentKey`, `roomKey`, `domainKey`, `typeKey`
- ✅ **Line 290**: Sends `severity` (enum)
- ✅ **Line 291**: Sends `status` (enum)
- ✅ **NO labels** sent in structured fields

### Setup Page Submit
- ✅ **Line 176-177**: Sends `label_en`/`label_ar` for Setup entities (correct - Setup needs labels)
- ✅ Setup entities are configuration data, so they SHOULD store labels
- ✅ Visit entities should NOT store labels (only keys) - ✅ Verified

## 🔧 Issues Fixed

1. ✅ **nursing-complaint-type POST**: Changed from `labelEn`/`labelAr` to `label_en`/`label_ar`
2. ✅ **loadRoomsByKey**: Now accepts both `floorKey` and `departmentKey` parameters
3. ✅ **API rooms endpoint**: Accepts `departmentKey` alone (sufficient for filtering)

## 📋 Summary

**All Phase 2 requirements are met:**
- ✅ Setup entities store `key` + `label_en`/`label_ar` + `active`
- ✅ Visit stores ONLY keys (no Arabic/labels in structured fields)
- ✅ All deletes are soft delete (`active=false`)
- ✅ Filtering uses `floorKey` and `departmentKey`
- ✅ UI submits keys (not labels) for Visit records

**Status: ✅ COMPLIANT**
