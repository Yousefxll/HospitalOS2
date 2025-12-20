# Bilingual Patient Experience - All Phases Complete

## ✅ Phase 1: UI i18n (COMPLETE)

### Files Created:
- ✅ `lib/i18n/en.ts` - English translations
- ✅ `lib/i18n/ar.ts` - Arabic translations
- ✅ `lib/i18n/index.ts` - Translation function `t(key, lang)`
- ✅ `hooks/use-lang.ts` - Language hook with cookie/localStorage
- ✅ `components/LanguageToggle.tsx` - Language toggle button

### Files Updated:
- ✅ `app/(dashboard)/patient-experience/page.tsx`
  - Added `useLang()` hook
  - Added `LanguageToggle` component
  - Updated all UI strings to use `t()` function
  - Added `dir={dir}` for RTL/LTR support

## ✅ Phase 2: Canonical Keys + Bilingual Labels (COMPLETE)

### API Routes Updated:
- ✅ `app/api/patient-experience/data/route.ts`
  - Collections store `{ key, label_en, label_ar, active }`
  - All queries use `active: true` (soft delete)
  - POST creates items with keys and bilingual labels
  - PUT updates support keys and labels
  - DELETE performs soft delete (`active: false`)

- ✅ `app/api/patient-experience/route.ts`
  - Accepts English keys (`floorKey`, `departmentKey`, `roomKey`, `typeKey`, `categoryKey`, `nursingTypeKey`)
  - Stores `detailsOriginal`, `detailsLang`, `detailsEn`
  - Calls `translateToEnglish()` to fill `detailsEn`

### UI Updates:
- ✅ Dropdowns display labels based on `language` state
- ✅ Visit submission extracts and sends English keys
- ✅ Display values included for quick reference

## ✅ Phase 2.5: Separate Pages (COMPLETE)

### Files Created:
- ✅ `app/(dashboard)/patient-experience/setup/page.tsx`
  - CRUD operations for floors, departments, rooms, classifications
  - Bilingual UI with language toggle
  - Lists existing items with edit/delete buttons
  - Add new items with bilingual labels

- ✅ `app/(dashboard)/patient-experience/visit/page.tsx`
  - Multi-step visit wizard (Staff → Visit → Patient → Classification → Details → Summary)
  - Bilingual UI with language toggle
  - Submits with English keys and translated details

### Navigation:
- ✅ Sidebar updated with submenu:
  - Visit Wizard (`/patient-experience/visit`)
  - Setup (`/patient-experience/setup`)

## ✅ Phase 3: Translation Fields (COMPLETE)

### Files Created:
- ✅ `lib/translate/translateToEnglish.ts`
  - Translation utility with fallback
  - Ready for future translation service integration

### Model Updated:
- ✅ `lib/models/PatientExperience.ts`
  - Added `detailsOriginal: string`
  - Added `detailsLang: 'ar' | 'en'`
  - Added `detailsEn: string`

### API Implementation:
- ✅ `app/api/patient-experience/route.ts`
  - Accepts `detailsLang` parameter
  - Calls `translateToEnglish()` on POST
  - Stores all three fields
  - Dashboard will always display `detailsEn`

## 📋 Key Features

1. **Language Toggle**: Cookie/localStorage persistence, RTL/LTR switching
2. **Bilingual UI**: All labels switch based on selected language
3. **Canonical Keys**: All structured data stored with English keys
4. **Soft Delete**: Uses `active: false` instead of hard delete
5. **Translation Ready**: Free text translation infrastructure in place
6. **Separate Pages**: Setup for CRUD, Visit for wizard
7. **Dashboard Ready**: All data includes English keys and `labelEn` for consistent dashboard display

## 🎯 Dashboard Usage

When displaying Patient Experience data in dashboard:
- Use `labelEn` for all structured fields (floors, departments, rooms, types)
- Use `detailsEn` for free text fields
- Filter/group by English keys (`floorKey`, `departmentKey`, etc.)

## 📝 Notes

- ✅ Existing pages are NOT deleted (as requested)
- ✅ Backward compatibility maintained with `name` field
- ✅ All collections use `active` field (not `isActive`) for consistency
- ✅ Translation service can be integrated later by updating `translateToEnglish()`
