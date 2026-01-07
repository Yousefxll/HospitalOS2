# Phase 1 — Identity & Naming: COMPLETE ✅

## Summary

Phase 1 successfully transforms the application identity from "HospitalOS/SYRA" to "SAM" (Standalone Policy Platform) through a centralized configuration system. All hardcoded references have been replaced with config-driven values that can be controlled via environment variables.

## What Was Done

### 1. Created Central Configuration System
- **New File**: `lib/config.ts`
  - Centralized app identity configuration
  - Supports environment variables: `APP_NAME`, `APP_CODE`, `APP_TYPE`
  - Defaults: `APP_NAME="SAM"`, `APP_CODE="sam"`, `APP_TYPE="policy_platform"`
  - Provides computed properties: `title`, `description`

### 2. Updated Package Identity
- **Modified**: `package.json`
  - Changed package name from `"syra"` to `"sam"`

### 3. Updated Application Metadata
- **Modified**: `app/layout.tsx`
  - Metadata title and description now use `appConfig.title` and `appConfig.description`
  - Page title: "SAM — Enterprise Policy & Procedure Platform"

### 4. Updated Internationalization
- **Modified**: `lib/i18n.ts`
  - English and Arabic header translations now use `appConfig.name`
  - Both languages display "SAM" as the app name
  - Translation key `header.hospitalOS` remains (for backward compatibility) but values are now config-driven

### 5. Updated Security Configuration
- **Modified**: `lib/security/config.ts`
  - TOTP issuer now uses `appConfig.name` instead of hardcoded "HospitalOS"
  - Default: "SAM" (can be overridden via `MFA_TOTP_ISSUER` env var)

### 6. Updated UI Components
- **Modified**: `components/Header.tsx`
  - Uses translation system (already config-driven via i18n)
  
- **Modified**: `components/shell/MobileShell.tsx`
  - Fallback values now use `appConfig.name`
  - Imported config module

- **Modified**: `components/SplashScreen.tsx`
  - Title now displays `appConfig.name` dynamically
  - Comment reference to "SYRA" remains (documentation only)

### 7. Updated Session Storage
- **Modified**: `app/login/page.tsx`
  - SessionStorage key now uses `appConfig.code` (e.g., `sam-splash-shown`)
  - Previously: `syra-splash-shown`

### 8. Updated API Routes
- **Modified**: `app/api/health/route.ts`
  - Health check response service name now uses `appConfig.name`

- **Modified**: `app/api/patient-experience/reports/xlsx/route.ts`
  - Excel workbook creator field now uses `appConfig.name`

## Files Changed

### Created
1. `/Users/yousef/Desktop/SAM/lib/config.ts` (new file)

### Modified
1. `/Users/yousef/Desktop/SAM/package.json`
2. `/Users/yousef/Desktop/SAM/app/layout.tsx`
3. `/Users/yousef/Desktop/SAM/lib/i18n.ts`
4. `/Users/yousef/Desktop/SAM/lib/security/config.ts`
5. `/Users/yousef/Desktop/SAM/components/shell/MobileShell.tsx`
6. `/Users/yousef/Desktop/SAM/components/SplashScreen.tsx`
7. `/Users/yousef/Desktop/SAM/app/login/page.tsx`
8. `/Users/yousef/Desktop/SAM/app/api/health/route.ts`
9. `/Users/yousef/Desktop/SAM/app/api/patient-experience/reports/xlsx/route.ts`

## Environment Variables

The following environment variables are now supported (all optional with defaults):

```bash
# Application Identity
APP_NAME=SAM                    # Display name (default: "SAM")
APP_CODE=sam                    # Short identifier (default: "sam")
APP_TYPE=policy_platform        # Platform type (default: "policy_platform")
```

**Note**: These variables are optional. The application will work with defaults if not set.

## How to Run and Validate Locally

### 1. Start the Development Server
```bash
cd /Users/yousef/Desktop/SAM
yarn dev
```

### 2. Validation Checklist

- ✅ **Build**: `yarn dev` starts successfully
- ✅ **Login Page**: 
  - Title displays "SAM" (not "SYRA" or "HospitalOS")
  - Splash screen shows "SAM" if enabled
- ✅ **Dashboard**: 
  - Header displays "SAM"
  - Mobile header displays "SAM"
- ✅ **Metadata**: 
  - Browser tab title: "SAM — Enterprise Policy & Procedure Platform"
  - Page source shows correct metadata
- ✅ **API Health Check**:
  - Visit `http://localhost:3000/api/health`
  - Response should show `"service": "SAM"`
- ✅ **Session Storage**:
  - After login, check `sessionStorage` for key: `sam-splash-shown` (not `syra-splash-shown`)
- ✅ **File Upload/Download**:
  - Excel exports should have creator field as "SAM"

### 3. Test with Custom Environment Variables (Optional)

Create `.env.local`:
```bash
APP_NAME="My Custom Policy Platform"
APP_CODE="custom"
APP_TYPE="policy_platform"
```

Restart the dev server and verify all UI elements reflect the custom name.

## Risks / TODOs for Next Phase

### Low Risk Items
- ✅ All changes are additive (no breaking changes)
- ✅ Existing features remain functional
- ✅ Translation system maintains backward compatibility

### Potential Considerations
1. **Documentation Files**: Many `.md` files still reference "HospitalOS" or "SYRA" in documentation. These are informational only and don't affect runtime. They can be updated in a documentation cleanup phase if desired.

2. **Logo/Branding Assets**: The splash screen references `/brand/syra.png`. If a SAM-specific logo is needed, it should be added, but this doesn't block functionality.

3. **Environment Variables**: If deploying, ensure `APP_NAME`, `APP_CODE`, `APP_TYPE` are set in production environment (or rely on defaults).

4. **Pre-existing TypeScript Errors**: There are some pre-existing TypeScript errors in `app/api/patient-experience/visits/route.ts` that are unrelated to Phase 1 changes. These should be addressed separately.

## Next Steps

**Phase 1 is complete and ready for approval.**

Once approved, proceed to **Phase 2: Define SYRA Core** which will:
- Create folder structure for SYRA Core concepts
- Define interfaces/types for Tenant, Group, Hospital/Org, User Identity, Roles, Entitlements
- Identify existing code that represents these concepts
- Create clear boundaries without moving major logic yet

---

**Status**: ✅ COMPLETE - Ready for approval to proceed to Phase 2
