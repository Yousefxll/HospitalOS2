# Implementation Plan - HospitalOS 2 Architecture Refactoring

## Overview

Based on the comprehensive audit, this document outlines the implementation plan to achieve 100% consistency, unified data flow, and complete RBAC enforcement.

---

## Phase 2A: Unified API Layer & Services

### Step 1: Install React Query
```bash
yarn add @tanstack/react-query
```

### Step 2: Create Service Layer Structure
```
lib/
  services/
    structureService.ts       # Floors, Departments, Rooms (PX)
    opdStructureService.ts    # OPD Departments, Rooms
    patientExperienceService.ts
    opdService.ts
    equipmentService.ts
    userService.ts
    ...
```

### Step 3: Create Repository Pattern (Optional)
```
lib/
  repositories/
    baseRepository.ts         # Generic CRUD operations
    floorRepository.ts
    departmentRepository.ts
    ...
```

### Step 4: Refactor API Routes
- Move business logic from route handlers to services
- Keep routes thin (validation → service → response)

---

## Phase 2B: Unified Query/State Layer

### Step 1: Setup React Query Provider
- Create `components/providers/QueryProvider.tsx`
- Wrap app in `app/layout.tsx`

### Step 2: Define Query Keys
```
lib/queries/
  keys.ts                     # Centralized query key factory
  structureQueries.ts         # useFloors(), useDepartments(), useRooms()
  patientExperienceQueries.ts
  ...
```

### Step 3: Create Query Hooks
```
hooks/
  queries/
    useFloors.ts
    useDepartments.ts
    useRooms.ts
    usePatientExperienceVisits.ts
    ...
```

### Step 4: Refactor All Pages
- Replace `useState + fetch` with query hooks
- Remove duplicate fetch functions

---

## Phase 2C: Centralize RBAC Enforcement

### Step 1: Create Unified RBAC Engine
```
lib/rbac/
  engine.ts                   # can(user, action, resource)
  permissions.ts              # All permission definitions
  routeGuards.ts              # Route-level permission checks
```

### Step 2: Server-Side Enforcement
- Update `requireRoleAsync()` to check permissions
- Add permission checks to all API routes

### Step 3: Client-Side Enforcement
```
components/
  guards/
    PermissionGuard.tsx       # Component wrapper
    RoutePermissionGuard.tsx  # Route-level guard
hooks/
  usePermission.ts            # Hook to check permissions
```

### Step 4: Update All Pages
- Add permission checks to routes
- Hide/disable UI elements based on permissions

---

## Phase 2D: Route & Permission Registries

### Step 1: Create Route Registry
```
lib/registry/
  routes.ts                   # All route definitions
    - path
    - requiredPermission
    - navVisibility
    - metadata
```

### Step 2: Create Permission Registry
```
lib/registry/
  permissions.ts              # All permissions with metadata
    - key
    - label
    - category
    - actions (view, create, edit, delete)
    - resources
```

### Step 3: Update Navigation
- Sidebar reads from route registry
- Permission checks use registry

---

## Phase 3: Test Suite

### Step 1: Setup Testing Framework
```bash
yarn add -D jest @testing-library/react @testing-library/jest-dom
yarn add -D @playwright/test
```

### Step 2: Unit Tests
- RBAC engine tests
- Service layer tests
- Utility function tests

### Step 3: Integration Tests
- API route tests
- Service + DB tests

### Step 4: E2E Tests (Playwright)
- Critical user flows
- Permission enforcement scenarios
- Data consistency scenarios

---

## Phase 4: Scaffolding/Generator

### Step 1: Create Generator Script
```
scripts/
  generate-entity.ts          # CLI tool to scaffold new entities
```

### Step 2: Generator Creates
1. Model file (`lib/models/[Entity].ts`)
2. Service file (`lib/services/[entity]Service.ts`)
3. API routes (`app/api/[entity]/route.ts`)
4. Query hooks (`hooks/queries/use[Entity].ts`)
5. UI page (`app/(dashboard)/[entity]/page.tsx`)
6. Registry entries
7. Test files

---

## Implementation Priority

### Critical (Must Have)
1. ✅ Phase 1: Audit Report (COMPLETED)
2. Phase 2A: Service Layer (foundational)
3. Phase 2B: React Query Setup (enables cache invalidation)
4. Phase 2C: RBAC Enforcement (security)

### Important (Should Have)
5. Phase 2D: Route Registry (consistency)
6. Phase 3: Basic Test Coverage (quality)

### Nice to Have
7. Phase 4: Scaffolding (developer experience)

---

## Estimated Scope

- **Files to Create:** ~50+ new files
- **Files to Modify:** ~100+ existing files
- **Lines of Code:** ~5,000+ new, ~10,000+ modified
- **Time Estimate:** 40-80 hours of focused development

---

## Risk Mitigation

1. **Breaking Changes:** Implement incrementally, one module at a time
2. **Test Coverage:** Add tests as we refactor
3. **Rollback Plan:** Use feature flags for new patterns
4. **Team Coordination:** Document all changes thoroughly

---

## Next Steps

1. Review audit report (`AUDIT_REPORT.md`)
2. Approve implementation plan
3. Begin Phase 2A (Service Layer)
4. Incrementally refactor modules

---

**Status:** Awaiting approval to proceed with implementation.


