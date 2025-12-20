# Bilingual Patient Experience Implementation Summary

## ✅ Phase 1: UI i18n (COMPLETE)

### Created Files:
- ✅ `lib/i18n/en.ts` - English translations
- ✅ `lib/i18n/ar.ts` - Arabic translations
- ✅ `lib/i18n/index.ts` - Translation function `t(key, lang)`
- ✅ `hooks/useLang.ts` - Language hook with cookie/localStorage
- ✅ `components/px/LangToggle.tsx` - Language toggle button

### Updated Files:
- ✅ `app/(dashboard)/patient-experience/page.tsx` - Made bilingual with RTL/LTR support
  - Added `useLang()` hook
  - Added `LangToggle` component
  - Updated all UI labels to use `t()` function
  - Added `dir={dir}` for RTL/LTR

## ✅ Phase 2: Canonical Keys in DB (COMPLETE)

### Updated API Routes:
- ✅ `app/api/patient-experience/data/route.ts`
  - Collections now store `{ key, label_en, label_ar, active }`
  - All GET queries use `active: true` instead of `isActive: true`
  - POST creates items with keys and bilingual labels
  - PUT updates support keys and labels
  - DELETE performs soft delete (`active: false`)

### Key Structure:
- **Floors**: `key: "FLOOR_1"`, `labelEn`, `labelAr`
- **Departments**: `key: "DEPT_NURSING"`, `labelEn`, `labelAr`
- **Rooms**: `key: "ROOM_101"`, `labelEn`, `labelAr`
- **Complaint Types**: `key: "COMPLAINT_NURSING"`, `labelEn`, `labelAr`, `categoryKey`, `typeKey`, `domainKey`
- **Nursing Types**: `key: "NURSING_DELAY"`, `labelEn`, `labelAr`, `typeKey`

### Updated Visit Submission:
- ✅ `app/(dashboard)/patient-experience/page.tsx` - `handleSubmit()`
  - Extracts keys from selected items
  - Submits `floorKey`, `departmentKey`, `roomKey`, `typeKey`, `categoryKey`, `nursingTypeKey`
  - Still includes display values for quick reference

### UI Display:
- ✅ Dropdowns show labels based on `language` state
- ✅ Uses `labelAr` when `language === 'ar'`
- ✅ Uses `labelEn` when `language === 'en'`

## ✅ Phase 3: Translate Free Text (COMPLETE)

### Updated API Route:
- ✅ `app/api/patient-experience/route.ts`
  - Accepts `detailsLang` parameter
  - Calls `translateToEnglish()` utility
  - Stores `detailsOriginal`, `detailsLang`, `detailsEn`
  - Dashboard will always display `detailsEn`

### Translation Utility:
- ✅ `lib/utils/translation.ts`
  - `translateToEnglish(text, sourceLang)` function
  - Currently uses fallback (returns original text)
  - Ready for future translation service integration

### Visit Record Structure:
```typescript
{
  // Display values
  floor: "1",
  department: "Nursing",
  room: "101",
  
  // English keys (for dashboard)
  floorKey: "FLOOR_1",
  departmentKey: "DEPT_NURSING",
  roomKey: "ROOM_101",
  typeKey: "NURSING",
  categoryKey: "COMPLAINT",
  nursingTypeKey: "DELAY",
  
  // Bilingual details
  detailsOriginal: "النص الأصلي...",
  detailsLang: "ar",
  detailsEn: "Original text...", // Translated or fallback
}
```

## 📋 Key Features

1. **Language Toggle**: Cookie/localStorage persistence, RTL/LTR switching
2. **Bilingual UI**: All labels switch based on selected language
3. **Canonical Keys**: All structured data stored with English keys
4. **Soft Delete**: Uses `active: false` instead of hard delete
5. **Translation Ready**: Free text translation infrastructure in place
6. **Dashboard Ready**: All data includes English keys and `labelEn` for consistent dashboard display

## 🎯 Dashboard Usage

When displaying Patient Experience data in dashboard:
- Use `labelEn` for all structured fields (floors, departments, rooms, types)
- Use `detailsEn` for free text fields
- Filter/group by English keys (`floorKey`, `departmentKey`, etc.)

## 📝 Notes

- Existing pages are NOT deleted (as requested)
- Backward compatibility maintained with `name` field
- All collections use `active` field (not `isActive`) for consistency
- Translation service can be integrated later by updating `translateToEnglish()`
