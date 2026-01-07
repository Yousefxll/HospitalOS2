# Platform Isolation Implementation - Complete

## Summary

Implemented platform isolation to restrict users to only access routes and APIs for their selected platform (SAM or SYRA Health). Users must select a platform on `/platforms` before accessing any platform-specific routes.

## Changes Made

### 1. Platform Cookie Management

**Created**: `app/api/platform/set/route.ts`
- POST endpoint to set `sira_platform` cookie
- Values: `"sam"` or `"health"`
- Cookie settings: httpOnly, sameSite: "lax", 30 days expiry
- Requires authentication

**Created**: `app/api/platform/get/route.ts`
- GET endpoint to read current platform from cookie
- Returns platform value or null
- Requires authentication

**Updated**: `app/platforms/PlatformsClient.tsx`
- When user clicks a platform card, calls `/api/platform/set` to set cookie
- Then navigates to platform home route
- SAM → `/policies`
- Health → `/nursing/operations`

### 2. Middleware Platform Isolation

**Updated**: `middleware.ts`

#### Route Allow/Deny Rules

**SAM Platform (`sira_platform="sam"`):**
- **Allowed Routes:**
  - `/dashboard` - Main dashboard
  - `/policies/*` - Policy library and all policy pages
  - `/ai/*` - Policy-related AI features
  - `/account` - Account settings
  - `/notifications` - Notifications
  - `/demo-limit` - Demo limit page
  - `/sam/*` - SAM-specific routes
  - `/platforms` - Platform selector (always allowed)
  - `/login` - Login page (always allowed)
  - `/welcome` - Welcome page (always allowed)
  - `/` - Root landing (always allowed)

- **Blocked Routes (redirects to `/platforms?reason=platform_mismatch`):**
  - `/nursing/*` - Nursing operations
  - `/opd/*` - OPD management
  - `/scheduling/*` - Scheduling
  - `/er/*` - Emergency Room
  - `/patient-experience/*` - Patient Experience
  - `/ipd/*` - Inpatient Department
  - `/equipment/*` - Equipment management
  - `/ipd-equipment/*` - IPD Equipment

**Health Platform (`sira_platform="health"`):**
- **Allowed Routes:**
  - `/nursing/*` - Nursing operations
  - `/opd/*` - OPD management (including `/opd/dashboard`, `/opd/manpower`, etc.)
  - `/scheduling/*` - Scheduling
  - `/er/*` - Emergency Room
  - `/patient-experience/*` - Patient Experience
  - `/ipd/*` - Inpatient Department
  - `/equipment/*` - Equipment management
  - `/ipd-equipment/*` - IPD Equipment
  - `/platforms` - Platform selector (always allowed)
  - `/login` - Login page (always allowed)
  - `/welcome` - Welcome page (always allowed)
  - `/` - Root landing (always allowed)

- **Blocked Routes (redirects to `/platforms?reason=platform_mismatch`):**
  - `/dashboard` - Main dashboard (SAM)
  - `/policies/*` - Policy system
  - `/ai/*` - Policy AI features
  - `/account` - Account (blocked for health, but can be added if needed)
  - `/notifications` - Notifications (blocked for health, but can be added if needed)
  - `/demo-limit` - Demo limit (SAM only)
  - `/sam/*` - SAM-specific routes

**No Platform Cookie:**
- If user is logged in but no `sira_platform` cookie exists:
  - Redirects to `/platforms` (except for `/platforms`, `/login`, `/welcome`, `/`)

#### API Route Allow/Deny Rules

**SAM Platform APIs:**
- **Allowed:**
  - `/api/policies/*` - Policy APIs
  - `/api/sam/*` - SAM-specific APIs
  - `/api/policy-engine/*` - Policy engine APIs
  - `/api/ai/*` - Policy AI APIs
  - `/api/risk-detector/*` - Risk detector APIs

- **Blocked (403 Forbidden):**
  - `/api/nursing/*`
  - `/api/opd/*`
  - `/api/er/*`
  - `/api/ipd/*`
  - `/api/patient-experience/*`
  - `/api/equipment/*`
  - `/api/scheduling/*`

**Health Platform APIs:**
- **Allowed:**
  - `/api/nursing/*` - Nursing APIs
  - `/api/opd/*` - OPD APIs
  - `/api/er/*` - Emergency Room APIs
  - `/api/ipd/*` - Inpatient Department APIs
  - `/api/patient-experience/*` - Patient Experience APIs
  - `/api/equipment/*` - Equipment APIs
  - `/api/scheduling/*` - Scheduling APIs

- **Blocked (403 Forbidden):**
  - `/api/policies/*`
  - `/api/sam/*`
  - `/api/policy-engine/*`
  - `/api/ai/*` (policy-related)
  - `/api/risk-detector/*`

**Common APIs (Allowed for Both Platforms):**
- `/api/auth/*` - Authentication
- `/api/notifications/*` - Notifications
- `/api/admin/*` - Admin functions
- `/api/dashboard/*` - Dashboard stats (if shared)
- `/api/platform/*` - Platform management
- `/api/init` - Initialization
- `/api/health` - Health checks

### 3. Navigation Filtering

**Updated**: `components/Sidebar.tsx`

- Fetches platform from `/api/platform/get` on mount
- Filters navigation items based on platform:
  - **SAM Platform**: Shows only SAM routes (Dashboard, Policies, AI, Account, Notifications, Admin)
  - **Health Platform**: Shows only Health routes (OPD, Nursing, Scheduling, ER, Patient Experience, IPD, Equipment, Admin)
  - **No Platform**: Shows all items (user should select platform)

- Added "Switch Platform" button at bottom of sidebar
  - Visible when platform is set
  - Navigates to `/platforms` to allow platform switching
  - Icon: RefreshCw
  - Text: "Switch Platform" (English) / "تبديل المنصة" (Arabic)

### 4. Files Changed

1. `app/api/platform/set/route.ts` - New API to set platform cookie
2. `app/api/platform/get/route.ts` - New API to get platform cookie
3. `app/platforms/PlatformsClient.tsx` - Updated to set cookie on platform selection
4. `middleware.ts` - Added platform isolation enforcement
5. `components/Sidebar.tsx` - Added platform filtering and switch button

## Testing Instructions

### Test 1: Platform Selection
1. Login to the application
2. Should redirect to `/platforms`
3. Click **SAM** card
4. Cookie `sira_platform=sam` should be set
5. Should navigate to `/policies`

### Test 2: SAM Platform Isolation
1. Select SAM platform
2. **Should be able to access:**
   - `/policies`
   - `/dashboard`
   - `/account`
   - `/notifications`
   - `/ai/policy-assistant`
3. **Should NOT be able to access (redirects to `/platforms?reason=platform_mismatch`):**
   - `/nursing/operations`
   - `/opd/dashboard`
   - `/er/register`
   - `/patient-experience/dashboard`

### Test 3: Health Platform Isolation
1. Select Health platform (SYRA Health card)
2. **Should be able to access:**
   - `/nursing/operations`
   - `/opd/dashboard`
   - `/opd/manpower`
   - `/er/register`
   - `/patient-experience/dashboard`
3. **Should NOT be able to access (redirects to `/platforms?reason=platform_mismatch`):**
   - `/policies`
   - `/dashboard`
   - `/ai/policy-assistant`

### Test 4: API Isolation
1. Select SAM platform
2. **Should work:**
   - `GET /api/policies/list`
   - `POST /api/policies/search`
   - `GET /api/policy-engine/policies`
3. **Should return 403:**
   - `GET /api/nursing/operations`
   - `GET /api/opd/dashboard`

### Test 5: No Platform Cookie
1. Clear `sira_platform` cookie (or login fresh)
2. Try to access `/policies` or `/nursing/operations`
3. Should redirect to `/platforms`

### Test 6: Switch Platform
1. While on SAM platform, click "Switch Platform" button in sidebar
2. Should navigate to `/platforms`
3. Select Health platform
4. Cookie should update to `sira_platform=health`
5. Should navigate to `/nursing/operations`
6. Sidebar should now show only Health routes

### Test 7: Navigation Filtering
1. Select SAM platform
2. Open sidebar
3. **Should see:**
   - Dashboard
   - Notifications
   - Policy System (with children)
   - AI (policy-related)
   - Account
   - Admin
4. **Should NOT see:**
   - OPD Dashboard
   - Nursing Operations
   - Emergency Room
   - Patient Experience
   - Equipment

5. Select Health platform
6. Open sidebar
7. **Should see:**
   - OPD Dashboard
   - Scheduling
   - Emergency Room
   - Patient Experience
   - IPD
   - Equipment
   - Manpower & Nursing
   - Admin
8. **Should NOT see:**
   - Dashboard (main)
   - Policy System
   - AI (policy-related)

## Route Groups Summary

### SAM Routes
- `/dashboard` - Main dashboard
- `/policies/*` - Policy library, conflicts, create, search, etc.
- `/ai/*` - Policy assistant, harmonization, new policy creator
- `/account` - Account settings
- `/notifications` - Notifications
- `/demo-limit` - Demo limit page
- `/sam/*` - SAM-specific routes

### Health Routes
- `/nursing/*` - Nursing operations
- `/opd/*` - OPD dashboard, census, utilization, manpower, etc.
- `/scheduling/*` - Scheduling and availability
- `/er/*` - Emergency room (register, triage, disposition, progress notes)
- `/patient-experience/*` - Visits, cases, analytics, reports, setup
- `/ipd/*` - Inpatient department (bed setup, live beds, department input)
- `/equipment/*` - OPD equipment (master, clinic map, checklist, movements)
- `/ipd-equipment/*` - IPD equipment (map, daily checklist)

## API Groups Summary

### SAM APIs
- `/api/policies/*` - Policy management APIs
- `/api/sam/*` - SAM-specific APIs
- `/api/policy-engine/*` - Policy engine integration
- `/api/ai/*` - Policy AI features
- `/api/risk-detector/*` - Risk detection

### Health APIs
- `/api/nursing/*` - Nursing operations APIs
- `/api/opd/*` - OPD APIs (census, dashboard, utilization, manpower, etc.)
- `/api/er/*` - Emergency room APIs
- `/api/ipd/*` - Inpatient department APIs
- `/api/patient-experience/*` - Patient experience APIs
- `/api/equipment/*` - Equipment APIs
- `/api/scheduling/*` - Scheduling APIs

### Common APIs (Both Platforms)
- `/api/auth/*` - Authentication
- `/api/notifications/*` - Notifications
- `/api/admin/*` - Admin functions
- `/api/dashboard/*` - Dashboard stats
- `/api/platform/*` - Platform management
- `/api/init` - Initialization
- `/api/health` - Health checks

## Security Notes

- Platform cookie is httpOnly (cannot be read/modified by client-side JavaScript)
- Platform cookie is set via authenticated API endpoint only
- Middleware enforces isolation at the edge (before route handlers)
- API routes also check platform isolation
- `tenantId` always comes from session (not affected by platform isolation)

## Future Enhancements

- Add platform-specific onboarding flows
- Add analytics tracking for platform usage
- Consider allowing `/account` and `/notifications` for Health platform if needed
- Add platform-specific branding/theming
- Add platform-specific feature flags

