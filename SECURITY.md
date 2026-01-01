# Security Hardening Pack - Implementation Guide

This document describes the security controls implemented in the HospitalOS application and how to configure them.

## Overview

The Security Hardening Pack provides enterprise-grade security controls including:
- Enhanced authentication and session management
- Comprehensive authorization guards with tenant isolation
- Rate limiting and brute force protection
- CSRF protection and security headers
- Input validation and sanitization
- Audit logging infrastructure
- Configurable security settings

## Configuration

### Environment Variables

Add the following environment variables to your `.env.local` file:

```bash
# Session Configuration
SESSION_ABSOLUTE_MAX_AGE_MS=86400000        # Maximum session lifetime (24 hours in ms)
SESSION_IDLE_TIMEOUT_MS=1800000             # Idle timeout (30 minutes in ms)

# Rate Limiting
RATE_LIMIT_LOGIN_MAX=5                      # Max login attempts per window
RATE_LIMIT_LOGIN_WINDOW_MS=900000           # Login rate limit window (15 minutes)
RATE_LIMIT_API_MAX=120                      # Max API requests per window
RATE_LIMIT_API_WINDOW_MS=60000              # API rate limit window (1 minute)
ACCOUNT_LOCKOUT_MAX_FAILED=5                # Failed attempts before lockout
ACCOUNT_LOCKOUT_DURATION_MS=1800000         # Lockout duration (30 minutes)

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com  # Comma-separated origins

# Security Headers
HSTS_MAX_AGE=31536000                       # HSTS max age (1 year in seconds)
CSP_REPORT_URI=https://yourdomain.com/csp-report  # Optional CSP report URI

# Audit Logging
AUDIT_LOG_RETENTION_DAYS=365                # How long to keep audit logs (days)

# MFA (Multi-Factor Authentication)
MFA_TOTP_ISSUER=HospitalOS                  # TOTP issuer name
```

### Default Values

If environment variables are not set, the following defaults are used:
- Session absolute max age: 24 hours
- Session idle timeout: 30 minutes
- Login rate limit: 5 attempts per 15 minutes
- API rate limit: 120 requests per minute
- Account lockout: 5 failed attempts, 30 minute lockout
- Audit log retention: 365 days

## Security Controls

### 1. Authentication & Session Security

#### Secure Cookies
- **HttpOnly**: Prevents JavaScript access to cookies (XSS protection)
- **Secure**: Only sent over HTTPS in production
- **SameSite=Strict**: Prevents CSRF attacks

#### Session Management
- **Idle Timeout**: Sessions expire after 30 minutes of inactivity (configurable)
- **Absolute Lifetime**: Sessions expire after 24 hours maximum (configurable)
- **Session Rotation**: Sessions are rotated on login and privilege changes

#### Implementation
Sessions are managed through `lib/security/sessions.ts`. The enhanced session model includes:
- `idleExpiresAt`: Idle timeout expiration
- `absoluteExpiresAt`: Absolute maximum lifetime
- `lastActivityAt`: Last activity timestamp

### 2. Authorization (RBAC + Scoping)

#### Unified Authorization Guards

All API routes should use the unified authorization system from `lib/security/auth.ts`:

```typescript
import { requireAuth, requireRole, requireScope } from '@/lib/security/auth';

// Basic authentication
const auth = await requireAuth(request);
if (auth instanceof NextResponse) {
  return auth; // Error response
}

// Role-based authorization
const auth = await requireRole(request, ['admin', 'group-admin']);
if (auth instanceof NextResponse) {
  return auth; // Error response
}

// Scope-based authorization
const auth = await requireScope(request, { groupId: 'group-123', hospitalId: 'hosp-456' });
if (auth instanceof NextResponse) {
  return auth; // Error response
}
```

#### Tenant Isolation

**CRITICAL**: `tenantId` must ALWAYS come from the session, never from:
- Request body
- Query parameters
- URL parameters
- Headers

The authorization system enforces this automatically. Any attempt to override tenantId from the request will be ignored.

#### Scope Enforcement Rules

- **Platform Admin (`admin`)**: Full access to all tenants/groups/hospitals
- **Group Admin (`group-admin`)**: Access only to their assigned group
- **Hospital Admin (`hospital-admin`)**: Access only to their assigned group and hospital
- **Other roles**: Inherit scope from their user record (groupId/hospitalId)

### 3. Rate Limiting & Brute Force Protection

#### Login Rate Limiting
- Default: 5 attempts per 15 minutes per IP/account
- Account lockout after max failed attempts
- Lockout duration: 30 minutes (configurable)

#### API Rate Limiting
- Default: 120 requests per minute per IP/account
- Applied to all `/api/*` endpoints

#### Implementation
Rate limiting is implemented in `lib/security/rateLimit.ts` using an in-memory store. For production deployments with multiple instances, consider using Redis-based rate limiting.

### 4. CSRF Protection

CSRF protection is implemented for all state-changing requests (POST, PUT, PATCH, DELETE).

#### Client-Side Implementation

The client must:
1. Include CSRF token in cookie (set automatically by server)
2. Send CSRF token in `X-CSRF-Token` header for API requests
3. Include CSRF token in form submissions

Example:
```typescript
// Get CSRF token from cookie
const csrfToken = document.cookie
  .split('; ')
  .find(row => row.startsWith('csrf-token='))
  ?.split('=')[1];

// Include in fetch requests
fetch('/api/endpoint', {
  method: 'POST',
  headers: {
    'X-CSRF-Token': csrfToken,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(data),
});
```

### 5. Security Headers

The following security headers are automatically added to all responses:

- **Strict-Transport-Security (HSTS)**: Enforces HTTPS
- **X-Frame-Options**: Prevents clickjacking
- **X-Content-Type-Options**: Prevents MIME sniffing
- **Referrer-Policy**: Controls referrer information
- **Permissions-Policy**: Restricts browser features
- **Content-Security-Policy (CSP)**: Prevents XSS and injection attacks

### 6. Input Validation & Sanitization

All input should be validated using Zod schemas and sanitized before processing:

```typescript
import { validateRequestBody } from '@/lib/security/validation';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
});

const result = await validateRequestBody(request, schema);
if (!result.success) {
  return result.response; // Validation error
}

const { name, email } = result.data; // Sanitized and validated
```

### 7. Audit Logging

All security-relevant events are logged to the `audit_logs` collection:

- Authentication events (login, logout, session expiration)
- Authorization events (access denied, scope violations)
- User management (create, update, delete, role changes)
- Permission changes
- Security events (rate limiting, account lockout)

#### Querying Audit Logs

Use the admin audit log API (requires admin role):
```
GET /api/admin/audit?startDate=...&endDate=...&action=...&userId=...
```

### 8. Error Handling

Errors never leak stack traces in production. Use the `handleError` utility:

```typescript
import { handleError } from '@/lib/security/validation';

try {
  // ... code ...
} catch (error) {
  const { message, details } = handleError(error);
  return NextResponse.json(
    { error: message, ...details },
    { status: 500 }
  );
}
```

## Migration Guide

### Database Changes

The Session model has been extended with new fields. Run the following migration:

```javascript
// Migration script: migrate-sessions.js
const { MongoClient } = require('mongodb');

async function migrateSessions() {
  const client = new MongoClient(process.env.MONGO_URL);
  await client.connect();
  const db = client.db(process.env.DB_NAME);
  const sessions = db.collection('sessions');

  // Add indexes for new fields
  await sessions.createIndex({ idleExpiresAt: 1 });
  await sessions.createIndex({ absoluteExpiresAt: 1 });

  console.log('Session migration complete');
  await client.close();
}

migrateSessions();
```

### Updating Existing Routes

1. Replace `requireAuth` imports from `@/lib/auth/requireAuth` to `@/lib/security/auth`
2. Replace `createSession` with `createSecureSession` from `@/lib/security/sessions`
3. Add rate limiting to login endpoint
4. Add CSRF protection to state-changing endpoints
5. Add security headers to responses
6. Add input validation using Zod schemas
7. Add audit logging for security events

## Testing

Security tests should verify:
- Tenant isolation (cross-tenant access is denied)
- Scope enforcement (users cannot access resources outside their scope)
- Rate limiting (excessive requests are blocked)
- CSRF protection (requests without CSRF token are rejected)
- Session expiration (idle and absolute timeouts work correctly)

## Monitoring

Monitor the following security metrics:
- Failed login attempts
- Account lockouts
- Rate limit violations
- Access denied events
- Session expiration events

Query the `audit_logs` collection for security event analysis.

## Production Checklist

Before deploying to production:

- [ ] Set all security environment variables
- [ ] Ensure HTTPS is enabled
- [ ] Configure CORS_ALLOWED_ORIGINS with actual domains
- [ ] Set strong JWT_SECRET (at least 32 characters, random)
- [ ] Configure CSP_REPORT_URI for CSP violation reporting
- [ ] Review and adjust rate limit thresholds
- [ ] Review and adjust session timeout values
- [ ] Enable audit log retention policy
- [ ] Test CSRF protection
- [ ] Test rate limiting
- [ ] Test session expiration
- [ ] Review security headers in browser dev tools

## Support

For security concerns or questions, contact the security team or refer to the codebase documentation in `lib/security/`.
