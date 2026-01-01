# Policy Engine Service Setup

## Overview

The Policy Engine is a **separate microservice** that handles policy document processing, AI-powered search, conflict detection, and other advanced policy features.

## Architecture

- **Next.js Application**: Main web application (runs on port 3000 locally, or on Render)
- **Policy Engine Service**: Separate Python/FastAPI service (runs on port 8001)
- **Communication**: Next.js API routes forward requests to Policy Engine service via HTTP

## Running Locally

### Option 1: Run Policy Engine Service Separately

1. Navigate to policy-engine directory (if it exists in the repo)
2. Install dependencies (Python/pip)
3. Start the service:
   ```bash
   # Example (adjust based on actual service)
   python -m uvicorn main:app --host 0.0.0.0 --port 8001
   ```

4. Verify it's running:
   ```bash
   curl http://localhost:8001/health
   ```

5. Update `.env.local`:
   ```bash
   POLICY_ENGINE_URL=http://localhost:8001
   POLICY_ENGINE_TENANT_ID=default
   ```

### Option 2: Disable Policy Engine Features

If you don't need Policy Engine features, the application will show appropriate error messages when trying to access policy features.

## Deployment on Render

### Option 1: Deploy as Separate Service (Recommended)

1. **Create a new Web Service** on Render for Policy Engine
2. Set environment variables:
   ```bash
   PORT=8001
   # Add other Policy Engine specific env vars
   ```
3. Set build/start commands for Policy Engine service
4. Get the service URL (e.g., `https://policy-engine-xxx.onrender.com`)
5. **Update Main App Environment Variables**:
   ```bash
   POLICY_ENGINE_URL=https://policy-engine-xxx.onrender.com
   POLICY_ENGINE_TENANT_ID=default
   ```

### Option 2: Run Both on Same Service (Not Recommended)

This is possible but not recommended due to:
- Different runtime requirements (Node.js vs Python)
- Resource constraints
- Complexity

## Current Status

- ✅ **Next.js Application**: Running on Render (brand-xl.com)
- ❌ **Policy Engine Service**: Not deployed/running
- **Result**: Policy features show "Service not available" errors

## Quick Fix Options

### Temporary: Hide Policy Features

If Policy Engine is not available, you can:
1. Comment out Policy navigation items in Sidebar
2. Add conditional rendering to hide Policy pages
3. Show a "Coming Soon" message instead

### Permanent: Deploy Policy Engine

1. Ensure Policy Engine service code is available
2. Deploy it as a separate Render service
3. Update `POLICY_ENGINE_URL` environment variable
4. Test connectivity

## Environment Variables

### Main Application (Next.js)
```bash
# Optional - defaults to http://localhost:8001
POLICY_ENGINE_URL=http://localhost:8001  # or https://your-policy-engine.onrender.com
POLICY_ENGINE_TENANT_ID=default
```

### Policy Engine Service (if separate)
```bash
PORT=8001
DATABASE_URL=...  # If Policy Engine uses its own DB
# Other Policy Engine specific variables
```

## Testing Connection

Test if Policy Engine is accessible:

```bash
# From main application
curl https://your-app.onrender.com/api/policy-engine/health
```

Should return:
```json
{
  "status": "healthy",
  "service": "policy-engine"
}
```

If it returns 503, Policy Engine is not accessible.

## Troubleshooting

### Error: "SIRA service is not available. Please ensure the service is running on port 8001."

**Causes:**
1. Policy Engine service is not running
2. `POLICY_ENGINE_URL` is incorrect
3. Network/firewall blocking connection
4. Service is down or crashed

**Solutions:**
1. Check if Policy Engine service is running (if local: `curl http://localhost:8001/health`)
2. Verify `POLICY_ENGINE_URL` environment variable
3. Check Policy Engine service logs
4. Test connectivity from main app to Policy Engine
5. If not needed, hide Policy features or show "Coming Soon"
