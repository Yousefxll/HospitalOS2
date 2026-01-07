# SYRA Project Encyclopedia
## Complete Codebase Documentation & Audit Report

**Generated:** 2025-01-XX  
**Purpose:** Comprehensive documentation of all files, routes, components, and dependencies for safe cleanup and refactoring  
**Mode:** READ-ONLY audit (no code modifications)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Full Folder Tree](#2-full-folder-tree)
3. [File-by-File Documentation](#3-file-by-file-documentation)
4. [Flow Maps](#4-flow-maps)
5. [Cleanup Plan](#5-cleanup-plan)

---

## 1. Project Overview

### 1.1 System Purpose

SYRA is an enterprise-grade multi-tenant policy and procedure management platform with two main product lines:

- **SAM (Strategic Asset Management)**: Policy library, AI-powered policy assistant, risk detection, policy harmonization
- **SYRA Health**: Hospital operations management (OPD, ER, IPD, Nursing, Patient Experience, Equipment, CDO)

The system supports:
- Multi-tenant architecture with isolated databases per tenant
- Platform-based access control (users can have access to SAM, Health, EDRAC, or CVision)
- Role-based access control (RBAC): `syra-owner`, `admin`, `supervisor`, `staff`, `viewer`
- Hierarchical user management: Groups → Hospitals → Users
- Bilingual support (English/Arabic) with translation services
- Policy engine integration (Python FastAPI service) for AI-powered policy analysis

### 1.2 Architecture Overview

#### Database Architecture

**Platform Database (`syra_platform`):**
- Contains tenant registry (`tenants` collection)
- Platform owner users (`users` collection with `role: 'syra-owner'`)
- Platform-level settings
- **Rule:** No tenant-scoped business data allowed

**Tenant Databases (`syra_tenant__{tenantKey}`):**
- Each tenant has isolated database
- All business data (policies, OPD data, patient experience, etc.)
- Tenant users (except syra-owner)
- Sessions, audit logs, notifications

**Legacy Database (`hospital_ops`):**
- Still referenced in some code (`lib/db.ts`)
- Appears to be migration target or legacy

#### Authentication & Session Flow

1. **Login** (`/api/auth/login`):
   - Validates credentials
   - Creates session in tenant DB (or platform DB for syra-owner)
   - Sets `auth-token` cookie (JWT with userId, role, entitlements, sessionId)
   - Sets `syra_platform` cookie (selected platform: 'sam' or 'health')
   - Sets `syra_tenant` cookie (selected tenantId)

2. **Middleware** (`middleware.ts`):
   - Validates JWT token from cookie
   - Enforces platform isolation (SAM routes vs Health routes)
   - Enforces role-based access (`/owner` for syra-owner, `/admin` for admin)
   - Adds user headers (`x-user-id`, `x-user-email`, `x-user-role`)

3. **API Routes**:
   - Use `requireAuth()` to get authenticated user context
   - Use `requireTenant()` to get tenantId from session (SINGLE SOURCE OF TRUTH)
   - Use `getTenantDbFromRequest()` to get tenant database
   - All queries filtered by `tenantId` from session

#### Platform Isolation

**Platforms:**
- `sam`: Policy management platform
- `health`: Hospital operations platform
- `edrac`: (Future) Emergency Department platform
- `cvision`: (Future) Clinical Vision platform

**Route Isolation:**
- SAM routes: `/policies`, `/ai`, `/sam`, `/demo-limit`
- Health routes: `/dashboard`, `/opd`, `/er`, `/ipd`, `/patient-experience`, `/equipment`, `/nursing`
- Common routes: `/account`, `/notifications`, `/welcome`, `/platforms`
- Owner routes: `/owner` (not subject to platform isolation)

**API Isolation:**
- SAM APIs: `/api/policies`, `/api/sam`, `/api/policy-engine`, `/api/ai`, `/api/risk-detector`
- Health APIs: `/api/opd`, `/api/er`, `/api/ipd`, `/api/patient-experience`, `/api/equipment`, `/api/nursing`
- Common APIs: `/api/auth`, `/api/notifications`, `/api/admin`, `/api/dashboard`, `/api/platform`

#### Tenant Isolation

**Tenant Selection:**
- Users (except syra-owner) must belong to a tenant
- TenantId stored in user record (`user.tenantId`)
- Active tenant stored in session (`session.activeTenantId`)
- TenantId comes ONLY from session, never from query/body parameters

**Database Isolation:**
- Each tenant has separate database: `syra_tenant__{tenantKey}`
- Tenant registry in platform DB maps `tenantId` → `dbName`
- All queries automatically scoped to tenant DB
- Platform DB used only for tenant lookup and owner users

### 1.3 Key Data Models

#### Core Collections (Platform DB)

- `tenants`: Tenant registry with entitlements, status, dbName
- `users`: Platform owner users (role: 'syra-owner')

#### Core Collections (Tenant DB)

**User Management:**
- `users`: Tenant users with role, groupId, hospitalId, permissions
- `groups`: Organizational groups
- `hospitals`: Hospital entities
- `sessions`: Active user sessions

**Policy Management (SAM):**
- `policy_documents`: Policy metadata (title, category, filePath, processingStatus)
- `policy_chunks`: Text chunks for search (policyId, pageNumber, text)
- `policy_alerts`: Policy violation alerts from integrations

**OPD Module:**
- `opd_census`: Daily clinic census data
- `opd_daily_data`: Detailed daily data entry (doctors, rooms, patients)
- `departments`: Department definitions
- `clinics`: Clinic definitions
- `doctors`: Doctor profiles

**Patient Experience:**
- `px_cases`: Patient experience cases (complaints, feedback)
- `px_visits`: Visit records
- `px_case_audits`: Audit trail for cases
- `complaint_domains`: Complaint taxonomy
- `complaint_types`: Complaint type definitions

**ER Module:**
- `er_registrations`: ER patient registrations
- `er_triage`: Triage assessments
- `er_progress_notes`: Progress notes
- `er_dispositions`: Disposition decisions

**CDO (Clinical Decision Optimization):**
- `clinical_decision_prompts`: Decision support prompts
- `cdo_outcome_events`: Patient outcome events
- `cdo_risk_flags`: Risk indicators
- `cdo_response_time_metrics`: Time-based metrics
- `cdo_transition_outcomes`: Care transition outcomes
- `cdo_readmission_events`: Readmission events
- `cdo_quality_indicators`: Aggregated quality indicators

**Equipment:**
- `equipment`: Equipment master data

**Structure:**
- `departments`: Department structure
- `floors`: Floor definitions
- `rooms`: Room definitions

**Other:**
- `notifications`: User notifications
- `audit_logs`: Audit trail
- `usage_quotas`: Usage quota tracking

### 1.4 Key Flows

#### Authentication Flow

```
User → POST /api/auth/login
  → Validate credentials (tenant DB or platform DB)
  → Create session (tenant DB)
  → Generate JWT (userId, role, entitlements, sessionId)
  → Set cookies (auth-token, syra_platform, syra_tenant)
  → Return user info + entitlements
```

#### Request Flow

```
Request → middleware.ts
  → Check public paths (/login, /api/auth/login, /api/init)
  → Verify JWT token from cookie
  → Check role (syra-owner → /owner, admin → /admin)
  → Check platform cookie (sam/health)
  → Enforce platform route isolation
  → Add user headers
  → Route handler
    → requireAuth() → get session → get tenantId
    → getTenantDbFromRequest() → get tenant DB
    → Query tenant DB (filtered by tenantId)
    → Return response
```

#### Platform Selection Flow

```
User logs in → Entitlements computed from tenant.entitlements + user.platformAccess
  → If multiple platforms: redirect to /platforms
  → User selects platform → POST /api/platform/set
  → Set syra_platform cookie
  → Redirect to platform dashboard
```

#### Tenant Switching Flow (syra-owner only)

```
syra-owner → POST /api/auth/switch-tenant?tenantId={id}
  → Validate tenant exists and user has access
  → Update session.activeTenantId
  → Return success
```

---

## 2. Full Folder Tree

```
SYRA/
├── __tests__/                          [test]
│   ├── navigation-redirect.test.md
│   ├── quota.test.ts
│   ├── tenant-isolation.test.ts
│   └── welcome.test.ts
├── _backup_routes/                     [unused?]
│   └── (empty)
├── _reports/                           [unused?]
│   └── (unknown contents)
├── app/                                 [core] [route]
│   ├── (dashboard)/                    [route]
│   │   ├── account/
│   │   ├── admin/
│   │   ├── ai/
│   │   ├── dashboard/
│   │   ├── demo-limit/
│   │   ├── equipment/
│   │   ├── er/
│   │   ├── ipd/
│   │   ├── layout.tsx
│   │   ├── notifications/
│   │   ├── opd/
│   │   ├── patient-experience/
│   │   ├── policies/
│   │   ├── sam/
│   │   └── welcome/
│   ├── admin/                          [route]
│   ├── api/                            [route]
│   ├── globals.css
│   ├── layout.tsx
│   ├── login/
│   ├── nursing/
│   ├── opd/
│   ├── owner/                          [route]
│   ├── page.tsx
│   ├── platforms/
│   └── welcome/
├── apps/                               [unused?]
│   └── (unknown contents)
├── components/                         [ui]
│   ├── mobile/
│   ├── nav/
│   ├── policies/
│   ├── providers/
│   ├── px/
│   ├── shell/
│   ├── ui/
│   ├── Header.tsx
│   ├── InlineEditField.tsx
│   ├── InlineToggle.tsx
│   ├── LanguageProvider.tsx
│   ├── LanguageToggle.tsx
│   ├── Sidebar.tsx
│   ├── SplashScreen.tsx
│   ├── ThemeProvider.tsx
│   ├── ThemeToggle.tsx
│   └── TimeFilter.tsx
├── contexts/                           [lib]
│   └── LanguageContext.tsx
├── docs/                               [config]
│   ├── openapi/
│   ├── specs/
│   └── *.md
├── hooks/                              [lib]
│   ├── queries/
│   ├── use-lang.ts
│   ├── use-mobile.jsx
│   ├── use-toast.js
│   ├── use-translation.ts
│   └── useMediaQuery.ts
├── lib/                                [lib] [core]
│   ├── auth/
│   ├── cdo/
│   ├── db/
│   ├── ehr/
│   ├── i18n/
│   ├── integrations/
│   ├── models/
│   ├── openai/
│   ├── opd/
│   ├── patient-experience/
│   ├── policy/
│   ├── quota/
│   ├── reports/
│   ├── security/
│   ├── seed/
│   ├── services/
│   ├── system/
│   ├── translate/
│   ├── utils/
│   ├── auth.ts
│   ├── config.ts
│   ├── db-tenant.ts
│   ├── db.ts
│   ├── entitlements.ts
│   ├── env.ts
│   ├── i18n.ts
│   ├── navigation.ts
│   ├── permissions-helpers.ts
│   ├── permissions.ts
│   ├── pdf-parse-wrapper.ts
│   ├── rbac.ts
│   └── tenant.ts
├── middleware.ts                       [core]
├── policy-engine/                      [script] [external]
│   ├── app/
│   ├── apps/
│   ├── data/
│   ├── docs/
│   ├── scripts/
│   ├── venv/
│   └── *.md
├── public/                             [config]
│   ├── brand/
│   ├── branding/
│   ├── fonts/
│   └── platforms/
├── scripts/                            [script] [migration]
│   ├── migrations/
│   ├── seed/
│   └── *.ts, *.js, *.py, *.sh, *.cjs
├── storage/                            [data]
│   └── policies/
├── tests/                              [test]
│   └── __init__.py
├── [ROOT FILES]                        [config]
│   ├── *.md (many documentation files)
│   ├── *.png, *.svg (logos)
│   ├── components.json
│   ├── jsconfig.json
│   ├── next.config.js
│   ├── next-env.d.ts
│   ├── package.json
│   ├── package-lock.json
│   ├── postcss.config.js
│   ├── render-policy-engine.yaml
│   ├── render.yaml
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── tsconfig.tsbuildinfo
│   ├── vercel.json
│   ├── yarn.lock
│   └── middleware.ts
```

---

## 3. File-by-File Documentation

### 3.1 Root Configuration Files

#### FILE: package.json
**TYPE:** config  
**PURPOSE:** Node.js project configuration, dependencies, scripts  
**ENTRYPOINTS:** Used by npm/yarn for dependency management and script execution  
**DEPENDENCIES:** None (root config)  
**OUTPUTS/SIDE EFFECTS:** Defines project metadata, scripts, dependencies  
**TENANT CONTEXT:** N/A  
**SECURITY NOTES:** Contains scripts that may access databases  
**QUALITY NOTES:** Package name is "sam" (legacy), should be "syra"  
**USED?:**
- Direct references: npm/yarn, CI/CD, deployment scripts
- Scripts referenced: `yarn dev`, `yarn build`, `yarn bootstrap:owner`, `yarn migrate:*`

---

#### FILE: next.config.js
**TYPE:** config  
**PURPOSE:** Next.js configuration (webpack aliases for pdfkit fonts)  
**ENTRYPOINTS:** Used by Next.js build system  
**DEPENDENCIES:** None  
**OUTPUTS/SIDE EFFECTS:** Configures webpack for server-side pdfkit font access  
**TENANT CONTEXT:** N/A  
**SECURITY NOTES:** None  
**QUALITY NOTES:** Minimal config, could add more optimizations  
**USED?:**
- Direct references: Next.js build system (automatic)

---

#### FILE: tsconfig.json
**TYPE:** config  
**PURPOSE:** TypeScript compiler configuration  
**ENTRYPOINTS:** Used by TypeScript compiler, IDE language servers  
**DEPENDENCIES:** None  
**OUTPUTS/SIDE EFFECTS:** Defines TypeScript compilation rules, path aliases (@/*)  
**TENANT CONTEXT:** N/A  
**SECURITY NOTES:** None  
**QUALITY NOTES:** `strict: false`, `noImplicitAny: false` - should enable strict mode  
**USED?:**
- Direct references: TypeScript compiler, IDE (VSCode, etc.)
- Excludes: `__tests__`, `scripts` (but scripts use tsx, so this is fine)

---

#### FILE: middleware.ts
**TYPE:** core [route]  
**PURPOSE:** Next.js middleware for authentication, authorization, platform isolation  
**ENTRYPOINTS:** Executed on every request (except static files)  
**DEPENDENCIES:** 
- `@/lib/auth/edge` (verifyTokenEdge)
**OUTPUTS/SIDE EFFECTS:** 
- Sets response headers (x-user-id, x-user-email, x-user-role)
- Redirects to /login or /platforms
- Returns 401/403 responses
**TENANT CONTEXT:** Reads platform cookie (`syra_platform`), validates entitlements from JWT  
**SECURITY NOTES:** 
- Validates JWT token from cookie
- Enforces role-based access (syra-owner, admin)
- Enforces platform isolation
- Does NOT validate session against DB (done in API routes to avoid MongoDB in Edge Runtime)
**QUALITY NOTES:** 
- Well-structured route definitions
- Platform isolation logic is clear
- Owner routes bypass platform isolation (correct)
**USED?:**
- Direct references: Next.js middleware system (automatic)
- All protected routes depend on this

---

### 3.2 Core Library Files

#### FILE: lib/env.ts
**TYPE:** lib [config]  
**PURPOSE:** Type-safe environment variable access with validation  
**ENTRYPOINTS:** Imported by all modules that need env vars  
**DEPENDENCIES:** None  
**OUTPUTS/SIDE EFFECTS:** Validates required env vars at module load time, throws if missing  
**TENANT CONTEXT:** N/A  
**SECURITY NOTES:** Contains sensitive values (MONGO_URL, JWT_SECRET) - should not be logged  
**QUALITY NOTES:** Good validation, helpful error messages in dev mode  
**USED?:**
- Direct references: 
  - `lib/db.ts` (MONGO_URL, DB_NAME)
  - `lib/db/platformDb.ts` (MONGO_URL)
  - `lib/db/tenantDb.ts` (MONGO_URL)
  - `lib/auth.ts` (JWT_SECRET)
  - Many API routes and services

---

#### FILE: lib/db.ts
**TYPE:** lib [core]  
**PURPOSE:** Legacy MongoDB connection helper (connects to DB_NAME database)  
**ENTRYPOINTS:** Imported as `getCollection()` in many files  
**DEPENDENCIES:** 
- `@/lib/env` (MONGO_URL, DB_NAME)
- mongodb
**OUTPUTS/SIDE EFFECTS:** Creates MongoDB connection, caches client/db  
**TENANT CONTEXT:** Uses `DB_NAME` from env (defaults to 'hospital_ops') - NOT tenant-aware  
**SECURITY NOTES:** Connection pooling configured (maxPoolSize: 10)  
**QUALITY NOTES:** 
- **ISSUE:** This is legacy code. Should use `getTenantDbFromRequest()` or `getPlatformDb()` instead
- Still used in many places (needs migration)
**USED?:**
- Direct references: 
  - `lib/auth/requireAuth.ts` (getCollection for users, sessions, tenants)
  - `lib/auth/sessions.ts` (getCollection for sessions)
  - Many API routes (legacy usage)
  - **NEEDS AUDIT:** Should identify all usages and migrate to tenant/platform DB helpers

---

#### FILE: lib/db/platformDb.ts
**TYPE:** lib [core]  
**PURPOSE:** Platform database connection (syra_platform)  
**ENTRYPOINTS:** Imported by code that needs platform DB  
**DEPENDENCIES:** 
- `@/lib/env` (MONGO_URL)
- mongodb
**OUTPUTS/SIDE EFFECTS:** Creates MongoDB connection to 'syra_platform', caches client/db  
**TENANT CONTEXT:** Platform DB contains tenant registry and owner users only  
**SECURITY NOTES:** Connection pooling configured  
**QUALITY NOTES:** Clean implementation, follows pattern  
**USED?:**
- Direct references:
  - `lib/db/tenantDb.ts` (lookup tenant registry)
  - `app/api/owner/tenants/*` routes
  - `app/api/platform/*` routes
  - `lib/system/bootstrap.ts`

---

#### FILE: lib/db/tenantDb.ts
**TYPE:** lib [core]  
**PURPOSE:** Tenant database connection (session-based, looks up tenant from platform DB)  
**ENTRYPOINTS:** Imported by API routes that need tenant-scoped data  
**DEPENDENCIES:** 
- `@/lib/env` (MONGO_URL)
- `@/lib/tenant` (requireTenantId)
- `@/lib/auth/requireAuthContext` (requireAuthContext)
- `@/lib/db/dbNameHelper` (getTenantDbName)
- `@/lib/db/platformDb` (for tenant lookup)
- mongodb
**OUTPUTS/SIDE EFFECTS:** 
- Creates MongoDB connection to tenant DB
- Caches connections by tenantKey
- Logs tenant DB access (user, role, dbName)
**TENANT CONTEXT:** 
- **SINGLE SOURCE OF TRUTH:** tenantKey comes ONLY from session (requireTenantId)
- Looks up tenant in platform DB to get dbName
- Returns tenant DB instance
**SECURITY NOTES:** 
- Validates tenant exists and is active
- Returns 403 if tenant not found/inactive
**QUALITY NOTES:** 
- Well-documented
- Proper error handling
- Connection caching
**USED?:**
- Direct references:
  - Most tenant-scoped API routes
  - `app/api/policies/*` routes
  - `app/api/opd/*` routes
  - `app/api/patient-experience/*` routes
  - `app/api/admin/*` routes (tenant-scoped)

---

#### FILE: lib/db/dbNameHelper.ts
**TYPE:** lib [core]  
**PURPOSE:** Helper to generate/retrieve tenant database names  
**ENTRYPOINTS:** Imported by `lib/db/tenantDb.ts`  
**DEPENDENCIES:** None  
**OUTPUTS/SIDE EFFECTS:** Generates short database names from tenant data  
**TENANT CONTEXT:** Maps tenantId → dbName (e.g., 'syra_tenant__hmg-whh')  
**SECURITY NOTES:** None  
**QUALITY NOTES:** Handles long tenant names, generates short db names  
**USED?:**
- Direct references:
  - `lib/db/tenantDb.ts` (getTenantDbName)

---

#### FILE: lib/auth.ts
**TYPE:** lib [core]  
**PURPOSE:** Node.js runtime authentication functions (JWT, bcrypt)  
**ENTRYPOINTS:** Imported by API routes for token generation/password hashing  
**DEPENDENCIES:** 
- `jsonwebtoken`
- `bcryptjs`
- `@/lib/auth/edge` (TokenPayload type)
- `@/lib/env` (JWT_SECRET)
**OUTPUTS/SIDE EFFECTS:** 
- Generates JWT tokens
- Hashes/compares passwords
**TENANT CONTEXT:** N/A  
**SECURITY NOTES:** 
- Uses JWT_SECRET from env
- Password hashing with bcrypt (10 rounds)
**QUALITY NOTES:** Clean separation of Node.js vs Edge runtime auth  
**USED?:**
- Direct references:
  - `app/api/auth/login/route.ts` (generateToken, hashPassword, comparePassword)
  - `app/api/auth/change-password/route.ts` (hashPassword, comparePassword)

---

#### FILE: lib/auth/edge.ts
**TYPE:** lib [core]  
**PURPOSE:** Edge runtime JWT verification (uses jose library, works in Edge Runtime)  
**ENTRYPOINTS:** Imported by middleware and Edge-compatible code  
**DEPENDENCIES:** 
- `jose` (JWT library for Edge Runtime)
- `@/lib/env` (JWT_SECRET)
**OUTPUTS/SIDE EFFECTS:** Verifies JWT tokens  
**TENANT CONTEXT:** N/A  
**SECURITY NOTES:** Uses jose for Edge Runtime compatibility  
**QUALITY NOTES:** Separate from Node.js auth for Edge Runtime support  
**USED?:**
- Direct references:
  - `middleware.ts` (verifyTokenEdge)
  - `lib/auth/requireAuth.ts` (verifyTokenEdge)

---

#### FILE: lib/auth/requireAuth.ts
**TYPE:** lib [core]  
**PURPOSE:** Require authentication - reads from cookies, validates session, returns authenticated user context  
**ENTRYPOINTS:** Imported by all protected API routes  
**DEPENDENCIES:** 
- `@/lib/auth/edge` (verifyTokenEdge)
- `@/lib/auth/sessions` (validateSession, getSessionData)
- `@/lib/db.ts` (getCollection - legacy, should migrate)
- `@/lib/models/User` (User type)
**OUTPUTS/SIDE EFFECTS:** 
- Returns AuthenticatedUser or NextResponse (401/403)
- Validates session against DB
- Checks tenant status (blocked tenants cannot access)
**TENANT CONTEXT:** 
- **SINGLE SOURCE OF TRUTH:** tenantId comes from session.activeTenantId
- For syra-owner: tenantId is optional (can work without tenant)
- For others: tenantId is required
**SECURITY NOTES:** 
- Validates JWT token
- Validates session (single active session enforcement)
- Checks user isActive
- Checks tenant status (blocked)
**QUALITY NOTES:** 
- Well-documented
- Proper error handling
- **ISSUE:** Uses legacy `getCollection()` - should use platform/tenant DB helpers
**USED?:**
- Direct references:
  - Most API routes (via requireAuth or requireAuthContext)
  - `lib/auth/requireRole.ts` (requireAuth)
  - `lib/auth/requireTenant.ts` (requireAuth)

---

#### FILE: lib/auth/requireTenant.ts
**TYPE:** lib [core]  
**PURPOSE:** Require tenant ID from session (wrapper around requireAuth)  
**ENTRYPOINTS:** Imported by API routes that need tenantId  
**DEPENDENCIES:** 
- `@/lib/auth/requireAuth` (requireAuth)
**OUTPUTS/SIDE EFFECTS:** Returns tenantId string or NextResponse (401)  
**TENANT CONTEXT:** 
- **GOLDEN RULE:** tenantId must ALWAYS come from session, never from query/body
- Returns tenantId from session.activeTenantId
**SECURITY NOTES:** Validates authentication first  
**QUALITY NOTES:** Clear documentation of golden rule  
**USED?:**
- Direct references:
  - `lib/db/tenantDb.ts` (requireTenantId)
  - `lib/tenant.ts` (requireTenantId - re-export)

---

#### FILE: lib/auth/requireRole.ts
**TYPE:** lib [core]  
**PURPOSE:** Require specific role (wrapper around requireAuth)  
**ENTRYPOINTS:** Imported by API routes that need role checks  
**DEPENDENCIES:** 
- `@/lib/auth/requireAuth` (requireAuth)
- `@/lib/rbac` (Role type)
**OUTPUTS/SIDE EFFECTS:** Returns AuthenticatedUser with required role or NextResponse (403)  
**TENANT CONTEXT:** N/A  
**SECURITY NOTES:** Enforces role-based access  
**QUALITY NOTES:** Clean role checking  
**USED?:**
- Direct references:
  - `app/api/owner/*` routes (requireRole('syra-owner'))
  - `app/api/admin/*` routes (requireRole('admin'))

---

#### FILE: lib/auth/requireAuthContext.ts
**TYPE:** lib [core]  
**PURPOSE:** Require auth context (alias for requireAuth, for consistency)  
**ENTRYPOINTS:** Imported by code that needs auth context  
**DEPENDENCIES:** 
- `@/lib/auth/requireAuth` (requireAuth)
**OUTPUTS/SIDE EFFECTS:** Same as requireAuth  
**TENANT CONTEXT:** Same as requireAuth  
**SECURITY NOTES:** Same as requireAuth  
**QUALITY NOTES:** Alias for consistency  
**USED?:**
- Direct references:
  - `lib/db/tenantDb.ts` (requireAuthContext)

---

#### FILE: lib/auth/sessions.ts
**TYPE:** lib [core]  
**PURPOSE:** Session management (create, validate, get session data)  
**ENTRYPOINTS:** Imported by auth routes and requireAuth  
**DEPENDENCIES:** 
- `@/lib/db.ts` (getCollection - legacy)
- `uuid` (session ID generation)
**OUTPUTS/SIDE EFFECTS:** 
- Creates sessions in DB
- Validates sessions
- Gets session data (activeTenantId)
**TENANT CONTEXT:** 
- Sessions stored in tenant DB (or platform DB for syra-owner)
- Session contains activeTenantId (SINGLE SOURCE OF TRUTH)
**SECURITY NOTES:** 
- Single active session enforcement (activeSessionId in user record)
- Session expiration
**QUALITY NOTES:** 
- **ISSUE:** Uses legacy `getCollection()` - should use tenant/platform DB helpers
**USED?:**
- Direct references:
  - `app/api/auth/login/route.ts` (createSession)
  - `app/api/auth/logout/route.ts` (deleteSession)
  - `app/api/auth/switch-tenant/route.ts` (updateSession)
  - `lib/auth/requireAuth.ts` (validateSession, getSessionData)

---

#### FILE: lib/auth/sessionHelpers.ts
**TYPE:** lib [core]  
**PURPOSE:** Helper functions for session data extraction  
**ENTRYPOINTS:** Imported by requireTenant and other auth helpers  
**DEPENDENCIES:** 
- `@/lib/auth/sessions` (getSessionData)
**OUTPUTS/SIDE EFFECTS:** Gets activeTenantId from session  
**TENANT CONTEXT:** Returns activeTenantId from session  
**SECURITY NOTES:** None  
**QUALITY NOTES:** Clean helper functions  
**USED?:**
- Direct references:
  - `lib/tenant.ts` (getActiveTenantId)

---

#### FILE: lib/auth/getTenantIdOrThrow.ts
**TYPE:** lib [core]  
**PURPOSE:** Get tenantId or throw error (alternative to requireTenant)  
**ENTRYPOINTS:** Imported by code that needs tenantId and can throw  
**DEPENDENCIES:** 
- `@/lib/auth/sessionHelpers` (getActiveTenantId)
**OUTPUTS/SIDE EFFECTS:** Returns tenantId or throws  
**TENANT CONTEXT:** Gets tenantId from session  
**SECURITY NOTES:** None  
**QUALITY NOTES:** Alternative pattern to requireTenant  
**USED?:**
- Direct references: (need to search)

---

#### FILE: lib/tenant.ts
**TYPE:** lib [core]  
**PURPOSE:** Tenant helper functions (requireTenantId, getActiveTenantId)  
**ENTRYPOINTS:** Imported by code that needs tenant context  
**DEPENDENCIES:** 
- `@/lib/auth/sessionHelpers` (getActiveTenantId)
**OUTPUTS/SIDE EFFECTS:** Returns tenantId from session or error  
**TENANT CONTEXT:** 
- **SINGLE SOURCE OF TRUTH:** tenantId from session
- Re-exports requireTenantId from requireTenant
**SECURITY NOTES:** Validates authentication  
**QUALITY NOTES:** Central tenant helper module  
**USED?:**
- Direct references:
  - `lib/db/tenantDb.ts` (requireTenantId)
  - Many API routes

---

#### FILE: lib/rbac.ts
**TYPE:** lib [core]  
**PURPOSE:** Role-based access control definitions  
**ENTRYPOINTS:** Imported by models and auth helpers  
**DEPENDENCIES:** None  
**OUTPUTS/SIDE EFFECTS:** Defines Role type and role hierarchy  
**TENANT CONTEXT:** N/A  
**SECURITY NOTES:** Defines security roles  
**QUALITY NOTES:** Clear role definitions  
**USED?:**
- Direct references:
  - `lib/models/User.ts` (Role type)
  - `lib/auth/requireRole.ts` (Role type)
  - Many API routes and components

---

#### FILE: lib/db-tenant.ts
**TYPE:** lib [core]  
**PURPOSE:** Tenant-scoped collection wrapper that automatically injects tenantId into queries (different approach from tenantDb.ts)  
**ENTRYPOINTS:** Imported by routes that need tenant-filtered collections  
**DEPENDENCIES:** 
- `@/lib/db` (getCollection - legacy)
**OUTPUTS/SIDE EFFECTS:** 
- Wraps MongoDB collections with automatic tenantId filtering
- Logs tenant usage
**TENANT CONTEXT:** 
- **DIFFERENT APPROACH:** Instead of separate tenant DBs, this adds tenantId filter to all queries
- Uses same database (DB_NAME) but filters by tenantId field
- **CONFLICT:** This conflicts with the tenant DB separation approach in `lib/db/tenantDb.ts`
**SECURITY NOTES:** 
- Automatically injects tenantId into all queries
- Platform roles can use getPlatformCollection (bypasses tenant filtering)
**QUALITY NOTES:** 
- **ISSUE:** This is a DIFFERENT approach than tenant DB separation
- **CONFLICT:** Two different tenant isolation strategies exist:
  1. Separate databases per tenant (`lib/db/tenantDb.ts`)
  2. Single database with tenantId filtering (`lib/db-tenant.ts`)
- Should choose one approach and migrate
**USED?:**
- Direct references:
  - `app/api/nursing/operations/route.ts` (getTenantCollection)
  - `app/api/admin/delete-sample-data/route.ts` (getTenantCollection)
  - `app/api/admin/data-export/route.ts` (getTenantCollection, getPlatformCollection)

---

### 3.3 Duplicate Implementations

#### AUTHENTICATION DUPLICATES

**Issue:** Two separate authentication implementations exist:

1. **`lib/auth/requireAuth.ts`** (PRIMARY - used by 150+ files)
   - Main authentication implementation
   - Used by most API routes
   - Validates JWT, session, tenant status
   - Returns AuthenticatedUser with tenantId from session

2. **`lib/security/auth.ts`** (SECONDARY - used by 3 files only)
   - "Unified Authorization Guard System"
   - Enhanced security features (idle timeout, absolute lifetime)
   - Uses `validateSecureSession` from `lib/security/sessions`
   - **ONLY USED BY:**
     - `app/api/admin/users/route.ts`
     - `app/api/admin/users/[id]/platform-access/route.ts`
     - `app/api/admin/tenant-entitlements/route.ts`

**Recommendation:** 
- Migrate all routes to use `lib/security/auth.ts` (newer, enhanced)
- OR deprecate `lib/security/auth.ts` and enhance `lib/auth/requireAuth.ts`
- **Current state:** Mixed usage creates inconsistency

#### SESSION MANAGEMENT DUPLICATES

**Issue:** Two separate session management implementations exist:

1. **`lib/auth/sessions.ts`** (PRIMARY - used by auth routes)
   - Main session implementation
   - Used by: `app/api/auth/login`, `app/api/auth/logout`, `app/api/auth/switch-tenant`
   - Basic session creation/validation
   - Single active session enforcement

2. **`lib/security/sessions.ts`** (SECONDARY - used by security/auth.ts only)
   - Enhanced session management
   - Idle timeout (30 min default)
   - Absolute lifetime (24 hours default)
   - Session rotation support
   - Activity tracking
   - **ONLY USED BY:** `lib/security/auth.ts`

**Recommendation:**
- Migrate `lib/auth/sessions.ts` to use enhanced features from `lib/security/sessions.ts`
- OR consolidate into single implementation
- **Current state:** Two implementations with different features

#### DATABASE ACCESS PATTERNS

**Issue:** Three different database access patterns exist:

1. **`lib/db.ts`** (LEGACY - used by 150+ files)
   - Connects to single database (DB_NAME, defaults to 'hospital_ops')
   - NOT tenant-aware
   - Used throughout codebase (legacy)

2. **`lib/db/tenantDb.ts`** (NEW - tenant DB separation)
   - Separate database per tenant (`syra_tenant__{tenantKey}`)
   - Looks up tenant in platform DB to get dbName
   - Session-based tenant resolution
   - Used by newer routes

3. **`lib/db-tenant.ts`** (ALTERNATIVE - tenant filtering)
   - Single database with tenantId field filtering
   - Automatically injects tenantId into queries
   - Different approach than tenant DB separation
   - Used by 3 routes only

**Recommendation:**
- **CRITICAL:** Choose ONE approach:
  - Option A: Tenant DB separation (recommended for true isolation)
  - Option B: Single DB with tenantId filtering (simpler, less isolation)
- Migrate all routes from `lib/db.ts` to chosen approach
- **Current state:** Mixed patterns create confusion and potential security issues

---

## 4. Flow Maps

### 4.1 Authentication Flow

```
┌─────────────────┐
│  User Login     │
│  POST /api/auth │
│  /login         │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│ 1. Validate credentials        │
│    - Check email/password       │
│    - Get user from DB           │
│    - Verify password (bcrypt)   │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ 2. Tenant validation            │
│    - For syra-owner: optional   │
│    - For others: required       │
│    - Check tenant exists/active │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ 3. Create session               │
│    - Generate sessionId (UUID)  │
│    - Store in tenant DB         │
│    - Set activeTenantId         │
│    - Update user.activeSessionId │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ 4. Generate JWT token            │
│    - userId, role, email        │
│    - entitlements (from tenant) │
│    - sessionId                 │
│    - Expires: 7 days           │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ 5. Set cookies                 │
│    - auth-token (JWT)          │
│    - syra_platform (sam/health)│
│    - syra_tenant (tenantId)    │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ 6. Return user info            │
│    - user data                 │
│    - entitlements             │
│    - platforms available      │
└────────────────────────────────┘
```

### 4.2 Request Flow (Protected Route)

```
┌─────────────────┐
│  HTTP Request   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│ middleware.ts                   │
│ 1. Check public paths           │
│ 2. Get auth-token cookie        │
│ 3. Verify JWT (verifyTokenEdge) │
│ 4. Check role (syra-owner/admin)│
│ 5. Check platform cookie        │
│ 6. Enforce platform isolation   │
│ 7. Add user headers             │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ API Route Handler               │
│ requireAuth(request)            │
│  - Verify JWT                   │
│  - Validate session (DB)        │
│  - Get session data             │
│  - Get tenantId from session    │
│  - Check user active            │
│  - Check tenant status          │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ getTenantDbFromRequest(request) │
│  - requireTenantId (from session)│
│  - Lookup tenant in platform DB │
│  - Get dbName from tenant       │
│  - Connect to tenant DB         │
│  - Cache connection             │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Query Tenant DB                 │
│  - All queries scoped to tenant │
│  - tenantId from session only   │
│  - Return data                  │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Return Response                 │
└────────────────────────────────┘
```

### 4.3 Platform Selection Flow

```
┌─────────────────┐
│  User Logs In   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Compute Entitlements            │
│ - From tenant.entitlements     │
│ - From user.platformAccess     │
│ - Merge (user overrides tenant)│
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Check Available Platforms       │
│ - sam: entitlements.sam         │
│ - health: entitlements.health   │
│ - edrac: entitlements.edrac      │
│ - cvision: entitlements.cvision │
└────────┬────────────────────────┘
         │
         ├─── 0 platforms ───► Error (no access)
         ├─── 1 platform ───► Auto-select, set cookie, redirect
         └─── 2+ platforms ───►
                    │
                    ▼
         ┌─────────────────────────┐
         │ Show Platform Selector  │
         │ /platforms page         │
         └────────┬─────────────────┘
                  │
                  ▼
         ┌─────────────────────────┐
         │ User Selects Platform  │
         │ POST /api/platform/set  │
         └────────┬────────────────┘
                  │
                  ▼
         ┌─────────────────────────┐
         │ Set syra_platform cookie│
         │ Redirect to platform    │
         └─────────────────────────┘
```

### 4.4 Tenant Switching Flow (syra-owner only)

```
┌─────────────────┐
│ syra-owner User │
│ POST /api/auth  │
│ /switch-tenant   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│ requireAuth(request)            │
│ - Verify role = 'syra-owner'    │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Validate tenantId (query param) │
│ - Check tenant exists           │
│ - Check tenant is active        │
│ - Check user has access         │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Update Session                  │
│ - Update session.activeTenantId │
│ - Update session.tenantId      │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Return Success                  │
└────────────────────────────────┘
```

---

## 5. Cleanup Plan

### 5.1 Unused Files (Evidence-Based)

#### Root Markdown Files (127 files)

**Category: Implementation Status/Phase Reports**
- `PHASE1_COMPLETE.md`, `PHASE2_COMPLETE.md`, `PHASE3_COMPLETE.md`, etc.
- `PHASE4A_COMPLETE.md`, `PHASE4B_COMPLETE.md`, `PHASE4C1_COMPLETE.md`, etc.
- `PHASE5-1_COMPLETE.md`, `PHASE5-2_COMPLETE.md`, `PHASE5-3_COMPLETE.md`
- `PHASES_COMPLETE.md`
- **Status:** Historical documentation, not referenced in code
- **Recommendation:** Archive to `docs/archive/` or delete if no longer needed

**Category: Fix/Complete Reports**
- `ALL_FIXES_COMPLETE.md`, `FIX_404_ERRORS.md`, `FIX_500_ERROR_COMPLETE.md`
- `FIX_DELETE_500_ERROR.md`, `FIX_DELETE_POLICY_COMPLETE.md`
- `FIX_PREVIEW_AFTER_DELETE.md`, `FIX_PREVIEW_CLOSE_DEFINITIVE.md`
- `DELETE_COMPLETE_FIXED.md`, `DELETE_COMPLETE_VERIFIED.md`
- `DELETE_FINAL_FIX.md`, `DELETE_FIX_FINAL.md`
- **Status:** Historical fix documentation, not referenced in code
- **Recommendation:** Archive to `docs/archive/` or delete

**Category: Solution/Working Documents**
- `COMPLETE_SOLUTION.md`, `FINAL_SOLUTION.md`, `WORKING_SOLUTION.md`
- `SIMPLE_SOLUTION.md`, `SOLUTION.md`, `WORKING_NOW.md`
- **Status:** Historical solution documentation
- **Recommendation:** Archive or delete

**Category: Setup/Start Guides (Keep Important Ones)**
- `HOW_TO_START.md`, `QUICK_START.md`, `START_HERE_RENDER.md`
- `RENDER_QUICK_START.md`, `RENDER_SETUP_STEPS.md`
- `RUN_POLICY_ENGINE.md`, `RUN_POLICY_ENGINE_FINAL.md`
- **Status:** May be useful for onboarding
- **Recommendation:** Consolidate into single `QUICK_START.md`, archive others

**Category: Implementation Notes (Keep Important Ones)**
- `IMPLEMENTATION_NOTES.md`, `IMPLEMENTATION_PLAN.md`, `IMPLEMENTATION_STATUS.md`
- `IMPLEMENTATION_SUMMARY.md`
- **Status:** May contain useful architecture decisions
- **Recommendation:** Review and consolidate, archive duplicates

#### Backup Files

**Files:**
- `app/api/policies/[documentId]/route.ts.backup`
- `app/api/sam/policies/[documentId]/route.ts.backup`
- **Status:** Backup files, not used
- **Recommendation:** Delete (backups should be in git history)

#### Empty/Unused Directories

**Directories:**
- `_backup_routes/` (empty)
- `data/` (empty)
- `apps/` (unknown contents, may be unused)
- **Status:** Empty or unknown usage
- **Recommendation:** Delete if empty, audit `apps/` directory

### 5.2 Duplicate Code to Unify

#### Priority 1: Authentication Unification

**Current State:**
- `lib/auth/requireAuth.ts` - used by 150+ files (PRIMARY)
- `lib/security/auth.ts` - used by 3 files (SECONDARY, newer)

**Action Plan:**
1. **Option A (Recommended):** Migrate all routes to `lib/security/auth.ts`
   - Enhanced security features (idle timeout, absolute lifetime)
   - Better session management
   - More comprehensive
   - **Steps:**
     - Update `lib/security/auth.ts` to match all features of `lib/auth/requireAuth.ts`
     - Migrate routes one by one (start with low-risk routes)
     - Test thoroughly
     - Remove `lib/auth/requireAuth.ts` after migration

2. **Option B:** Enhance `lib/auth/requireAuth.ts` and deprecate `lib/security/auth.ts`
   - Keep existing implementation (less migration)
   - Add enhanced features to existing code
   - Migrate 3 routes using `lib/security/auth.ts` back to `lib/auth/requireAuth.ts`
   - Remove `lib/security/auth.ts`

**Recommendation:** Option A (migrate to enhanced security module)

#### Priority 2: Session Management Unification

**Current State:**
- `lib/auth/sessions.ts` - basic session management (PRIMARY)
- `lib/security/sessions.ts` - enhanced with idle/absolute timeout (SECONDARY)

**Action Plan:**
1. Merge enhanced features from `lib/security/sessions.ts` into `lib/auth/sessions.ts`
2. Update `lib/auth/sessions.ts` to use enhanced session model
3. Run migration script to update existing sessions
4. Remove `lib/security/sessions.ts` after migration

#### Priority 3: Database Access Pattern Unification

**Current State:**
- `lib/db.ts` - legacy, single DB (150+ usages)
- `lib/db/tenantDb.ts` - tenant DB separation (newer, recommended)
- `lib/db-tenant.ts` - tenant filtering approach (3 usages, different strategy)

**Action Plan:**
1. **Choose Strategy:** Tenant DB separation (recommended for true isolation)
2. **Migration Steps:**
   - Phase 1: Migrate new routes to `lib/db/tenantDb.ts`
   - Phase 2: Migrate high-priority routes (policies, admin, auth)
   - Phase 3: Migrate remaining routes
   - Phase 4: Remove `lib/db.ts` and `lib/db-tenant.ts`
3. **Data Migration:**
   - Migrate data from legacy DB to tenant DBs
   - Update all references

**Timeline:** Long-term (6+ months, requires careful planning)

### 5.3 Renames Needed

#### Package Name
- **Current:** `package.json` has `"name": "sam"`
- **Should be:** `"name": "syra"`
- **Impact:** Low (mainly for npm registry, if published)

#### Code References (Sira → Syra)
- **Status:** Migration scripts exist (`scripts/replace_sira_to_syra.cjs`, `scripts/verify_no_sira_left.cjs`)
- **Action:** Run verification script, fix any remaining references

### 5.4 Migration Cleanups

#### Migration Scripts
- **Location:** `scripts/migrations/`
- **Status:** Historical migrations (001-019)
- **Recommendation:** 
  - Keep recent migrations (015-019) if still needed
  - Archive old migrations (001-014) to `scripts/migrations/archive/`
  - Document which migrations have been applied

### 5.5 Logging Cleanup

#### Console.log Statements
- **Issue:** Many `console.log` statements throughout codebase
- **Action:**
  - Replace with structured logger (e.g., `lib/utils/logger.ts`)
  - Use log levels (debug, info, warn, error)
  - Remove sensitive data from logs
  - Add request ID for tracing

### 5.6 Testing Plan

#### Top 10 Tests to Add First

1. **Authentication Tests**
   - Login flow (success, failure, invalid credentials)
   - Session validation
   - Token expiration
   - Tenant isolation enforcement

2. **Tenant Isolation Tests**
   - User from tenant A cannot access tenant B data
   - Tenant DB separation works correctly
   - Session tenantId is enforced

3. **Platform Isolation Tests**
   - SAM user cannot access Health routes
   - Health user cannot access SAM routes
   - Platform cookie enforcement

4. **Role-Based Access Tests**
   - syra-owner can access /owner routes
   - admin can access /admin routes
   - Non-admin cannot access /admin routes

5. **Database Access Tests**
   - Tenant DB queries are scoped correctly
   - Platform DB queries work for syra-owner
   - Legacy DB migration path works

6. **API Route Tests**
   - Policy upload/download
   - User CRUD operations
   - OPD data operations

7. **Middleware Tests**
   - Public paths are accessible
   - Protected paths require auth
   - Platform isolation enforcement
   - Role-based redirects

8. **Session Management Tests**
   - Single active session enforcement
   - Session expiration
   - Session rotation

9. **Integration Tests**
   - Policy engine integration
   - OpenAI integration
   - MongoDB connection handling

10. **Security Tests**
    - CSRF protection
    - Rate limiting
    - Input validation
    - XSS prevention

### 5.7 Deletion Order (Least Risky First)

#### Batch 1: Backup Files (Zero Risk)
- `app/api/policies/[documentId]/route.ts.backup`
- `app/api/sam/policies/[documentId]/route.ts.backup`
- **Verification:** No imports found
- **Risk:** Zero

#### Batch 2: Empty Directories (Zero Risk)
- `_backup_routes/` (if empty)
- `data/` (if empty)
- **Verification:** Directory is empty
- **Risk:** Zero

#### Batch 3: Historical Documentation (Low Risk)
- Phase completion reports (PHASE*_COMPLETE.md)
- Fix completion reports (FIX_*_COMPLETE.md, DELETE_*_COMPLETE.md)
- Solution documents (SOLUTION.md, WORKING_SOLUTION.md, etc.)
- **Verification:** No code references
- **Risk:** Low (documentation only)

#### Batch 4: Duplicate Auth Implementation (Medium Risk)
- After migrating all routes to unified auth:
  - Remove `lib/auth/requireAuth.ts` (if migrating to security/auth.ts)
  - OR remove `lib/security/auth.ts` (if keeping auth/requireAuth.ts)
- **Verification:** All routes migrated, tests pass
- **Risk:** Medium (requires thorough testing)

#### Batch 5: Legacy Database Code (High Risk)
- After migrating all routes to tenant DB separation:
  - Remove `lib/db.ts`
  - Remove `lib/db-tenant.ts`
- **Verification:** All routes migrated, data migrated, tests pass
- **Risk:** High (requires data migration)

### 5.8 Acceptance Checks After Cleanup

#### Build Checks
- [ ] `yarn build` passes without errors
- [ ] `yarn typecheck` passes without errors
- [ ] No TypeScript errors
- [ ] No ESLint errors (or acceptable warnings)

#### Smoke Tests
- [ ] Login flow works
- [ ] Platform selection works
- [ ] Tenant switching works (syra-owner)
- [ ] Policy upload works
- [ ] OPD data operations work
- [ ] Admin user management works

#### Security Checks
- [ ] Tenant isolation enforced (user A cannot access tenant B data)
- [ ] Platform isolation enforced (SAM user cannot access Health routes)
- [ ] Role-based access enforced (admin-only routes protected)
- [ ] Session validation works
- [ ] JWT token validation works

#### Integration Checks
- [ ] Policy engine integration works
- [ ] OpenAI integration works (if configured)
- [ ] MongoDB connections work (platform + tenant DBs)

---

## 6. Summary Statistics

### File Counts
- **Total TypeScript/JavaScript files:** 516
- **Total Markdown files (root):** 127
- **Total API routes:** ~200+
- **Total Components:** ~100+
- **Total Library modules:** ~150+

### Code Patterns
- **Database access patterns:** 3 (legacy, tenant DB, tenant filtering)
- **Authentication implementations:** 2 (auth/, security/)
- **Session management implementations:** 2 (auth/, security/)

### Risk Assessment
- **High Risk:** Database access pattern unification (requires data migration)
- **Medium Risk:** Authentication unification (requires route migration)
- **Low Risk:** Documentation cleanup, backup file deletion

---

## 7. Import & Usage Index

### 7.1 lib/db.ts Usage (Legacy Database Access)

**Total References:** 150 files

**Purpose:** Legacy MongoDB connection helper connecting to single database (DB_NAME, defaults to 'hospital_ops'). NOT tenant-aware.

**Files Using This Module:**

#### Core Auth & Session Files
- `lib/auth/requireAuth.ts` - Gets users, sessions, tenants collections
- `lib/auth/sessions.ts` - Gets sessions collection
- `lib/auth/sessionHelpers.ts` - Gets session data
- `lib/security/auth.ts` - Gets users collection
- `lib/security/sessions.ts` - Gets sessions collection
- `lib/security/audit.ts` - Gets audit_logs collection

#### API Routes (150+ files)
**Auth Routes:**
- `app/api/auth/login/route.ts`
- `app/api/auth/logout/route.ts`
- `app/api/auth/switch-tenant/route.ts`
- `app/api/auth/identify/route.ts`
- `app/api/auth/change-password/route.ts`
- `app/api/auth/me/route.ts`
- `app/api/auth/dashboard-access/route.ts`

**Admin Routes:**
- `app/api/admin/users/route.ts`
- `app/api/admin/users/[id]/route.ts`
- `app/api/admin/users/[id]/platform-access/route.ts`
- `app/api/admin/groups/route.ts`
- `app/api/admin/groups/[id]/route.ts`
- `app/api/admin/hospitals/route.ts`
- `app/api/admin/hospitals/[id]/route.ts`
- `app/api/admin/quotas/route.ts`
- `app/api/admin/quotas/[id]/route.ts`
- `app/api/admin/structure/route.ts`
- `app/api/admin/audit/route.ts`
- `app/api/admin/tenant-entitlements/route.ts`
- `app/api/admin/integrations/route.ts`
- `app/api/admin/data-import/route.ts`
- `app/api/admin/data-export/route.ts`
- `app/api/admin/delete-sample-data/route.ts`
- `app/api/admin/delete-all-sample-data/route.ts`
- `app/api/admin/delete-all-opd-data/route.ts`
- All `app/api/admin/ehr/*` routes (10 files)
- All `app/api/admin/*` routes (orders, encounters, notes, patients, privileges, tasks)

**Policy Routes:**
- `app/api/policies/*` (all 15+ routes)
- `app/api/sam/policies/*` (all 15+ routes)

**OPD Routes:**
- `app/api/opd/*` (all 15+ routes)

**Patient Experience Routes:**
- `app/api/patient-experience/*` (all 10+ routes)

**ER Routes:**
- `app/api/er/*` (all 5+ routes)

**CDO Routes:**
- `app/api/cdo/*` (all 10+ routes)

**Other Routes:**
- `app/api/equipment/route.ts`
- `app/api/notifications/route.ts`
- `app/api/notifications/[id]/route.ts`
- `app/api/notifications/mark-all-read/route.ts`
- `app/api/nursing/*` routes
- `app/api/integrations/*` routes
- `app/api/risk-detector/*` routes
- `app/api/dashboard/stats/route.ts`
- `app/api/init/route.ts`

#### Library Files
- `lib/cdo/repositories/CDORepository.ts`
- `lib/cdo/repositories/ERRepository.ts`
- `lib/cdo/services/CDODashboardService.ts`
- `lib/integrations/auto-trigger.ts`
- `lib/integrations/process-policy-check.ts`
- `lib/integrations/settings.ts`
- `lib/opd/data-aggregator.ts`
- `lib/patient-experience/runSla.ts`
- `lib/reports/patientExperienceReport.ts`
- `lib/services/patientExperienceService.ts`
- `lib/services/structureService.ts`
- `lib/quota/guard.ts`
- `lib/quota/resolution.ts`
- `lib/utils/audit.ts`
- `lib/ehr/utils/audit.ts`
- `lib/system/bootstrap.ts`

**Migration Status:** ⚠️ **CRITICAL** - 150+ files still use legacy pattern. Migration to tenant/platform DB required.

---

### 7.2 lib/db-tenant.ts Usage (Tenant Filtering Pattern)

**Total References:** 3 files

**Purpose:** Tenant-scoped collection wrapper that automatically injects tenantId into queries. Uses single database with tenantId field filtering (different approach from tenant DB separation).

**Files Using This Module:**
- `app/api/nursing/operations/route.ts` - Uses `getTenantCollection`
- `app/api/admin/delete-sample-data/route.ts` - Uses `getTenantCollection`
- `app/api/admin/data-export/route.ts` - Uses `getTenantCollection` and `getPlatformCollection`

**Migration Status:** ⚠️ **CONFLICT** - This is an alternative tenant isolation strategy. Only 3 files use it. Decision needed: migrate to tenant DB separation or consolidate.

---

### 7.3 lib/db/tenantDb.ts Usage (Tenant DB Separation Pattern)

**Total References:** 3 files (direct), 124 files (via requireAuth/requireTenant)

**Purpose:** Tenant database connection using separate database per tenant. Session-based, looks up tenant from platform DB.

**Files Directly Using This Module:**
- `app/api/owner/tenants/route.ts` - Uses `getTenantDbByKey`
- `app/api/owner/tenants/[tenantId]/route.ts` - Uses `getTenantDbByKey`
- `app/api/patient-experience/seed-data/route.ts` - Uses `getTenantDbFromRequest`

**Files Indirectly Using (via requireAuth/requireTenant):**
- All routes that use `requireAuth()` or `requireTenant()` eventually call `getTenantDbFromRequest()` (124+ routes)

**Migration Status:** ✅ **RECOMMENDED** - This is the intended architecture. Most newer routes use this pattern.

---

### 7.4 lib/auth/requireAuth.ts Usage (PRIMARY Auth System)

**Total References:** 124 files

**Purpose:** Primary authentication implementation. Reads from cookies, validates session, returns authenticated user context.

**Files Using This Module:**

#### Direct Imports
- `lib/auth/requireRole.ts` - Wraps requireAuth
- `lib/auth/requireTenant.ts` - Wraps requireAuth
- `lib/auth/requireAuthContext.ts` - Alias for requireAuth
- `lib/db/tenantDb.ts` - Uses requireAuthContext

#### API Routes (120+ files)
**All protected API routes use this via:**
- Direct import: `import { requireAuth } from '@/lib/auth/requireAuth'`
- Via requireRole: `import { requireRole } from '@/lib/auth/requireRole'`
- Via requireTenant: `import { requireTenant } from '@/lib/auth/requireTenant'`

**Key Routes:**
- All `/api/policies/*` routes
- All `/api/sam/policies/*` routes
- All `/api/opd/*` routes
- All `/api/patient-experience/*` routes
- All `/api/admin/*` routes (except 3 that use security/auth.ts)
- All `/api/er/*` routes
- All `/api/cdo/*` routes
- All `/api/owner/*` routes
- All `/api/integrations/*` routes
- All `/api/risk-detector/*` routes
- And 50+ more routes

**Migration Status:** ⚠️ **PRIMARY** - This is the main auth system. 3 routes use alternative (`lib/security/auth.ts`). Unification needed.

---

### 7.5 lib/security/auth.ts Usage (SECONDARY Auth System)

**Total References:** 6 files (3 code files + 3 docs)

**Purpose:** "Unified Authorization Guard System" with enhanced security features (idle timeout, absolute lifetime). Alternative to `lib/auth/requireAuth.ts`.

**Files Using This Module:**
- `app/api/admin/users/route.ts` - Uses `requireAuth`, `requireRole`, `getRequestIP`, `getRequestUserAgent`
- `app/api/admin/users/[id]/platform-access/route.ts` - Uses `requireRole`
- `app/api/admin/tenant-entitlements/route.ts` - Uses `requireRole`
- `lib/security/example-route.ts.example` - Example usage
- `SECURITY.md` - Documentation
- `SECURITY_IMPLEMENTATION_SUMMARY.md` - Documentation

**Migration Status:** ⚠️ **SECONDARY** - Only 3 routes use this. Decision needed: migrate all to this (enhanced) or migrate these 3 back to requireAuth.ts.

---

### 7.6 lib/auth/sessions.ts Usage (PRIMARY Session System)

**Total References:** 6 files

**Purpose:** Primary session management (create, validate, get session data). Basic session creation/validation with single active session enforcement.

**Files Using This Module:**
- `app/api/auth/login/route.ts` - Uses `createSession`
- `app/api/auth/logout/route.ts` - Uses `deleteSession`
- `app/api/auth/switch-tenant/route.ts` - Uses `updateSession`
- `lib/auth/requireAuth.ts` - Uses `validateSession`, `getSessionData`
- `lib/auth/sessionHelpers.ts` - Uses `getSessionData`
- `app/api/init/route.ts` - Uses session functions

**Migration Status:** ⚠️ **PRIMARY** - This is the main session system. Enhanced version exists in `lib/security/sessions.ts` but not used.

---

### 7.7 lib/security/sessions.ts Usage (SECONDARY Session System)

**Total References:** 1 file

**Purpose:** Enhanced session management with idle timeout (30 min), absolute lifetime (24 hours), session rotation, activity tracking.

**Files Using This Module:**
- `lib/security/auth.ts` - Uses `validateSecureSession`, `createSecureSession`, `rotateSession`, `deleteSession`

**Migration Status:** ⚠️ **SECONDARY** - Only used by `lib/security/auth.ts`. Enhanced features not used by primary auth system. Unification needed.

---

## 8. Complete File-by-File Documentation

### 8.1 Core Library Files

#### FILE: lib/db.ts
**TYPE:** lib [core] [legacy]  
**PURPOSE:** Legacy MongoDB connection helper connecting to single database (DB_NAME, defaults to 'hospital_ops')  
**KEY EXPORTS:** `connectDB()`, `getCollection(name: string)`, `resetConnectionCache()`  
**IMPORTS USED BY:** 150 files (see Section 7.1)  
**SIDE EFFECTS:** Creates MongoDB connection, caches client/db  
**TENANT/PLATFORM CONTEXT:** Uses `DB_NAME` from env - NOT tenant-aware, NOT platform-aware  
**USED?:** **USED (confirmed)** - 150 files  
**RISK IF REMOVED:** **HIGH** - Core dependency for 150+ files  
**SUGGESTED ACTION:** **DEPRECATE** - Migrate all usages to tenant/platform DB helpers, then remove

---

#### FILE: lib/db/platformDb.ts
**TYPE:** lib [core]  
**PURPOSE:** Platform database connection (syra_platform)  
**KEY EXPORTS:** `getPlatformDb()`, `getPlatformCollection(name: string)`, `resetPlatformConnectionCache()`  
**IMPORTS USED BY:** 
- `lib/db/tenantDb.ts` (lookup tenant registry)
- `app/api/owner/tenants/*` routes (5 files)
- `app/api/platform/*` routes (3 files)
- `lib/system/bootstrap.ts`
**SIDE EFFECTS:** Creates MongoDB connection to 'syra_platform', caches client/db  
**TENANT/PLATFORM CONTEXT:** Platform DB contains tenant registry and owner users only  
**USED?:** **USED (confirmed)** - 9+ files  
**RISK IF REMOVED:** **HIGH** - Core platform infrastructure  
**SUGGESTED ACTION:** **KEEP** - This is the correct pattern for platform data

---

#### FILE: lib/db/tenantDb.ts
**TYPE:** lib [core]  
**PURPOSE:** Tenant database connection (session-based, looks up tenant from platform DB)  
**KEY EXPORTS:** `getTenantDbByKey(tenantKey)`, `getTenantDbFromRequest(request)`, `getTenantCollection(request, collectionName)`  
**IMPORTS USED BY:** 
- Direct: 3 files (see Section 7.3)
- Indirect: 124+ files via requireAuth/requireTenant
**SIDE EFFECTS:** Creates MongoDB connection to tenant DB, caches connections by tenantKey, logs tenant DB access  
**TENANT/PLATFORM CONTEXT:** **SINGLE SOURCE OF TRUTH** - tenantKey comes ONLY from session  
**USED?:** **USED (confirmed)** - 127+ files  
**RISK IF REMOVED:** **HIGH** - Core tenant isolation infrastructure  
**SUGGESTED ACTION:** **KEEP** - This is the recommended pattern for tenant data

---

#### FILE: lib/db-tenant.ts
**TYPE:** lib [core] [alternative]  
**PURPOSE:** Tenant-scoped collection wrapper that automatically injects tenantId into queries (different approach from tenantDb.ts)  
**KEY EXPORTS:** `getTenantCollection(collectionName, tenantId, routeName?)`, `getPlatformCollection(collectionName, userRole, routeName?)`  
**IMPORTS USED BY:** 3 files (see Section 7.2)  
**SIDE EFFECTS:** Wraps MongoDB collections with automatic tenantId filtering, logs tenant usage  
**TENANT/PLATFORM CONTEXT:** Uses same database (DB_NAME) but filters by tenantId field - **CONFLICTS** with tenant DB separation  
**USED?:** **USED (confirmed)** - 3 files only  
**RISK IF REMOVED:** **MEDIUM** - Only 3 files, but they are active routes  
**SUGGESTED ACTION:** **MERGE** - Migrate 3 files to tenant DB separation pattern, then remove

---

#### FILE: lib/auth/requireAuth.ts
**TYPE:** lib [core] [primary]  
**PURPOSE:** Primary authentication implementation - reads from cookies, validates session, returns authenticated user context  
**KEY EXPORTS:** `requireAuth(request)`, `AuthenticatedUser` interface  
**IMPORTS USED BY:** 124 files (see Section 7.4)  
**SIDE EFFECTS:** Returns AuthenticatedUser or NextResponse (401/403), validates session against DB, checks tenant status  
**TENANT/PLATFORM CONTEXT:** **SINGLE SOURCE OF TRUTH** - tenantId comes from session.activeTenantId  
**USED?:** **USED (confirmed)** - 124 files  
**RISK IF REMOVED:** **HIGH** - Core authentication for 124+ routes  
**SUGGESTED ACTION:** **KEEP** (or merge with security/auth.ts after unification) - Primary auth system

---

#### FILE: lib/security/auth.ts
**TYPE:** lib [core] [secondary]  
**PURPOSE:** "Unified Authorization Guard System" with enhanced security features  
**KEY EXPORTS:** `requireAuth(request)`, `requireRole(request, roles)`, `requireScope(request, scope)`, `getRequestIP(request)`, `getRequestUserAgent(request)`  
**IMPORTS USED BY:** 3 files (see Section 7.5)  
**SIDE EFFECTS:** Returns AuthenticatedUser or NextResponse, validates session with enhanced security checks  
**TENANT/PLATFORM CONTEXT:** tenantId ALWAYS from session.tenantId, never from user/body/query  
**USED?:** **USED (confirmed)** - 3 files only  
**RISK IF REMOVED:** **MEDIUM** - Only 3 files, but has enhanced features  
**SUGGESTED ACTION:** **MERGE** - Either migrate all routes to this (enhanced) OR migrate 3 routes back to requireAuth.ts and enhance it

---

#### FILE: lib/auth/sessions.ts
**TYPE:** lib [core] [primary]  
**PURPOSE:** Primary session management (create, validate, get session data)  
**KEY EXPORTS:** `createSession(userId, userAgent?, ip?, tenantId?, activeTenantId?)`, `validateSession(userId, sessionId)`, `getSessionData(request)`, `deleteSession(sessionId)`, `updateSession(sessionId, updates)`  
**IMPORTS USED BY:** 6 files (see Section 7.6)  
**SIDE EFFECTS:** Creates sessions in DB, validates sessions, gets session data (activeTenantId)  
**TENANT/PLATFORM CONTEXT:** Sessions stored in tenant DB (or platform DB for syra-owner)  
**USED?:** **USED (confirmed)** - 6 files  
**RISK IF REMOVED:** **HIGH** - Core session management  
**SUGGESTED ACTION:** **KEEP** (or merge enhanced features from security/sessions.ts)

---

#### FILE: lib/security/sessions.ts
**TYPE:** lib [core] [secondary]  
**PURPOSE:** Enhanced session management with idle timeout, absolute lifetime, session rotation  
**KEY EXPORTS:** `createSecureSession(userId, userAgent?, ip?, tenantId?)`, `validateSecureSession(userId, sessionId)`, `rotateSession(userId, oldSessionId, userAgent?, ip?)`, `deleteSession(sessionId)`, `deleteUserSessions(userId)`, `ensureSecureSessionIndexes()`  
**IMPORTS USED BY:** 1 file (lib/security/auth.ts)  
**SIDE EFFECTS:** Creates sessions with enhanced timeouts, validates with idle/absolute lifetime checks  
**TENANT/PLATFORM CONTEXT:** Same as lib/auth/sessions.ts  
**USED?:** **USED (confirmed)** - 1 file only  
**RISK IF REMOVED:** **LOW** - Only used by security/auth.ts  
**SUGGESTED ACTION:** **MERGE** - Merge enhanced features into lib/auth/sessions.ts, then remove

---

### 8.2 API Route Files (Summary Pattern)

**Note:** There are 200+ API route files. Below is a pattern-based summary. Individual routes follow the same structure.

#### Route File Pattern
**TYPE:** route  
**PURPOSE:** Handles HTTP requests for specific endpoint  
**KEY EXPORTS:** `GET(request)`, `POST(request)`, `PUT(request)`, `DELETE(request)`, `PATCH(request)`  
**IMPORTS USED BY:** Next.js routing system (automatic)  
**SIDE EFFECTS:** 
- Reads/writes to MongoDB (via getCollection, getTenantDbFromRequest, or getPlatformDb)
- Sets cookies (auth-token, syra_platform, syra_tenant)
- Returns JSON responses
**TENANT/PLATFORM CONTEXT:** 
- Most routes use `requireAuth()` → `getTenantDbFromRequest()` → tenant DB
- Owner routes use `getPlatformDb()` → platform DB
- Legacy routes use `getCollection()` → legacy DB (NOT tenant-aware)
**USED?:** **USED (confirmed)** - All routes are registered by Next.js file-based routing  
**RISK IF REMOVED:** **HIGH** - Breaks API endpoints  
**SUGGESTED ACTION:** **KEEP** - Active routes

**Route Categories:**
- **Auth Routes** (`app/api/auth/*`): 8 routes - Login, logout, session management
- **Admin Routes** (`app/api/admin/*`): 40+ routes - User management, data import/export, EHR operations
- **Policy Routes** (`app/api/policies/*`, `app/api/sam/policies/*`): 30+ routes - Policy CRUD, AI operations
- **OPD Routes** (`app/api/opd/*`): 15+ routes - OPD data operations
- **Patient Experience Routes** (`app/api/patient-experience/*`): 15+ routes - PX case management
- **ER Routes** (`app/api/er/*`): 8 routes - ER operations
- **CDO Routes** (`app/api/cdo/*`): 10 routes - Clinical decision optimization
- **Owner Routes** (`app/api/owner/*`): 8 routes - Platform owner operations
- **Other Routes**: 50+ routes - Equipment, notifications, integrations, etc.

---

### 8.3 Component Files

#### FILE: components/Header.tsx
**TYPE:** component [ui]  
**PURPOSE:** Top header component with user info and logout  
**KEY EXPORTS:** `Header` component  
**IMPORTS USED BY:** 
- `app/(dashboard)/layout.tsx`
- `components/shell/DesktopShell.tsx`
**SIDE EFFECTS:** Reads cookies (syra_platform), calls `/api/auth/logout`  
**TENANT/PLATFORM CONTEXT:** Displays platform info from cookie  
**USED?:** **USED (confirmed)** - 2 files  
**RISK IF REMOVED:** **MEDIUM** - Core UI component  
**SUGGESTED ACTION:** **KEEP**

---

#### FILE: components/Sidebar.tsx
**TYPE:** component [ui]  
**PURPOSE:** Navigation sidebar with menu items  
**KEY EXPORTS:** `Sidebar` component  
**IMPORTS USED BY:** 
- `app/(dashboard)/layout.tsx`
- `components/shell/DesktopShell.tsx`
**SIDE EFFECTS:** Navigation, reads platform cookie for route filtering  
**TENANT/PLATFORM CONTEXT:** Filters menu items based on platform  
**USED?:** **USED (confirmed)** - 2 files  
**RISK IF REMOVED:** **MEDIUM** - Core UI component  
**SUGGESTED ACTION:** **KEEP**

---

**Note:** All UI components in `components/ui/*` are shadcn/ui components. They are **USED (confirmed)** - imported by pages and other components. **SUGGESTED ACTION:** **KEEP** - Standard UI library components.

---

### 8.4 Script Files

#### FILE: scripts/bootstrapOwner.ts
**TYPE:** script [migration]  
**PURPOSE:** Bootstrap platform owner user  
**KEY EXPORTS:** None (executable script)  
**IMPORTS USED BY:** `yarn bootstrap:owner` script in package.json  
**SIDE EFFECTS:** Creates owner user in platform DB  
**TENANT/PLATFORM CONTEXT:** Uses platform DB  
**USED?:** **USED (confirmed)** - package.json script  
**RISK IF REMOVED:** **LOW** - One-time setup script  
**SUGGESTED ACTION:** **KEEP** - Useful for initial setup

---

#### FILE: scripts/migrations/*.ts
**TYPE:** script [migration]  
**PURPOSE:** Database migration scripts (001-019)  
**KEY EXPORTS:** None (executable scripts)  
**IMPORTS USED BY:** `yarn migrate:*` scripts in package.json  
**SIDE EFFECTS:** Modifies database schema/data  
**TENANT/PLATFORM CONTEXT:** Various (some migrate tenant data, some platform data)  
**USED?:** **USED (confirmed)** - package.json scripts  
**RISK IF REMOVED:** **MEDIUM** - Historical migrations, may be needed for new deployments  
**SUGGESTED ACTION:** **ARCHIVE** - Keep recent (015-019), archive old (001-014) to `scripts/migrations/archive/`

---

## 9. Deletion Candidate List

### 9.1 Backup Files (Zero Risk)

#### FILE: app/api/policies/[documentId]/route.ts.backup
**TYPE:** backup  
**EVIDENCE:** 
- No imports found: `grep -r "route.ts.backup" .` returns only file itself
- Not referenced in any code
- Backup file extension (.backup) indicates it's not used
**RISK:** **ZERO**  
**SUGGESTED ACTION:** **DELETE** - Backup files should be in git history, not filesystem

#### FILE: app/api/sam/policies/[documentId]/route.ts.backup
**TYPE:** backup  
**EVIDENCE:** 
- No imports found: `grep -r "route.ts.backup" .` returns only file itself
- Not referenced in any code
- Backup file extension (.backup) indicates it's not used
**RISK:** **ZERO**  
**SUGGESTED ACTION:** **DELETE** - Backup files should be in git history, not filesystem

---

### 9.2 Example Files (Low Risk)

#### FILE: lib/security/example-route.ts.example
**TYPE:** example  
**EVIDENCE:** 
- `.example` extension indicates it's documentation/example
- Not imported by any code
- Only referenced in SECURITY.md documentation
**RISK:** **LOW**  
**SUGGESTED ACTION:** **KEEP** - Useful as documentation/example, or move to `docs/examples/`

---

### 9.3 Empty/Unused Directories (Zero Risk)

#### DIRECTORY: _backup_routes/
**TYPE:** directory [unused]  
**EVIDENCE:** 
- Directory is empty (no files found)
- Not referenced in any code
**RISK:** **ZERO**  
**SUGGESTED ACTION:** **DELETE** - Empty directory serves no purpose

#### DIRECTORY: data/
**TYPE:** directory [unused]  
**EVIDENCE:** 
- Directory is empty (no files found)
- Not referenced in any code
**RISK:** **ZERO**  
**SUGGESTED ACTION:** **DELETE** - Empty directory serves no purpose

#### DIRECTORY: apps/
**TYPE:** directory [uncertain]  
**EVIDENCE:** 
- Unknown contents (not fully audited)
- May contain unused code
**RISK:** **UNCERTAIN**  
**SUGGESTED ACTION:** **AUDIT FIRST** - Check contents before deletion

---

### 9.4 Historical Documentation Files (Low Risk)

**Category:** Implementation Status/Phase Reports  
**Files:** 
- `PHASE1_COMPLETE.md`, `PHASE2_COMPLETE.md`, `PHASE3_COMPLETE.md`, `PHASE4A_COMPLETE.md`, `PHASE4B_COMPLETE.md`, `PHASE4C1_COMPLETE.md`, `PHASE4C2_COMPLETE.md`, `PHASE4C3_COMPLETE.md`, `PHASE4C4_COMPLETE.md`, `PHASE5-1_COMPLETE.md`, `PHASE5-2_COMPLETE.md`, `PHASE5-3_COMPLETE.md`, `PHASES_COMPLETE.md`

**EVIDENCE:** 
- No code references found
- Historical documentation only
- Not imported by any code
**RISK:** **LOW**  
**SUGGESTED ACTION:** **ARCHIVE** - Move to `docs/archive/phases/` or delete if no longer needed

**Category:** Fix/Complete Reports  
**Files:** 
- `ALL_FIXES_COMPLETE.md`, `FIX_404_ERRORS.md`, `FIX_500_ERROR_COMPLETE.md`, `FIX_DELETE_500_ERROR.md`, `FIX_DELETE_POLICY_COMPLETE.md`, `FIX_PREVIEW_AFTER_DELETE.md`, `FIX_PREVIEW_CLOSE_DEFINITIVE.md`, `DELETE_COMPLETE_FIXED.md`, `DELETE_COMPLETE_VERIFIED.md`, `DELETE_FINAL_FIX.md`, `DELETE_FIX_FINAL.md`, and 20+ more similar files

**EVIDENCE:** 
- No code references found
- Historical fix documentation only
**RISK:** **LOW**  
**SUGGESTED ACTION:** **ARCHIVE** - Move to `docs/archive/fixes/` or delete

**Category:** Solution/Working Documents  
**Files:** 
- `COMPLETE_SOLUTION.md`, `FINAL_SOLUTION.md`, `WORKING_SOLUTION.md`, `SIMPLE_SOLUTION.md`, `SOLUTION.md`, `WORKING_NOW.md`

**EVIDENCE:** 
- No code references found
- Historical solution documentation
**RISK:** **LOW**  
**SUGGESTED ACTION:** **ARCHIVE** - Move to `docs/archive/solutions/` or delete

---

### 9.5 Duplicate Implementations (Medium Risk - After Migration)

#### FILE: lib/security/auth.ts (After Unification)
**TYPE:** lib [duplicate]  
**EVIDENCE:** 
- Only 3 routes use this (vs 124 using requireAuth.ts)
- Duplicate functionality with lib/auth/requireAuth.ts
**RISK:** **MEDIUM** (after migration)  
**SUGGESTED ACTION:** **DELETE** (after migrating 3 routes to requireAuth.ts and enhancing it) OR **KEEP** (if migrating all routes to this enhanced version)

#### FILE: lib/security/sessions.ts (After Unification)
**TYPE:** lib [duplicate]  
**EVIDENCE:** 
- Only 1 file uses this (lib/security/auth.ts)
- Duplicate functionality with lib/auth/sessions.ts (but with enhanced features)
**RISK:** **MEDIUM** (after migration)  
**SUGGESTED ACTION:** **DELETE** (after merging enhanced features into lib/auth/sessions.ts)

#### FILE: lib/db-tenant.ts (After Migration)
**TYPE:** lib [duplicate]  
**EVIDENCE:** 
- Only 3 files use this
- Alternative tenant isolation strategy (conflicts with tenant DB separation)
**RISK:** **MEDIUM** (after migration)  
**SUGGESTED ACTION:** **DELETE** (after migrating 3 files to tenant DB separation pattern)

#### FILE: lib/db.ts (After Migration)
**TYPE:** lib [legacy]  
**EVIDENCE:** 
- 150 files use this
- Legacy pattern, NOT tenant-aware
**RISK:** **HIGH** (requires full migration)  
**SUGGESTED ACTION:** **DELETE** (after migrating all 150 files to tenant/platform DB helpers) - **LONG-TERM** (6+ months)

---

### 9.6 Test Files Status

#### FILE: __tests__/tenant-isolation.test.ts
**TYPE:** test  
**EVIDENCE:** 
- Test file exists
- Uses Jest/Vitest syntax
- Tests requireTenantId function
**RISK:** **NONE**  
**SUGGESTED ACTION:** **KEEP** - Active test file

**Note:** Test files in `__tests__/` are **USED (confirmed)** - part of test suite. **SUGGESTED ACTION:** **KEEP** - Active tests.

---

## 10. Architecture Decisions Pending

### 10.1 Authentication System Unification

**⚠️ Decision Required**

**Current State:**
- `lib/auth/requireAuth.ts` - PRIMARY (124 files)
- `lib/security/auth.ts` - SECONDARY (3 files, enhanced features)

**Options:**
1. **Migrate all to lib/security/auth.ts** (enhanced features)
2. **Migrate 3 routes back to lib/auth/requireAuth.ts** and enhance it
3. **Keep both** (not recommended - creates inconsistency)

**Recommendation:** Option 1 (migrate to enhanced security module)

---

### 10.2 Session System Unification

**⚠️ Decision Required**

**Current State:**
- `lib/auth/sessions.ts` - PRIMARY (basic)
- `lib/security/sessions.ts` - SECONDARY (enhanced: idle timeout, absolute lifetime)

**Options:**
1. **Merge enhanced features into lib/auth/sessions.ts**
2. **Migrate all to lib/security/sessions.ts**
3. **Keep both** (not recommended)

**Recommendation:** Option 1 (merge enhanced features into primary)

---

### 10.3 Tenant Isolation Strategy

**⚠️ Decision Required**

**Current State:**
- `lib/db/tenantDb.ts` - Tenant DB separation (recommended, 127+ files)
- `lib/db-tenant.ts` - Tenant filtering (alternative, 3 files)
- `lib/db.ts` - Legacy single DB (150 files, NOT tenant-aware)

**Options:**
1. **Tenant DB separation** (recommended for true isolation)
2. **Single DB with tenantId filtering** (simpler, less isolation)
3. **Hybrid** (not recommended - creates confusion)

**Recommendation:** Option 1 (tenant DB separation) - Migrate all to this pattern

---

### 10.4 User Storage Location

**⚠️ Decision Required**

**Current State:**
- Platform DB: syra-owner users
- Tenant DB: Regular users (per migration 014)
- Legacy DB: May still have users (per lib/db.ts usage)

**Options:**
1. **Platform DB for syra-owner, Tenant DB for others** (current intended architecture)
2. **All users in Platform DB** (simpler, but breaks tenant isolation)
3. **All users in Tenant DB** (better isolation, but syra-owner needs special handling)

**Recommendation:** Option 1 (current architecture) - Verify all routes use correct DB

---

## 11. Refactor Safety Rules

### 11.1 Must NOT Touch Without Migration

**HIGH RISK - Do NOT modify without migration plan:**
- `lib/db.ts` - 150 files depend on this
- `lib/auth/requireAuth.ts` - 124 files depend on this
- `lib/auth/sessions.ts` - 6 files depend on this
- `middleware.ts` - All routes depend on this
- Any route file in `app/api/*` - Active endpoints

---

### 11.2 Safe to Delete Immediately

**ZERO RISK:**
- `app/api/policies/[documentId]/route.ts.backup`
- `app/api/sam/policies/[documentId]/route.ts.backup`
- `_backup_routes/` directory (if empty)
- `data/` directory (if empty)

---

### 11.3 Requires Staged Deprecation

**MEDIUM RISK - Requires migration:**
- `lib/security/auth.ts` - After migrating 3 routes
- `lib/security/sessions.ts` - After merging features
- `lib/db-tenant.ts` - After migrating 3 routes
- Historical documentation files - Archive first, delete later

**HIGH RISK - Long-term migration:**
- `lib/db.ts` - After migrating 150 files (6+ months)

---

## 12. Testing Reality Check

### 12.1 Test Files Found

**Location:** `__tests__/`
- `tenant-isolation.test.ts` - Tests requireTenantId function
- `quota.test.ts` - Tests quota system
- `welcome.test.ts` - Tests welcome page
- `navigation-redirect.test.md` - Test documentation (markdown)

**Status:** ✅ **ACTIVE** - Test files exist and use Jest/Vitest syntax

### 12.2 Test Runner Configuration

**Status:** ⚠️ **UNCERTAIN** - Need to verify:
- Is Jest/Vitest configured in package.json?
- Are tests wired to CI/CD?
- Do tests run on `yarn test`?

**Current package.json:** `"test": "echo \"No tests specified\" && exit 0"` - **Tests are NOT wired**

**Recommendation:** Wire tests to test runner, add to CI/CD

---

**END OF COMPLETE DOCUMENTATION**

*This is a living document. Update as codebase evolves.*

