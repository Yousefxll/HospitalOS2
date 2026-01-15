import { v4 as uuidv4 } from 'uuid'
import { NextRequest, NextResponse } from 'next/server'
// Import env module (Next.js supports ES6 imports in .js files)
import { env } from '@/lib/env'

// Use shared MongoDB connection helper
async function connectToMongo() {
  // Dynamic import to handle ES modules in .js file
  const { getHospitalOpsClient } = await import('@/lib/db/mongo')
  const { db } = await getHospitalOpsClient()
  return db
}

// Helper function to handle CORS
function handleCORS(response) {
  response.headers.set('Access-Control-Allow-Origin', env.CORS_ORIGINS || '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  return response
}

// OPTIONS handler for CORS (public route)
export async function OPTIONS() {
  return handleCORS(new NextResponse(null, { status: 200 }))
}

// Route handler function wrapped with withAuthTenant
async function handleRoute(req, context) {
  // Dynamic import for withAuthTenant (ES modules in .js file)
  const { withAuthTenant } = await import('@/lib/core/guards/withAuthTenant')
  
  // Resolve params if it's a Promise
  const params = context?.params instanceof Promise ? await context.params : context?.params
  
  // Wrap handler with withAuthTenant for owner-scoped platform access
  return withAuthTenant(async (req, { user, tenantId, role }, params) => {
    const { path = [] } = params || {}
    const route = `/${Array.isArray(path) ? path.join('/') : ''}`
    const method = req.method

    try {
      // Restrict catch-all to platform roles only for security
      // This endpoint is high-risk - only platform roles can use it
      const isPlatformRole = ['syra-owner', 'platform', 'owner'].includes(role)
      if (!isPlatformRole || tenantId !== 'platform') {
        return handleCORS(NextResponse.json(
          { error: 'Forbidden', message: 'Platform access required for catch-all endpoint' },
          { status: 403 }
        ))
      }

      const db = await connectToMongo()

      // Root endpoint - GET /api/root (since /api/ is not accessible with catch-all)
      if (route === '/root' && method === 'GET') {
        return handleCORS(NextResponse.json({ message: "Hello World" }))
      }
      // Root endpoint - GET /api/root (since /api/ is not accessible with catch-all)
      if (route === '/' && method === 'GET') {
        return handleCORS(NextResponse.json({ message: "Hello World" }))
      }

      // Status endpoints - POST /api/status (platform-only, no tenant filtering needed for status checks)
      if (route === '/status' && method === 'POST') {
        const body = await req.json()
        
        if (!body.client_name) {
          return handleCORS(NextResponse.json(
            { error: "client_name is required" }, 
            { status: 400 }
          ))
        }

        const statusObj = {
          id: uuidv4(),
          client_name: body.client_name,
          timestamp: new Date()
        }

        // Platform-level status checks don't need tenantId filtering
        await db.collection('status_checks').insertOne(statusObj)
        return handleCORS(NextResponse.json(statusObj))
      }

      // Status endpoints - GET /api/status (platform-only, no tenant filtering needed for status checks)
      if (route === '/status' && method === 'GET') {
        // Platform-level status checks don't need tenantId filtering
        const statusChecks = await db.collection('status_checks')
          .find({})
          .limit(1000)
          .toArray()

        // Remove MongoDB's _id field from response
        const cleanedStatusChecks = statusChecks.map(({ _id, ...rest }) => rest)
        
        return handleCORS(NextResponse.json(cleanedStatusChecks))
      }

      // Route not found
      return handleCORS(NextResponse.json(
        { error: `Route ${route} not found` }, 
        { status: 404 }
      ))

    } catch (error) {
      console.error('API Error:', error)
      return handleCORS(NextResponse.json(
        { error: "Internal server error" }, 
        { status: 500 }
      ))
    }
  }, { ownerScoped: true, tenantScoped: false, permissionKey: 'platform.catch-all' })(req, { params })
}

// Export all HTTP methods with params support for catch-all routes
export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const DELETE = handleRoute
export const PATCH = handleRoute