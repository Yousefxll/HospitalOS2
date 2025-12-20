# Bilingual Patient Experience Implementation Notes

## Overview
This document outlines the bilingual (Arabic/English) implementation for the Patient Experience module.

## Key Components Created

### 1. Language Context (`contexts/LanguageContext.tsx`)
- Provides language state management (AR/EN)
- Handles RTL/LTR direction switching
- Persists language preference in localStorage

### 2. i18n Dictionary (`lib/i18n/px-i18n.ts`)
- Contains all UI strings in both Arabic and English
- Organized by sections (common, setup, visit)

### 3. Language Toggle Component (`components/px/LanguageToggle.tsx`)
- Simple button to switch between AR/EN

### 4. Translation Utility (`lib/utils/translation.ts`)
- `translateToEnglish()` function with fallback
- Ready for future translation service integration

## Updated Models

### Floor, FloorDepartment, FloorRoom
- Added `labelEn`, `labelAr` for bilingual display
- Added `floorKey`, `departmentKey`, `roomKey` for English keys

### ComplaintType, NursingComplaintType
- Added `labelEn`, `labelAr`
- Added `categoryKey`, `typeKey` for English keys

### PatientExperience
- Added English keys: `floorKey`, `departmentKey`, `roomKey`, `typeKey`, `categoryKey`, `nursingTypeKey`, `statusKey`
- Added bilingual details:
  - `detailsOriginal`: Original text as entered
  - `detailsLang`: Language of original ('ar' | 'en')
  - `detailsEn`: English translation (for dashboard)

## API Updates

### `/api/patient-experience/route.ts`
- Accepts bilingual fields and English keys
- Translates details to English using `translateToEnglish()`
- Stores both original and translated text

### `/api/patient-experience/data/route.ts`
- Generates English keys automatically
- Stores `labelEn` and `labelAr` for all config items
- Helper function `generateKey()` creates consistent keys

## Next Steps

1. **Refactor Current Page to Setup Page**
   - Move "add-data" step to `/patient-experience/setup/page.tsx`
   - Integrate LanguageProvider and i18n
   - Use bilingual labels in UI

2. **Create Visit Wizard Page**
   - Create `/patient-experience/visit/page.tsx`
   - Multi-step form with bilingual support
   - Submit with English keys and translated details

3. **Update Sidebar Navigation**
   - Add links to Setup and Visit pages
   - Keep existing page for backward compatibility

4. **Dashboard Integration**
   - Ensure dashboard always uses `labelEn` and English keys
   - Display `detailsEn` for free text fields

## Usage Example

```tsx
// In any component
import { useLanguage } from '@/contexts/LanguageContext';
import { usePXTranslation } from '@/lib/i18n/px-i18n';

function MyComponent() {
  const { language, dir } = useLanguage();
  const t = usePXTranslation();
  
  return (
    <div dir={dir}>
      <h1>{t('setup.title')}</h1>
      <LanguageToggle />
    </div>
  );
}
```

## Key Principles

1. **UI Display**: Shows labels based on selected language (`labelAr` or `labelEn`)
2. **Data Storage**: Always stores English keys and `labelEn` for dashboard consistency
3. **Free Text**: Stores original + language + English translation
4. **Dashboard**: Always displays English labels using `labelEn`
