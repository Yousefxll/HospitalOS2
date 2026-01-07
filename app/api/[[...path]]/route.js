import { v4 as uuidv4 } from 'uuid'
import { NextResponse } from 'next/server'
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

// OPTIONS handler for CORS
export async function OPTIONS() {
  return handleCORS(new NextResponse(null, { status: 200 }))
}

// Route handler function
async function handleRoute(request, { params }) {
  const { path = [] } = params
  const route = `/${path.join('/')}`
  const method = request.method

  try {
    // Require auth context for all operations
    // Dynamic import to handle ES modules in .js file
    const { requireAuthContext } = await import('@/lib/auth/requireAuthContext')
    const authContext = await requireAuthContext(request, true) // Allow platform access
    
    if (authContext instanceof NextResponse) {
      return handleCORS(authContext)
    }

    const { userRole, tenantId } = authContext

    // Restrict catch-all to platform roles only for security
    // This endpoint is high-risk - only platform roles can use it
    const isPlatformRole = ['syra-owner', 'platform', 'owner'].includes(userRole)
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
      const body = await request.json()
      
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

      await db.collection('status_checks').insertOne(statusObj)
      return handleCORS(NextResponse.json(statusObj))
    }

    // Status endpoints - GET /api/status (platform-only, no tenant filtering needed for status checks)
    if (route === '/status' && method === 'GET') {
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
}

// Export all HTTP methods
export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const DELETE = handleRoute
export const PATCH = handleRoute