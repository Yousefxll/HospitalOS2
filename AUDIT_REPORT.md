# HospitalOS 2 - Comprehensive Audit Report
**Generated:** 2025-01-XX  
**Scope:** Full codebase audit for consistency, integration, and architecture enforcement

---

## Executive Summary

This audit identifies critical inconsistencies, architectural gaps, and areas requiring refactoring to achieve 100% consistency, unified data flow, and complete RBAC enforcement across the entire application.

### Critical Issues Found
1. ❌ **No unified query/state layer** - No React Query/SWR, all pages use local `useState` + `fetch`
2. ❌ **No service/repository layer** - API routes directly access MongoDB
3. ❌ **Duplicate data fetching logic** - Same fetch functions duplicated across 10+ pages
4. ❌ **Model inconsistencies** - Multiple definitions for same entities (Room, Department)
5. ❌ **Incomplete RBAC enforcement** - Server-side checks exist, UI-side inconsistent
6. ❌ **No route/permission registry** - Routes hardcoded in multiple places
7. ❌ **No test coverage** - Zero tests found
8. ❌ **No automatic cache invalidation** - Data changes don't reflect across pages automatically

---

## Phase 1A: Entity Inventory

### Core Entities Identified

#### 1. **User**
- **Model:** `lib/models/User.ts`
- **API:** `app/api/auth/login`, `app/api/auth/me`, `app/api/admin/users`
- **Collections:** `users`
- **UI Pages:** `app/(dashboard)/admin/users/page.tsx`
- **Issues:** ✅ Single source of truth exists

#### 2. **Floor** (Patient Experience)
- **Model:** `lib/models/Floor.ts` (`Floor` interface)
- **API:** 
  - `GET/POST/PUT/DELETE /api/patient-experience/data?type=floors`
  - `GET/POST/PUT/DELETE /api/admin/structure` (also handles floors)
- **Collections:** `floors`
- **UI Pages:** 
  - `app/(dashboard)/patient-experience/page.tsx`
  - `app/(dashboard)/patient-experience/setup/page.tsx`
  - `app/(dashboard)/patient-experience/dashboard/page.tsx`
  - `app/(dashboard)/patient-experience/analytics/page.tsx`
  - `app/(dashboard)/patient-experience/reports/page.tsx`
  - `app/(dashboard)/patient-experience/visits/page.tsx`
  - `app/(dashboard)/admin/structure-management/page.tsx`
- **Issues:** 
  - ❌ Two API endpoints for same entity (`/api/patient-experience/data` and `/api/admin/structure`)
  - ❌ Duplicate `loadFloors()` functions in 7+ pages
  - ❌ No unified cache - changes don't reflect automatically

#### 3. **Department** (Patient Experience - FloorDepartment)
- **Model:** `lib/models/Floor.ts` (`FloorDepartment` interface)
- **API:** 
  - `GET/POST/PUT/DELETE /api/patient-experience/data?type=departments`
  - `GET/POST/PUT/DELETE /api/admin/structure` (also handles departments)
- **Collections:** `floor_departments`
- **UI Pages:** Same as Floor (7+ pages)
- **Issues:** 
  - ❌ Same as Floor (duplicate endpoints, duplicate fetch logic)
  - ❌ Model confusion: `lib/models/Department.ts` exists for OPD departments (different entity!)

#### 4. **Room** (Patient Experience - FloorRoom)
- **Model:** `lib/models/Floor.ts` (`FloorRoom` interface)
- **API:** 
  - `GET/POST/PUT/DELETE /api/patient-experience/data?type=rooms`
  - `GET/POST/PUT/DELETE /api/admin/structure` (also handles rooms)
- **Collections:** `floor_rooms`
- **UI Pages:** Same as Floor (7+ pages)
- **Issues:** 
  - ❌ Same as Floor
  - ❌ Model confusion: `lib/models/Room.ts` exists for OPD rooms (different entity!)

#### 5. **Department** (OPD)
- **Model:** `lib/models/Department.ts`
- **API:** `GET /api/opd/departments`
- **Collections:** `departments` (different from `floor_departments`)
- **UI Pages:** `app/(dashboard)/opd/daily-data-entry/page.tsx`
- **Issues:** 
  - ⚠️ Name collision with Patient Experience departments (same name, different entity)
  - ❌ No unified API layer

#### 6. **Room** (OPD)
- **Model:** `lib/models/Room.ts`
- **API:** `GET /api/opd/rooms`
- **Collections:** `rooms` (different from `floor_rooms`)
- **UI Pages:** `app/(dashboard)/opd/daily-data-entry/page.tsx`
- **Issues:** 
  - ⚠️ Name collision with Patient Experience rooms
  - ❌ No unified API layer

#### 7. **Doctor**
- **Model:** `lib/models/Doctor.ts`
- **API:** `GET/POST/PUT/DELETE /api/opd/manpower/doctors`
- **Collections:** `doctors`
- **UI Pages:** 
  - `app/(dashboard)/opd/manpower-edit/page.tsx`
  - `app/(dashboard)/opd/daily-data-entry/page.tsx`
- **Issues:** ✅ Single source of truth exists

#### 8. **Nurse**
- **Model:** `lib/models/Nurse.ts`
- **API:** `GET/POST/PUT/DELETE /api/opd/manpower/nurses`
- **Collections:** `nurses`
- **UI Pages:** `app/(dashboard)/opd/manpower-edit/page.tsx`
- **Issues:** ✅ Single source of truth exists

#### 9. **PatientExperience** (Visit)
- **Model:** `lib/models/PatientExperience.ts`
- **API:** 
  - `POST /api/patient-experience` (create visit)
  - `GET /api/patient-experience/visits` (list visits)
- **Collections:** `patient_experience_visits`
- **UI Pages:** 
  - `app/(dashboard)/patient-experience/visit/page.tsx`
  - `app/(dashboard)/patient-experience/visits/page.tsx`
  - `app/(dashboard)/patient-experience/dashboard/page.tsx`
- **Issues:** ✅ Single source of truth exists

#### 10. **PXCase**
- **Model:** `lib/models/PXCase.ts`
- **API:** 
  - `GET /api/patient-experience/cases`
  - `PATCH /api/patient-experience/cases/[id]`
- **Collections:** `px_cases`
- **UI Pages:** `app/(dashboard)/patient-experience/cases/page.tsx`
- **Issues:** ✅ Single source of truth exists

#### 11. **Equipment**
- **Model:** `lib/models/Equipment.ts`
- **API:** `GET/POST /api/equipment`
- **Collections:** `equipment`
- **UI Pages:** `app/(dashboard)/equipment/master/page.tsx`
- **Issues:** ✅ Single source of truth exists

#### 12. **Notification**
- **Model:** `lib/models/Notification.ts`
- **API:** 
  - `GET /api/notifications`
  - `PATCH /api/notifications/[id]`
- **Collections:** `notifications`
- **UI Pages:** `app/(dashboard)/notifications/page.tsx`
- **Issues:** ✅ Single source of truth exists

#### 13. **PolicyDocument**
- **Model:** `lib/models/PolicyDocument.ts` (also `lib/models/Policy.ts`)
- **API:** Multiple endpoints in `app/api/policies/`
- **Collections:** `policy_documents`, `policy_chunks`
- **UI Pages:** Multiple policy pages
- **Issues:** 
  - ⚠️ Two model files (`Policy.ts` and `PolicyDocument.ts`) - need to verify which is canonical

#### 14. **OPDDailyData**
- **Model:** `lib/models/OPDDailyData.ts`
- **API:** `POST /api/opd/daily-data`
- **Collections:** `opd_daily_data`
- **UI Pages:** `app/(dashboard)/opd/daily-data-entry/page.tsx`
- **Issues:** ✅ Single source of truth exists

#### 15. **OPDCensus**
- **Model:** `lib/models/OPDCensus.ts`
- **API:** `GET /api/opd/census`
- **Collections:** `opd_census`
- **UI Pages:** `app/(dashboard)/opd/clinic-daily-census/page.tsx`
- **Issues:** ✅ Single source of truth exists

---

## Phase 1B: Data Flow Map

### Current Flow Pattern (Inconsistent)

```
UI Page
  ↓
useState + useEffect
  ↓
fetch('/api/...')
  ↓
API Route Handler
  ↓
getCollection('...')
  ↓
MongoDB
  ↓
Response → setState → UI Update
```

### Problems with Current Flow

1. **No Query Layer:**
   - Every page implements its own `loadFloors()`, `loadDepartments()`, `loadRooms()` functions
   - No shared cache between pages
   - No automatic refetch on mutations
   - No optimistic updates

2. **No Service Layer:**
   - API routes directly access MongoDB collections
   - Business logic scattered across route handlers
   - No validation layer (some use Zod, some don't)

3. **No Repository Pattern:**
   - Direct `collection.find()`, `collection.insertOne()` calls in routes
   - No abstraction for database operations
   - Hard to test or swap databases

### Example: Floor Entity Data Flow (Current - Problematic)

**Page 1:** `patient-experience/dashboard/page.tsx`
```typescript
const [floors, setFloors] = useState<any[]>([]);
async function loadFloors() {
  const response = await fetch('/api/patient-experience/data?type=floors');
  const data = await response.json();
  setFloors(data.data || []);
}
```

**Page 2:** `patient-experience/analytics/page.tsx`
```typescript
const [floors, setFloors] = useState<any[]>([]);
async function loadFloors() {
  const response = await fetch('/api/patient-experience/data?type=floors');
  const data = await response.json();
  setFloors(data.data || []);
}
```

**Page 3:** `patient-experience/visits/page.tsx`
```typescript
const [floors, setFloors] = useState<any[]>([]);
async function loadFloors() {
  const response = await fetch('/api/patient-experience/data?type=floors');
  const data = await response.json();
  setFloors(data.data || []);
}
```

**Result:** 
- ❌ Same code duplicated 7+ times
- ❌ No shared cache
- ❌ If Floor is added in one page, others don't update automatically
- ❌ Each page makes separate API call on mount

---

## Phase 1C: Mismatch/Breakage List

| File Path | Problem | Impact | Fix Plan |
|-----------|---------|--------|----------|
| **Data Fetching Issues** |
| `app/(dashboard)/patient-experience/dashboard/page.tsx` | Uses `useState` + `fetch` instead of React Query | No cache sharing, duplicate API calls | Use `useFloors()` hook from unified query layer |
| `app/(dashboard)/patient-experience/analytics/page.tsx` | Same as above | Same | Same |
| `app/(dashboard)/patient-experience/visits/page.tsx` | Same as above | Same | Same |
| `app/(dashboard)/patient-experience/reports/page.tsx` | Same as above | Same | Same |
| `app/(dashboard)/patient-experience/setup/page.tsx` | Same as above | Same | Same |
| `app/(dashboard)/patient-experience/page.tsx` | Same as above | Same | Same |
| `app/(dashboard)/patient-experience/visit/page.tsx` | Same as above | Same | Same |
| `app/(dashboard)/admin/structure-management/page.tsx` | Same as above | Same | Same |
| **API Layer Issues** |
| `app/api/patient-experience/data/route.ts` | Duplicates structure management endpoints | Confusion: which endpoint to use? | Consolidate into single `/api/structure` service |
| `app/api/admin/structure/route.ts` | Duplicates patient-experience/data endpoints | Same | Same |
| **Model Issues** |
| `lib/models/Department.ts` | Name collision: OPD Department vs PX FloorDepartment | Confusion | Rename or namespace: `OPDDepartment` vs `PXDepartment` |
| `lib/models/Room.ts` | Name collision: OPD Room vs PX FloorRoom | Confusion | Rename or namespace: `OPDRoom` vs `PXRoom` |
| `lib/models/Policy.ts` | Duplicate of PolicyDocument? | Need verification | Remove duplicate or document difference |
| `lib/models/PolicyDocument.ts` | Duplicate of Policy? | Need verification | Remove duplicate or document difference |
| **RBAC Issues** |
| `lib/permissions.ts` | `hasRoutePermission()` returns `true` for unknown routes | Security gap | Return `false` by default, require explicit permission |
| `app/(dashboard)/dashboard/page.tsx` | ✅ Checks permission client-side | Good example | Replicate this pattern |
| `app/(dashboard)/opd/dashboard/page.tsx` | ❌ No permission check | Security gap | Add permission check |
| `app/(dashboard)/patient-experience/dashboard/page.tsx` | ❌ No permission check | Security gap | Add permission check |
| Most other pages | ❌ No permission checks | Security gap | Add permission checks or route-level guards |
| **Service Layer Issues** |
| All API routes | Direct MongoDB access via `getCollection()` | No abstraction, hard to test | Create service/repository layer |
| `app/api/patient-experience/data/route.ts` | Business logic in route handler | Violates separation of concerns | Move to `lib/services/structureService.ts` |
| **Query Key Issues** |
| N/A | No React Query installed | No unified query keys | Install `@tanstack/react-query` |
| N/A | No query keys defined | Can't invalidate cache | Define query keys in `lib/queries/keys.ts` |
| **Route Registry Issues** |
| `components/Sidebar.tsx` | Routes hardcoded in component | No single source of truth | Use route registry |
| `lib/permissions.ts` | `ROUTE_PERMISSIONS` partial mapping | Missing routes | Complete mapping in route registry |
| **Test Coverage** |
| Entire codebase | No test files found | No automated verification | Add unit, integration, E2E tests |

---

## Phase 1D: Architecture Violations

### Violation 1: No Single Source of Truth for Structure Data

**Current State:**
- Floors, Departments, Rooms have TWO API endpoints:
  1. `/api/patient-experience/data?type=floors`
  2. `/api/admin/structure` (GET returns all three)

**Impact:**
- Developers don't know which endpoint to use
- Duplicate validation logic
- Inconsistent RBAC checks

**Required Fix:**
- Single endpoint: `/api/structure/floors`, `/api/structure/departments`, `/api/structure/rooms`
- Single service: `lib/services/structureService.ts`
- Single query hook: `useFloors()`, `useDepartments()`, `useRooms()`

### Violation 2: No Automatic Cache Invalidation

**Current State:**
- Admin adds Floor via `/admin/structure-management`
- Floor appears in admin page
- Other pages (dashboard, analytics, visits) don't show new floor until manual refresh

**Impact:**
- Users see stale data
- Confusing UX ("I just added it, why doesn't it appear?")

**Required Fix:**
- React Query with query keys
- Mutation hooks that invalidate related queries
- Example: `useCreateFloor()` → invalidates `['floors', 'list']`

### Violation 3: Incomplete RBAC Enforcement

**Current State:**
- Server-side: `requireRoleAsync()` checks roles
- UI-side: Only `dashboard/page.tsx` checks permissions
- Most pages: No permission checks

**Impact:**
- User can navigate to pages they shouldn't access
- Buttons/actions visible but will fail with 403 (poor UX)

**Required Fix:**
- Route-level permission guards
- Component-level permission gates
- Unified `can(user, action, resource)` function

### Violation 4: No Service/Repository Layer

**Current State:**
```typescript
// app/api/patient-experience/data/route.ts
export async function GET(request: NextRequest) {
  const floorsCollection = await getCollection('floors');
  const floors = await floorsCollection.find({ active: true }).toArray();
  return NextResponse.json({ success: true, data: floors });
}
```

**Impact:**
- Business logic in route handlers
- Hard to test (need to mock MongoDB)
- Duplicate queries across routes

**Required Fix:**
```typescript
// lib/services/structureService.ts
export async function getAllFloors(): Promise<Floor[]> {
  const floorsCollection = await getCollection('floors');
  return await floorsCollection.find({ active: true }).toArray();
}

// app/api/structure/floors/route.ts
export async function GET() {
  const floors = await getAllFloors();
  return NextResponse.json({ success: true, data: floors });
}
```

---

## Summary Statistics

### Code Duplication
- **`loadFloors()` function:** Found in 7+ files (identical code)
- **`loadDepartments()` function:** Found in 7+ files (identical code)
- **`loadRooms()` function:** Found in 7+ files (identical code)

### Missing Patterns
- ❌ React Query/SWR: **0% coverage** (not installed)
- ❌ Service layer: **0% coverage** (direct DB access)
- ❌ Repository pattern: **0% coverage** (direct collection access)
- ❌ Query hooks: **0% coverage** (no hooks found)
- ❌ Route registry: **0% coverage** (hardcoded routes)
- ❌ Test coverage: **0% coverage** (no test files)

### RBAC Coverage
- ✅ Server-side role checks: **~80%** (most API routes protected)
- ❌ Server-side permission checks: **~40%** (only some routes check permissions)
- ❌ UI-side permission checks: **~5%** (only dashboard page)
- ❌ Route-level guards: **0%** (no route guards found)

---

## Next Steps

1. **Phase 2A:** Create unified service/repository layer
2. **Phase 2B:** Implement React Query with unified query hooks
3. **Phase 2C:** Centralize RBAC enforcement (server + UI)
4. **Phase 2D:** Create route and permission registries
5. **Phase 3:** Add comprehensive test suite
6. **Phase 4:** Create scaffolding/generator for new entities

---

**End of Audit Report**


