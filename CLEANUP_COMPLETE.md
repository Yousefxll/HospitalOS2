# Cleanup Complete - Patient Experience Module

## ✅ Cleanup Tasks Completed

### 1. Unified Language Hook
- ✅ **Deleted:** `hooks/useLang.ts` (duplicate)
- ✅ **Kept:** `hooks/use-lang.ts` (canonical)
- ✅ **Updated:** All imports now use `@/hooks/use-lang`
- ✅ **Status:** All patient-experience pages already using correct import

### 2. Unified Language Toggle Component
- ✅ **Deleted:** `components/px/LanguageToggle.tsx` (duplicate, used old context)
- ✅ **Deleted:** `components/px/LangToggle.tsx` (duplicate, used old hook)
- ✅ **Kept:** `components/LanguageToggle.tsx` (canonical)
- ✅ **Updated:** All imports now use `@/components/LanguageToggle`
- ✅ **Status:** All patient-experience pages already using correct import

### 3. Canonical Keys in PX Setup Collections
All collections now have consistent structure with:
- ✅ `key` - Canonical English key (e.g., `FLOOR_1`, `DEPT_NURSING`)
- ✅ `labelEn` - English label for display
- ✅ `labelAr` - Arabic label for display
- ✅ `active` - Soft delete flag (true/false)

**Collections Updated:**
- ✅ `floors` - Has `key`, `labelEn`, `labelAr`, `active`
- ✅ `departments` - Has `key`, `labelEn`, `labelAr`, `active`
- ✅ `floor_departments` - Has `floorKey`, `departmentKey`, `labelEn`, `labelAr`, `active`
- ✅ `floor_rooms` - Has `key`, `floorKey`, `departmentKey`, `labelEn`, `labelAr`, `active`
- ✅ `complaint_types` - Has `key`, `categoryKey`, `typeKey`, `domainKey`, `labelEn`, `labelAr`, `active`
- ✅ `nursing_complaint_types` - Has `key`, `typeKey`, `labelEn`, `labelAr`, `active`

**PUT Handlers Updated:**
- ✅ Floor PUT now updates `labelEn`, `labelAr`, and regenerates `key` if number changes
- ✅ Department PUT now updates `labelEn`, `labelAr`, and maintains `floorKey`/`departmentKey`
- ✅ Room PUT now updates `labelEn`, `labelAr`, and maintains all keys
- ✅ Complaint Type PUT now updates `labelEn`, `labelAr`
- ✅ Nursing Complaint Type PUT now updates `labelEn`, `labelAr`

**Soft Delete:**
- ✅ All DELETE handlers use `active: false` instead of hard delete
- ✅ All GET queries filter by `active: true`
- ✅ All existence checks filter by `active: true`

### 4. PX Visit Stores Only Keys
- ✅ Visit route (`/api/patient-experience/route.ts`) stores:
  - **Keys:** `floorKey`, `departmentKey`, `roomKey`, `typeKey`, `categoryKey`, `nursingTypeKey`, `statusKey`
  - **Display values:** `floor`, `department`, `room` (kept for backward compatibility/quick reference)
  - **Translation fields:** `detailsOriginal`, `detailsLang`, `detailsEn`
- ✅ Dashboard should always use:
  - **Structured fields:** `labelEn` from lookup collections (floors, departments, rooms, types)
  - **Free text:** `detailsEn` from visit record
  - **Keys:** For filtering/grouping (e.g., `floorKey`, `departmentKey`)

## 📋 Dashboard Display Guidelines

When displaying Patient Experience data in dashboard:

```typescript
// For structured fields - use labelEn from lookup
const floor = await floorsCollection.findOne({ key: visit.floorKey, active: true });
const floorLabel = floor?.labelEn || visit.floor;

const department = await departmentsCollection.findOne({ key: visit.departmentKey, active: true });
const departmentLabel = department?.labelEn || visit.department;

// For free text - use detailsEn
const details = visit.detailsEn; // Always English for dashboard

// For filtering/grouping - use keys
const visitsByFloor = visits.filter(v => v.floorKey === 'FLOOR_1');
```

## 🔑 Key Structure

- **Floors:** `FLOOR_{number}` (e.g., `FLOOR_1`, `FLOOR_2`)
- **Departments:** `DEPT_{name}` (e.g., `DEPT_NURSING`, `DEPT_CARDIOLOGY`)
- **Rooms:** `ROOM_{number}` (e.g., `ROOM_101`, `ROOM_202`)
- **Complaint Types:** `{CATEGORY}_{TYPE}` (e.g., `COMPLAINT_NURSING`, `PRAISE_MAINTENANCE`)
- **Nursing Types:** `NURSING_{TYPE}` (e.g., `NURSING_DELAY`, `NURSING_CALL_BELL`)

## 📝 Notes

- All existing data remains compatible (display values kept for backward compatibility)
- New records always include both keys and labels
- Soft delete ensures data integrity and allows recovery
- Dashboard queries should always join with lookup collections to get `labelEn`
