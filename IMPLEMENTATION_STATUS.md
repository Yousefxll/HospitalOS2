# Security Hardening Pack - Implementation Status

This document tracks the implementation status of the Security Hardening Pack.

## ✅ Completed Infrastructure

### Core Security Modules
- ✅ `lib/security/config.ts` - Centralized security configuration
- ✅ `lib/security/cookies.ts` - Secure cookie utilities
- ✅ `lib/security/sessions.ts` - Enhanced session management (idle/absolute timeout)
- ✅ `lib/security/auth.ts` - Unified authorization guard system
- ✅ `lib/security/rateLimit.ts` - Rate limiting infrastructure
- ✅ `lib/security/csrf.ts` - CSRF protection
- ✅ `lib/security/headers.ts` - Security headers middleware
- ✅ `lib/security/validation.ts` - Input validation & sanitization
- ✅ `lib/security/audit.ts` - Audit logging infrastructure

### Models
- ✅ `lib/models/AuditLog.ts` - Audit log model
- ✅ Updated `lib/models/Session.ts` - Enhanced session model

### Documentation & Scripts
- ✅ `SECURITY.md` - Comprehensive security documentation
- ✅ `scripts/migrate-sessions.js` - Session model migration script
- ✅ `scripts/migrate-audit-logs.js` - Audit logs collection setup script

## 🚧 Integration Required

The following tasks require integration into existing routes:

### 1. Authentication & Session Security

**Status**: Infrastructure ready, needs route integration

**Tasks**:
- [ ] Update `app/api/auth/login/route.ts` to use:
  - `createSecureSession` instead of `createSession`
  - `setAuthCookie` from `lib/security/cookies`
  - Rate limiting with `rateLimitLogin`
  - Audit logging for login attempts
- [ ] Update `app/api/auth/logout/route.ts` to use:
  - `clearAuthCookie` from `lib/security/cookies`
  - Audit logging
- [ ] Update session validation in `lib/auth/requireAuth.ts` to use `validateSecureSession`

### 2. Authorization Guards

**Status**: Infrastructure ready, needs route integration

**Tasks**:
- [ ] Replace all instances of old `requireAuth`/`requireRole` with new unified guards from `lib/security/auth`
- [ ] Ensure all routes use `requireAuth` or `requireRole`/`requireScope`
- [ ] Verify tenant isolation: ensure `tenantId` is NEVER read from request body/query, only from session
- [ ] Add scope checks to routes that access group/hospital-scoped data

**Files to update** (examples):
- All routes in `app/api/admin/**`
- All routes in `app/api/patient-experience/**`
- All routes in `app/api/policies/**`
- All routes in `app/api/opd/**`
- All routes in `app/api/er/**`
- And others...

### 3. Rate Limiting

**Status**: Infrastructure ready, needs route integration

**Tasks**:
- [ ] Add `rateLimitLogin` to login route
- [ ] Add `rateLimitAPI` middleware to all API routes (or create wrapper)
- [ ] Add account lockout tracking

### 4. CSRF Protection

**Status**: Infrastructure ready, needs route integration

**Tasks**:
- [ ] Add CSRF token generation to login response
- [ ] Add `requireCSRF` middleware to all state-changing routes (POST/PUT/PATCH/DELETE)
- [ ] Update frontend to include CSRF token in requests

### 5. Security Headers

**Status**: Infrastructure ready, needs route integration

**Tasks**:
- [ ] Add `addSecurityHeaders` to all API route responses
- [ ] Add `handleCORSPreflight` for OPTIONS requests
- [ ] Update middleware.ts to add security headers

### 6. Input Validation

**Status**: Infrastructure ready, needs route integration

**Tasks**:
- [ ] Add Zod schemas for all request bodies
- [ ] Use `validateRequestBody` in all POST/PUT/PATCH routes
- [ ] Use `validateQueryParams` for query parameter validation
- [ ] Ensure all user-provided strings are sanitized before storage

### 7. Audit Logging

**Status**: Infrastructure ready, needs route integration

**Tasks**:
- [ ] Add audit logging to login/logout
- [ ] Add audit logging to user management operations
- [ ] Add audit logging to permission changes
- [ ] Add audit logging to access denied events
- [ ] Create admin API endpoint for querying audit logs (`/api/admin/audit`)

### 8. MFA (Multi-Factor Authentication)

**Status**: ⚠️ Not implemented - placeholder structure needed

**Tasks**:
- [ ] Install TOTP library (e.g., `otplib`, `speakeasy`)
- [ ] Create MFA models (UserMFA, BackupCode)
- [ ] Implement MFA enrollment API
- [ ] Implement MFA verification API
- [ ] Add MFA requirement middleware for admin roles
- [ ] Update login flow to require MFA for admin roles

**Note**: MFA is a larger feature that requires:
- Database schema changes
- UI components for QR code display
- Backup code generation and storage
- Integration into login flow

## 🔄 Migration Steps

### Step 1: Run Database Migrations

```bash
# Create audit logs collection and indexes
node scripts/migrate-audit-logs.js

# Update sessions collection with new indexes
node scripts/migrate-sessions.js
```

### Step 2: Update Environment Variables

Add security-related environment variables to `.env.local` (see SECURITY.md)

### Step 3: Gradual Route Integration

Start with high-priority routes:
1. Authentication routes (`/api/auth/*`)
2. Admin routes (`/api/admin/*`)
3. User management routes
4. Data access routes

For each route:
1. Import new security utilities
2. Replace old auth with new guards
3. Add rate limiting
4. Add CSRF protection
5. Add input validation
6. Add audit logging
7. Add security headers

### Step 4: Testing

Test each integrated route for:
- Authentication still works
- Authorization is enforced
- Rate limiting works
- CSRF protection works
- Input validation works
- Audit logs are created

## 📝 Notes

- The security infrastructure is designed to be backward compatible where possible
- Old `requireAuth`/`requireRole` functions still exist but should be migrated
- Session model changes are backward compatible (new fields are optional)
- Rate limiting uses in-memory store - consider Redis for production multi-instance deployments
- CSRF tokens are stored in cookies - ensure cookies are accessible to JavaScript on client

## 🎯 Priority Order

1. **Critical**: Authentication routes (login/logout) - immediate security impact
2. **High**: Admin routes - sensitive operations
3. **High**: Authorization guards - tenant isolation enforcement
4. **Medium**: Rate limiting - prevent abuse
5. **Medium**: CSRF protection - prevent cross-site attacks
6. **Medium**: Input validation - prevent injection attacks
7. **Low**: Audit logging - compliance and monitoring
8. **Future**: MFA - additional security layer for admins

## ⚠️ Breaking Changes

- Session model has new optional fields (backward compatible)
- Cookie settings changed to SameSite=Strict (may affect cross-site scenarios)
- CSRF protection will break existing API clients that don't send CSRF tokens
- Rate limiting may block legitimate high-volume users (adjust thresholds)

## 🔐 Security Considerations

- Secrets should NEVER be logged (already handled in error handling)
- tenantId MUST always come from session (enforced in auth guards)
- Rate limiting uses in-memory store - not suitable for distributed systems without Redis
- CSRF tokens should be rotated periodically (not yet implemented)
- MFA is required for admin roles but not yet implemented

