# Bilingual Patient Experience Implementation Summary

## ✅ Completed Components

### 1. Core Infrastructure
- ✅ **Language Context** (`contexts/LanguageContext.tsx`)
  - Language state management (AR/EN)
  - RTL/LTR direction handling
  - localStorage persistence

- ✅ **i18n Dictionary** (`lib/i18n/px-i18n.ts`)
  - Complete UI strings in Arabic and English
  - Organized by sections (common, setup, visit)

- ✅ **Language Toggle Component** (`components/px/LanguageToggle.tsx`)
  - Simple button to switch languages

- ✅ **Translation Utility** (`lib/utils/translation.ts`)
  - `translateToEnglish()` function with fallback
  - Ready for future translation service integration

### 2. Updated Models
- ✅ **Floor.ts** - Added `labelEn`, `labelAr`, `floorKey`
- ✅ **FloorDepartment.ts** - Added bilingual labels and keys
- ✅ **FloorRoom.ts** - Added bilingual labels and keys
- ✅ **ComplaintType.ts** - Added `labelEn`, `labelAr`, `categoryKey`, `typeKey`
- ✅ **NursingComplaintType.ts** - Added bilingual labels and keys
- ✅ **PatientExperience.ts** - Complete bilingual support with:
  - English keys for all structured fields
  - `detailsOriginal`, `detailsLang`, `detailsEn` for free text

### 3. API Routes Updated
- ✅ **`/api/patient-experience/route.ts`**
  - Accepts bilingual fields and English keys
  - Translates details to English
  - Stores both original and translated text

- ✅ **`/api/patient-experience/data/route.ts`**
  - Generates English keys automatically
  - Stores `labelEn` and `labelAr` for all config items
  - Helper function `generateKey()` for consistent keys

### 4. Navigation Updated
- ✅ **Sidebar** - Added submenu for Patient Experience:
  - Visit Wizard (`/patient-experience/visit`)
  - Setup (`/patient-experience/setup`)

## 📋 Remaining Tasks

### 1. Refactor Current Page to Setup Page
**File**: `app/(dashboard)/patient-experience/setup/page.tsx`

**Requirements**:
- Extract "add-data" functionality from current page
- Wrap with `LanguageProvider`
- Use `useLanguage()` and `getPXTranslation()`
- Display labels based on selected language
- Submit with `labelEn` and `labelAr` fields

**Key Changes**:
```tsx
import { LanguageProvider } from '@/contexts/LanguageContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getPXTranslation } from '@/lib/i18n/px-i18n';
import { LanguageToggle } from '@/components/px/LanguageToggle';

// In component:
const { language, dir } = useLanguage();
const t = getPXTranslation(language);

// Use t('setup.title'), t('setup.floor'), etc.
// Submit with labelEn and labelAr
```

### 2. Create Visit Wizard Page
**File**: `app/(dashboard)/patient-experience/visit/page.tsx`

**Requirements**:
- Multi-step form (Staff → Visit → Patient → Classification → Details → Summary)
- Bilingual UI with language toggle
- Display labels based on selected language
- Submit with:
  - English keys (`floorKey`, `departmentKey`, `roomKey`, `typeKey`, etc.)
  - `detailsOriginal`, `detailsLang`, `detailsEn`
  - Display values for quick reference

**Key Implementation**:
```tsx
// Load data with bilingual labels
const floors = await fetch('/api/patient-experience/data?type=floors');
// Display: language === 'ar' ? floor.labelAr : floor.labelEn
// Submit: floorKey, labelEn

// For free text
const detailsEn = await translateToEnglish(detailsOriginal, detailsLang);
// Submit: { detailsOriginal, detailsLang, detailsEn }
```

### 3. Update Dashboard Display
**File**: Any dashboard component displaying Patient Experience data

**Requirements**:
- Always use `labelEn` for structured fields
- Always use `detailsEn` for free text
- Use English keys for filtering/grouping

**Example**:
```tsx
// Display
<div>{record.floorKey} - {record.labelEn}</div>
<div>{record.detailsEn}</div>

// Filter
query.floorKey = 'FLOOR_1';
```

## 🔑 Key Principles

1. **UI Display**: Shows `labelAr` or `labelEn` based on `language` state
2. **Data Storage**: Always stores English keys and `labelEn` for dashboard
3. **Free Text**: Stores original + language + English translation
4. **Dashboard**: Always displays `labelEn` and `detailsEn`

## 📝 Usage Examples

### In Setup Page
```tsx
'use client';
import { LanguageProvider, useLanguage } from '@/contexts/LanguageContext';
import { getPXTranslation } from '@/lib/i18n/px-i18n';
import { LanguageToggle } from '@/components/px/LanguageToggle';

function SetupContent() {
  const { language, dir } = useLanguage();
  const t = getPXTranslation(language);
  
  return (
    <div dir={dir}>
      <div className="flex justify-between">
        <h1>{t('setup.title')}</h1>
        <LanguageToggle />
      </div>
      {/* Rest of setup UI */}
    </div>
  );
}

export default function SetupPage() {
  return (
    <LanguageProvider>
      <SetupContent />
    </LanguageProvider>
  );
}
```

### In Visit Wizard
```tsx
// When submitting
const payload = {
  // Display values (for quick reference)
  floor: selectedFloor.number,
  department: selectedDept.departmentName,
  room: selectedRoom.roomNumber,
  
  // English keys (for dashboard)
  floorKey: selectedFloor.floorKey,
  departmentKey: selectedDept.departmentKey,
  roomKey: selectedRoom.roomKey,
  typeKey: selectedType.typeKey,
  categoryKey: selectedCategory === 'praise' ? 'PRAISE' : 'COMPLAINT',
  
  // Bilingual details
  detailsOriginal: complaintText,
  detailsLang: language,
  detailsEn: await translateToEnglish(complaintText, language),
};
```

## 🚀 Next Steps

1. Create `app/(dashboard)/patient-experience/setup/page.tsx` with bilingual support
2. Create `app/(dashboard)/patient-experience/visit/page.tsx` with bilingual support
3. Test language switching and RTL/LTR
4. Verify API stores English keys and translations
5. Update dashboard to use `labelEn` and `detailsEn`

## 📚 Files Created/Modified

### Created:
- `contexts/LanguageContext.tsx`
- `lib/i18n/px-i18n.ts`
- `components/px/LanguageToggle.tsx`
- `lib/utils/translation.ts`
- `IMPLEMENTATION_NOTES.md`
- `BILINGUAL_IMPLEMENTATION_SUMMARY.md`

### Modified:
- `lib/models/Floor.ts`
- `lib/models/ComplaintType.ts`
- `lib/models/PatientExperience.ts`
- `app/api/patient-experience/route.ts`
- `app/api/patient-experience/data/route.ts`
- `components/Sidebar.tsx`
