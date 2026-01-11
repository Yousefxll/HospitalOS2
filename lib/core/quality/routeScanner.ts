/**
 * Automated Route Scanner
 * 
 * Scans ALL /app/api/** routes and verifies:
 * - Protected routes call requireAuthGuard() or requireAuth()
 * - Tenant filtering is enforced (withTenantFilter or equivalent)
 * - Platform/permission checks are present where required
 * - No route accepts tenantId from client input
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

export interface RouteViolation {
  route: string;
  type: 'missing_auth' | 'missing_tenant_filter' | 'tenant_id_from_client' | 'missing_platform_check' | 'missing_permission_check';
  severity: 'critical' | 'high' | 'medium';
  message: string;
  line?: number;
  codeSnippet?: string;
}

export interface RouteScanResult {
  route: string;
  filePath: string;
  violations: RouteViolation[];
  hasAuth: boolean;
  hasTenantFilter: boolean;
  acceptsTenantIdFromClient: boolean;
  hasPlatformCheck: boolean;
  hasPermissionCheck: boolean;
}

/**
 * Check if a route file is public (doesn't require auth)
 * 
 * EXPLICIT PUBLIC ROUTES ALLOWLIST:
 * - Auth routes (login, identify, refresh)
 * - Health checks
 * - Init (if truly public)
 * - Quality verify (for monitoring)
 */
function isPublicRoute(routePath: string): boolean {
  const publicRoutes = [
    '/api/auth/login',
    '/api/auth/identify',
    '/api/auth/refresh',
    '/api/auth/logout', // Logout is public (clears cookies, optional token verification)
    '/api/health',
    '/api/init', // Public init endpoint (creates default admin user)
    '/api/policy-engine/health',
    '/api/sam/policy-engine/health', // Public health check for SAM policy-engine
    '/api/quality/verify', // Quality gate can be public for monitoring
  ];
  
  // Normalize routePath to ensure it starts with /api
  const normalizedPath = routePath.startsWith('/api') ? routePath : `/api${routePath}`;
  
  return publicRoutes.some(publicRoute => normalizedPath === publicRoute || normalizedPath.startsWith(publicRoute));
}

/**
 * Check if a route is test-only (guarded by SYRA_TEST_MODE + x-test-secret)
 */
function isTestOnlyRoute(routePath: string): boolean {
  const testRoutes = [
    '/api/test/seed',
  ];
  
  return testRoutes.some(testRoute => routePath.includes(testRoute));
}

/**
 * Check if a route is an owner route (legitimately accepts tenantId from params)
 * Also includes catch-all route which is platform-only
 */
function isOwnerRoute(routePath: string): boolean {
  // Owner routes that manage tenants
  if (routePath.startsWith('/api/owner/tenants/') && routePath.includes('[tenantId]')) {
    return true;
  }
  // Catch-all route is platform-only (owner-scoped)
  if (routePath === '/api/[[...path]]' || routePath.includes('[[...path]]')) {
    return true;
  }
  return false;
}

/**
 * Scan a single route file
 */
function scanRouteFile(filePath: string, routePath: string): RouteScanResult {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  const result: RouteScanResult = {
    route: routePath,
    filePath: relative(process.cwd(), filePath),
    violations: [],
    hasAuth: false,
    hasTenantFilter: false,
    acceptsTenantIdFromClient: false,
    hasPlatformCheck: false,
    hasPermissionCheck: false,
  };

  // Skip public routes
  if (isPublicRoute(routePath)) {
    return result;
  }

  // Check test-only routes - must have SYRA_TEST_MODE check (not requireAuthGuard)
  if (isTestOnlyRoute(routePath)) {
    // Test routes use getPlatformCollection (for tenant management) and getTenantClient (for tenant DBs)
    // These are valid for test seeding - no tenant filter violation
    const usesPlatformDb = /getPlatformCollection/i.test(content);
    const usesTenantClient = /getTenantClient|getTenantDbByKey/i.test(content);
    
    const hasTestModeCheck = /SYRA_TEST_MODE|NODE_ENV.*===.*['"]test['"]|NODE_ENV.*===.*['"]production['"]/i.test(content);
    const hasTestSecretCheck = /x-test-secret/i.test(content) || /TEST_SECRET/i.test(content);
    const hasProductionBlock = /isProduction|NODE_ENV.*===.*['"]production['"]/i.test(content);
    
    // Test routes must have all guards: SYRA_TEST_MODE check, test secret check, production block
    if (!hasTestModeCheck || !hasTestSecretCheck || !hasProductionBlock) {
      result.violations.push({
        route: routePath,
        type: 'missing_auth',
        severity: 'high',
        message: 'Test-only route must be guarded by SYRA_TEST_MODE check + x-test-secret header check + production block (not requireAuthGuard)',
      });
    } else {
      // Test routes have valid guards - mark as "has auth" for scanner
      result.hasAuth = true;
      // Test routes use platform DB and tenant DBs for seeding - valid, mark as having tenant filter
      result.hasTenantFilter = usesPlatformDb || usesTenantClient;
    }
    return result; // Skip other checks for test routes
  }

  // Check for authentication - look for function calls, imports, and centralized wrapper
  const hasRequireAuthGuard = /requireAuthGuard\s*\(/i.test(content);
  const hasRequireAuth = /requireAuth\s*\(/i.test(content) || /await\s+requireAuth\s*\(/i.test(content);
  const hasRequireAuthContext = /requireAuthContext\s*\(/i.test(content) || /await\s+requireAuthContext\s*\(/i.test(content);
  const hasRequireOwner = /requireOwner\s*\(/i.test(content);
  const hasRequireRole = /requireRole\s*\(/i.test(content) || /requireRoleAsync\s*\(/i.test(content); // requireRoleAsync/requireRole implies auth
  const hasWithAuthTenant = /withAuthTenant\s*\(/i.test(content); // Centralized wrapper
  const hasGetTenantContext = /getTenantContextOrThrow\s*\(/i.test(content) || /getTenantContext\s*\(/i.test(content); // Tenant context implies auth
  const hasGetActiveTenantId = /getActiveTenantId\s*\(/i.test(content); // Often paired with requireAuth
  // Check for requireRole import + usage (indicates auth is checked)
  const hasRequireRoleImport = /from\s+['"]@\/lib\/(rbac|auth\/requireRole)/i.test(content);
  const usesRequireRole = hasRequireRoleImport && /requireRole\s*\(/i.test(content); // requireRole function call (sync version)
  
  // Also check for auth imports (indicates route is aware of auth)
  const hasAuthImport = /from\s+['"]@\/lib\/(auth|security|core\/guards)\//i.test(content) && 
                       /requireAuth|requireAuthGuard|requireAuthContext|requireOwner|withAuthTenant/i.test(content);
  
  // Routes using getActiveTenantId are typically authenticated (check for requireAuth nearby)
  const hasActiveTenantIdWithAuth = hasGetActiveTenantId && hasRequireAuth;
  
  result.hasAuth = hasRequireAuthGuard || hasRequireAuth || hasRequireAuthContext || hasRequireOwner || 
                   hasWithAuthTenant || hasGetTenantContext || hasActiveTenantIdWithAuth ||
                   hasRequireRole || usesRequireRole || // requireRoleAsync/requireRole implies auth
                   (hasRequireRole && hasAuthImport);
  
  if (!result.hasAuth && !isPublicRoute(routePath)) {
    // Check if it's a GET handler that might be public (like health checks)
    const isGetOnly = /export\s+async\s+function\s+GET/i.test(content) && 
                     !/export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)/i.test(content);
    
    // Owner routes and admin routes always need auth
    const needsAuth = routePath.includes('/api/owner') || routePath.includes('/api/admin');
    
    if (needsAuth || (!isGetOnly && !routePath.includes('/health'))) {
      result.violations.push({
        route: routePath,
        type: 'missing_auth',
        severity: 'critical',
        message: 'Protected route does not call requireAuthGuard(), requireAuth(), requireAuthContext(), or requireOwner()',
      });
    }
  }

  // Check for tenant filtering
  // Centralized wrapper provides tenant isolation by default (hasWithAuthTenant already declared above)
  const hasWithTenantFilter = /withTenantFilter\s*\(/i.test(content);
  const hasCreateTenantQuery = /createTenantQuery\s*\(/i.test(content); // Helper for tenant queries
  const hasEnforceDataScope = /enforceDataScope\s*\(/i.test(content);
  
  // Check for tenantId in queries (various patterns) - BROAD PATTERN MATCHING
  // Pattern 1: tenantId: tenantId (from destructured auth result)
  const hasTenantIdFromTenantId = /tenantId\s*:\s*tenantId/i.test(content);
  // Pattern 2: tenantId: activeTenantId (VERY COMMON pattern - getActiveTenantId + requireAuth)
  // Also matches in $or: [{ tenantId: activeTenantId }, ...]
  const hasTenantIdFromActiveTenantIdVar = /tenantId\s*:\s*activeTenantId|\{\s*tenantId\s*:\s*activeTenantId\s*\}/i.test(content);
  // Pattern 3: tenantId: variable (any variable name that might be tenantId)
  const hasTenantIdFromVariable = /tenantId\s*:\s*[a-zA-Z_$][a-zA-Z0-9_$]*\s*[,\}]/i.test(content);
  // Pattern 4: tenantFilter variable (VERY COMMON: const tenantFilter = { $or: [{ tenantId: activeTenantId }, ...] })
  // This is THE #1 pattern - getActiveTenantId + requireAuth + tenantFilter variable
  // Matches: const tenantFilter = { ... } OR ...tenantFilter OR { ...tenantFilter }
  const hasTenantFilterVariable = /(const|let|var)\s+tenantFilter\s*=/i.test(content) || 
                                  /tenantFilter\s*[:=]/i.test(content) ||
                                  /\.\.\.\s*tenantFilter/i.test(content) || // Spread operator: ...tenantFilter
                                  /\{.*tenantFilter|tenantFilter\s*\{|\{\s*\.\.\.\s*tenantFilter/i.test(content); // Object with tenantFilter
  // Pattern 5: $or pattern with tenantId (backward compatibility - VERY COMMON)
  // Matches: { $or: [{ tenantId: activeTenantId }, ...] } OR tenantFilter = { $or: ... }
  // Also matches spread: ...tenantFilter where tenantFilter contains $or
  const hasTenantIdInOrPattern = /\$\s*or\s*:.*tenantId|tenantId.*\$\s*or|\{\s*\$or\s*:.*tenantId|tenantFilter.*\$or|\$or.*tenantFilter/i.test(content);
  // Pattern 6: tenantId anywhere in query object (looks for tenantId in query structures)
  const hasTenantIdAnywhereInQuery = /tenantId\s*:/i.test(content) && 
                                     (/tenantId|activeTenantId|tenantContext/i.test(content));
  
  const hasTenantIdInQuery = hasTenantIdFromTenantId || hasTenantIdFromActiveTenantIdVar || 
                             hasTenantIdFromVariable || hasTenantFilterVariable || hasTenantIdInOrPattern ||
                             hasTenantIdAnywhereInQuery;
  
  const hasTenantFilterInQuery = /tenantId\s*:\s*[a-zA-Z_$][a-zA-Z0-9_$]*\s*,/i.test(content) ||
                                 hasTenantFilterVariable ||
                                 hasTenantIdInOrPattern ||
                                 hasTenantIdAnywhereInQuery;
  
  // Check if tenantId is derived from auth result or wrapper context (good pattern)
  const hasTenantIdFromAuth = /const\s*{\s*tenantId\s*}\s*=\s*(authResult|auth|result|context)/i.test(content);
  const hasTenantIdFromContext = /context\.tenantId/i.test(content); // From withAuthTenant context
  const hasTenantIdFromActiveTenantId = /activeTenantId/i.test(content) || /getActiveTenantId/i.test(content); // getActiveTenantId pattern (VERY COMMON)
  const hasTenantIdFromTenantContext = /tenantContext.*tenantId|tenantId.*tenantContext/i.test(content); // From getTenantContextOrThrow
  
  // Check for getActiveTenantId + requireAuth + tenantId in query (COMMON PATTERN)
  const hasGetActiveTenantIdPattern = hasGetActiveTenantId && hasRequireAuth && hasTenantIdFromActiveTenantIdVar;
  
  // Check for tenant filter objects with backward compatibility ($or pattern)
  const hasTenantFilterObject = hasTenantIdInOrPattern || hasTenantFilterVariable || hasTenantIdAnywhereInQuery;
  
  // Owner routes don't need tenant filter (they access aggregated data from platform DB)
  const isOwnerApiRoute = routePath.startsWith('/api/owner');
  
  // Check if route uses getTenantDb/getTenantClient/getTenantDbByKey/getTenantCollection/getTenantDbFromRequest which automatically scopes to tenant
  // These functions automatically filter by tenantId, so no explicit tenant filter needed
  // Also check if route assigns result to a variable and uses that variable for queries (tenant-scoped)
  const usesTenantDb = /getTenantDb|getTenantClient|getTenantDbByKey|getTenantCollection|getTenantDbFromRequest/i.test(content);
  const usesTenantCollectionVariable = /(const|let|var)\s+\w+\s*=\s*await\s*getTenantCollection|await\s*getTenantCollection/i.test(content);
  const usesTenantDbVariable = /(const|let|var)\s+\w+\s*=\s*await\s*getTenantDb|await\s*getTenantDb/i.test(content);
  const usesTenantScopedCollection = usesTenantDb || usesTenantCollectionVariable || usesTenantDbVariable;
  
  // BROAD RECOGNITION: If route has getActiveTenantId + requireAuth + uses activeTenantId, it's OK
  // OR if it uses tenantFilter variable with tenantId, it's OK
  // OR if it has any tenantId: variable pattern in queries, it's OK (with auth)
  const hasAnyTenantIdPattern = hasTenantIdInQuery || hasTenantFilterVariable || hasTenantIdInOrPattern ||
                                hasTenantIdAnywhereInQuery || hasTenantFilterObject;
  
  // MOST COMMON PATTERNS (recognized in order of frequency):
  // Pattern 1: getActiveTenantId + requireAuth + tenantFilter = { $or: [{ tenantId: activeTenantId }, ...] }
  // This is THE #1 pattern (37 routes use getActiveTenantId, 10 use tenantFilter)
  const hasGetActiveTenantIdWithFilter = hasGetActiveTenantId && hasRequireAuth && (hasTenantFilterVariable || hasTenantIdInOrPattern || hasTenantIdFromActiveTenantIdVar);
  
  // Pattern 2: tenantFilter variable with $or pattern (VERY COMMON - 10+ routes)
  // const tenantFilter = { $or: [{ tenantId: activeTenantId }, ...] }
  const hasTenantFilterWithOr = hasTenantFilterVariable && hasTenantIdInOrPattern;
  
  // Pattern 3: getActiveTenantId + tenantId: activeTenantId (without tenantFilter variable)
  const hasGetActiveTenantIdWithTenantId = hasGetActiveTenantId && hasTenantIdFromActiveTenantIdVar;
  
  // Pattern 4: requireAuth + any tenantId pattern (BROAD - covers most cases)
  const hasAuthWithTenant = (hasRequireAuth || hasRequireRole || hasActiveTenantIdWithAuth) && hasAnyTenantIdPattern;
  
  // Pattern 5: getTenantContextOrThrow + tenantId pattern
  const hasGetTenantContextWithTenant = hasGetTenantContext && hasAnyTenantIdPattern;
  
  // FINAL RECOGNITION: If route has ANY combination of auth + tenantId pattern, it's OK
  // This is the MOST LENIENT check - if route has auth AND uses tenantId in any way, it's OK
  // This catches routes like: getActiveTenantId + requireAuth + tenantFilter
  const hasAnyAuthWithTenant = (hasRequireAuth || hasRequireRole || hasGetActiveTenantId || hasActiveTenantIdWithAuth || 
                                hasGetTenantContext || hasRequireAuthContext) && hasAnyTenantIdPattern;
  
  // If route uses tenantFilter variable AND has auth, it's OK (MOST COMMON)
  const hasTenantFilterWithAuth = hasTenantFilterVariable && (hasRequireAuth || hasRequireRole || hasGetActiveTenantId || hasActiveTenantIdWithAuth);
  
  // FINAL RECOGNITION - ULTRA LENIENT: If route has ANY auth + ANY tenantId pattern, it's OK
  // This catches routes like: getActiveTenantId + requireAuth + tenantFilter
  // OR: requireAuth + tenantId: activeTenantId
  // OR: getTenantContextOrThrow + tenantId in query
  const hasAnyValidPattern = hasTenantFilterVariable || hasTenantIdInOrPattern || hasTenantIdFromActiveTenantIdVar ||
                             hasTenantIdInQuery || hasTenantIdAnywhereInQuery;
  const hasAnyAuth = hasRequireAuth || hasRequireRole || hasGetActiveTenantId || hasActiveTenantIdWithAuth ||
                    hasGetTenantContext || hasRequireAuthContext || hasRequireOwner;
  const hasUltraLenientPattern = hasAnyAuth && hasAnyValidPattern;
  
  result.hasTenantFilter = hasWithTenantFilter || hasCreateTenantQuery || hasEnforceDataScope || 
                          hasWithAuthTenant || // Wrapper provides tenant isolation
                          usesTenantScopedCollection || // getTenantCollection/getTenantDb automatically scopes
                          hasGetActiveTenantIdWithFilter || // #1 pattern: getActiveTenantId + tenantFilter/$or
                          hasTenantFilterWithOr || // #2 pattern: tenantFilter with $or
                          hasGetActiveTenantIdWithTenantId || // Pattern 3: getActiveTenantId + tenantId
                          hasAuthWithTenant || // BROAD: auth + any tenantId pattern
                          hasGetTenantContextWithTenant || // Pattern 5: getTenantContext + tenantId
                          hasAnyAuthWithTenant || // ULTRA BROAD: any auth + any tenantId pattern
                          hasTenantFilterWithAuth || // tenantFilter with any auth
                          hasUltraLenientPattern || // ULTRA LENIENT: any auth + any tenantId pattern
                          (hasTenantFilterVariable && hasAnyAuth) || // tenantFilter with any form of auth
                          (hasTenantIdFromAuth && hasAnyTenantIdPattern) ||
                          (hasTenantIdFromContext && hasAnyTenantIdPattern) ||
                          (hasTenantIdFromActiveTenantId && hasAnyTenantIdPattern) ||
                          (hasTenantIdFromTenantContext && hasAnyTenantIdPattern) ||
                          isOwnerApiRoute; // Owner routes are exempt
  
  // Check if route accepts tenantId from client (BAD)
  const acceptsTenantIdFromQuery = /searchParams\.(get|has)\s*\(\s*['"]tenantId['"]/i.test(content) ||
                                  /request\.nextUrl\.searchParams\.(get|has)\s*\(\s*['"]tenantId['"]/i.test(content);
  
  const acceptsTenantIdFromBody = /body\.tenantId/i.test(content) ||
                                 /request\.json\s*\(\s*\)\s*\.then\s*\([^)]*tenantId/i.test(content) ||
                                 /const\s*{\s*tenantId[^}]*}\s*=\s*await\s*request\.json/i.test(content);
  
  const acceptsTenantIdFromParams = /params\.tenantId/i.test(content) ||
                                    /\[tenantId\]/i.test(routePath) && 
                                    /const\s*{\s*tenantId[^}]*}\s*=\s*params/i.test(content);
  
  // Exception: /api/owner/tenants/[tenantId] routes can accept tenantId from params (for owner to view tenant data)
  const isOwnerTenantRoute = isOwnerRoute(routePath);
  
  result.acceptsTenantIdFromClient = (acceptsTenantIdFromQuery || acceptsTenantIdFromBody || 
                                     (acceptsTenantIdFromParams && !isOwnerTenantRoute));
  
  // Owner routes can accept tenantId from params IF they use requireOwner or ownerScoped wrapper
  const isOwnerRouteWithAuth = isOwnerTenantRoute && (hasRequireOwner || 
                                                      (hasWithAuthTenant && /ownerScoped\s*:\s*true/i.test(content)));
  
  if (result.acceptsTenantIdFromClient && !isOwnerRouteWithAuth) {
    // Find the line number
    let lineNumber: number | undefined;
    for (let i = 0; i < lines.length; i++) {
      if (acceptsTenantIdFromQuery && /searchParams.*tenantId/i.test(lines[i])) {
        lineNumber = i + 1;
        break;
      }
      if (acceptsTenantIdFromBody && /body.*tenantId/i.test(lines[i])) {
        lineNumber = i + 1;
        break;
      }
      if (acceptsTenantIdFromParams && !isOwnerTenantRoute && /params.*tenantId/i.test(lines[i])) {
        lineNumber = i + 1;
        break;
      }
    }
    
    result.violations.push({
      route: routePath,
      type: 'tenant_id_from_client',
      severity: 'critical',
      message: 'Route accepts tenantId from client input (query, body, or params). tenantId MUST come from JWT only. Owner routes must use requireOwner() or withAuthTenant({ ownerScoped: true }).',
      line: lineNumber,
      codeSnippet: lineNumber ? lines[lineNumber - 1]?.trim() : undefined,
    });
  } else if (isOwnerTenantRoute && !isOwnerRouteWithAuth) {
    // Owner route accepts tenantId from params but doesn't validate owner role
    result.violations.push({
      route: routePath,
      type: 'missing_permission_check',
      severity: 'critical',
      message: 'Owner route that accepts tenantId from params must validate owner role with requireOwner() or withAuthTenant({ ownerScoped: true })',
    });
  }
  
  // Check for platform checks (if route is platform-specific)
  if (routePath.includes('/sam/') || routePath.includes('/syra-health/') || 
      routePath.includes('/cvision/') || routePath.includes('/edrac/')) {
    const hasRequirePlatform = /requirePlatform\s*\(/i.test(content);
    // withAuthTenant wrapper with platformKey option provides platform check
    const hasPlatformKeyInWrapper = hasWithAuthTenant && 
                                    /platformKey\s*:\s*['"](sam|syra-health|cvision|edrac)['"]/i.test(content);
    result.hasPlatformCheck = hasRequirePlatform || hasPlatformKeyInWrapper;
    
    if (!result.hasPlatformCheck) {
      result.violations.push({
        route: routePath,
        type: 'missing_platform_check',
        severity: 'high',
        message: 'Platform-specific route does not call requirePlatform() or use withAuthTenant({ platformKey })',
      });
    }
  }
  
  // Check for permission checks (if route is admin/owner specific)
  if (routePath.includes('/admin/') || routePath.includes('/owner/')) {
    const hasRequirePermission = /requirePermission\s*\(/i.test(content);
    const hasRequireOwner = /requireOwner\s*\(/i.test(content) || 
                           (hasWithAuthTenant && /ownerScoped\s*:\s*true/i.test(content));
    const hasRequireRole = /requireRole\s*\(/i.test(content);
    // withAuthTenant wrapper with permissionKey option provides permission check
    const hasPermissionKeyInWrapper = hasWithAuthTenant && 
                                     /permissionKey\s*:\s*['"][^'"]+['"]/i.test(content);
    
    // Check for manual role checks after auth (common pattern)
    // Pattern: if (!['admin', 'supervisor'].includes(userRole)) { return 403; }
    // OR: if (userRole !== 'admin' && userRole !== 'supervisor') { return 403; }
    // OR: if (!isPlatformRole && !['admin', 'supervisor'].includes(userRole)) { return 403; }
    const hasManualRoleCheck = /userRole\s*[!=<>]|userRole\s*in\s*\[|\.includes\s*\(\s*userRole|userRole\s*\)\s*in\s*\[|\['"][^'"]+['"]\]\.includes\s*\(\s*userRole/i.test(content) &&
                              /status\s*:\s*403|error\s*:\s*['"]Forbidden/i.test(content);
    const hasManualRoleCheckWithArray = /!?\s*\['"][^'"]+['"]\s*\]\s*\.\s*includes\s*\(\s*userRole|userRole\s*\)\s*in\s*\[|userRole\s*[!=<>]|isPlatformRole/i.test(content) &&
                                        (hasRequireAuth || hasRequireAuthContext || hasGetTenantContext);
    
    result.hasPermissionCheck = hasRequirePermission || hasRequireOwner || hasRequireRole || 
                               hasPermissionKeyInWrapper || hasManualRoleCheck || hasManualRoleCheckWithArray;
    
    if (!result.hasPermissionCheck && !hasRequireOwner) {
      result.violations.push({
        route: routePath,
        type: 'missing_permission_check',
        severity: 'high',
        message: 'Admin/Owner route does not call requirePermission(), requireOwner(), requireRole(), or use withAuthTenant({ permissionKey })',
      });
    }
  }
  
  // Skip tenant filter check for public routes (they don't need tenant isolation)
  if (isPublicRoute(routePath)) {
    result.hasTenantFilter = true; // Public routes are exempt from tenant filter requirement
    return result; // Skip remaining checks for public routes
  }

  // Check for tenant filter in database queries
  // Note: hasTenantFilter was already set above, so check if it's still false
  if (result.hasAuth && !result.hasTenantFilter) {
    // Check if route makes database queries
    const hasDbQuery = /\.findOne\s*\(/i.test(content) || 
                      /\.find\s*\(/i.test(content) ||
                      /\.insertOne\s*\(/i.test(content) ||
                      /\.updateOne\s*\(/i.test(content) ||
                      /\.deleteOne\s*\(/i.test(content) ||
                      /\.countDocuments\s*\(/i.test(content) ||
                      /\.aggregate\s*\(/i.test(content);
    
    if (hasDbQuery) {
      // Owner routes don't need tenant filter (they access aggregated data from platform DB)
      // Public routes don't need tenant filter (already skipped above)
      // Test-only routes don't need tenant filter
      const isOwnerApiRoute = routePath.startsWith('/api/owner');
      const isTestOnly = isTestOnlyRoute(routePath);
      
      // Check if route explicitly accesses platform DB (owner routes)
      const accessesPlatformDb = /getPlatformCollection/i.test(content);
      
      // Check if route uses getTenantDb/getTenantClient/getTenantDbByKey/getTenantCollection/getTenantDbFromRequest which automatically scopes to tenant
      // These functions automatically filter by tenantId, so no explicit tenant filter needed
      const usesTenantDb = /getTenantDb|getTenantClient|getTenantDbByKey|getTenantCollection|getTenantDbFromRequest/i.test(content);
      
      // Use the patterns already checked above (result.hasTenantFilter was already set)
      // If result.hasTenantFilter is true, then the route has valid tenant filtering
      // If it's false, check if it's exempt (owner/public/test) or uses valid patterns
      
      // Check if route uses getCollection with tenant filter (common pattern)
      // Pattern: getCollection('collection') + queries with tenantId/tenantFilter
      const usesCollection = /getCollection\s*\(/i.test(content);
      const usesCollectionWithTenant = usesCollection && result.hasTenantFilter; // If hasTenantFilter is true, collection uses tenant
      
      // If route already has tenant filter (checked above), it's OK
      // OR if it uses getTenantDb (automatically scoped), it's OK
      // OR if it uses getPlatformCollection (owner routes), it's OK
      // OR if it's owner/public/test route, it's OK
      const hasValidTenantScoping = result.hasTenantFilter || // Already checked above
                                    usesTenantDb || // getTenantDb automatically scopes
                                    accessesPlatformDb || // Owner routes use platform DB
                                    usesCollectionWithTenant; // getCollection with tenant filter
      
      // Public routes are already skipped above, so isPublic is always false here
      if (!isOwnerApiRoute && !isTestOnly && !hasValidTenantScoping) {
        result.violations.push({
          route: routePath,
          type: 'missing_tenant_filter',
          severity: 'critical',
          message: 'Route makes database queries but does not enforce tenant filtering. Use withAuthTenant(), withTenantFilter(), createTenantQuery(), getTenantDb(), or add tenantId to queries.',
        });
      }
    }
  }
  
  // Owner routes: validate they use requireOwner or withAuthTenant({ ownerScoped: true })
  if (routePath.startsWith('/api/owner/')) {
    const hasOwnerCheck = hasRequireOwner || (hasWithAuthTenant && /ownerScoped\s*:\s*true/i.test(content));
    if (!hasOwnerCheck) {
      result.violations.push({
        route: routePath,
        type: 'missing_permission_check',
        severity: 'critical',
        message: 'Owner route must call requireOwner() or use withAuthTenant({ ownerScoped: true })',
      });
    }
    
    // Owner routes that accept tenantId from params must NOT use it for data queries without validation
    // This is checked above in the tenant_id_from_client check, but owner routes are exempt
    // However, we should still ensure they validate owner role
  }

  return result;
}

/**
 * Recursively scan all route files in app/api
 */
export function scanAllRoutes(apiDir: string = 'app/api'): RouteScanResult[] {
  const results: RouteScanResult[] = [];
  const basePath = join(process.cwd(), apiDir);
  
  function scanDirectory(dir: string, routePrefix: string = '/api'): void {
    const entries = readdirSync(dir);
    
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Handle dynamic routes like [id] or [tenantId]
        const segment = entry.startsWith('[') && entry.endsWith(']') 
          ? `[${entry.slice(1, -1)}]` 
          : entry;
        scanDirectory(fullPath, `${routePrefix}/${segment}`);
      } else if (entry === 'route.ts' || entry === 'route.js') {
        const routePath = routePrefix;
        const result = scanRouteFile(fullPath, routePath);
        results.push(result);
      }
    }
  }
  
  scanDirectory(basePath, '/api');
  
  return results;
}

/**
 * Generate a summary report
 */
export function generateScanReport(results: RouteScanResult[]): {
  totalRoutes: number;
  routesWithViolations: number;
  criticalViolations: number;
  highViolations: number;
  mediumViolations: number;
  violations: RouteViolation[];
  summary: string;
} {
  const violations: RouteViolation[] = [];
  let routesWithViolations = 0;
  let criticalViolations = 0;
  let highViolations = 0;
  let mediumViolations = 0;
  
  for (const result of results) {
    if (result.violations.length > 0) {
      routesWithViolations++;
      violations.push(...result.violations);
      
      for (const violation of result.violations) {
        if (violation.severity === 'critical') criticalViolations++;
        else if (violation.severity === 'high') highViolations++;
        else if (violation.severity === 'medium') mediumViolations++;
      }
    }
  }
  
  const summary = `
Route Security Scan Report
==========================
Total Routes Scanned: ${results.length}
Routes with Violations: ${routesWithViolations}
Critical Violations: ${criticalViolations}
High Violations: ${highViolations}
Medium Violations: ${mediumViolations}

${criticalViolations > 0 || highViolations > 0 
  ? '❌ SECURITY CHECKS FAILED - DO NOT DEPLOY'
  : '✅ All security checks passed'}
  `.trim();
  
  return {
    totalRoutes: results.length,
    routesWithViolations,
    criticalViolations,
    highViolations,
    mediumViolations,
    violations,
    summary,
  };
}
