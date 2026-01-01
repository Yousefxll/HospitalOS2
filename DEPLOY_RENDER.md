# Render Deployment Guide

Complete guide for deploying SIRA to Render.com

## Service Configuration

### Service Type
- **Type**: Web Service
- **Region**: Choose closest to your MongoDB cluster

### Build & Start Commands

**Build Command:**
```bash
yarn build
```

**Start Command:**
```bash
yarn start
```

### Environment Variables

Set the following environment variables in Render Dashboard → Environment:

#### Required Variables

```bash
MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
JWT_SECRET=<generate-with-openssl-rand-base64-32>
DB_NAME=hospital_ops
```

**Generate JWT_SECRET:**
```bash
openssl rand -base64 32
```

#### Optional Variables (for AI features)

```bash
OPENAI_API_KEY=sk-...
POLICY_ENGINE_URL=http://localhost:8001
POLICY_ENGINE_TENANT_ID=default
NEXT_PUBLIC_BASE_URL=https://your-app-name.onrender.com
CORS_ORIGINS=https://your-app-name.onrender.com
```

### Node Version

- **Node Version**: 20.x (specified in `.nvmrc`)
- Render will automatically detect `.nvmrc` file

### Health Check

- **Health Check Path**: `/api/health`
- Render will automatically ping this endpoint to verify service health

### Root Directory

Leave empty (root of repository)

### Auto-Deploy

- Enable **Auto-Deploy** if connected to GitHub
- Deploys automatically on push to `main` branch

## MongoDB Setup (MongoDB Atlas)

1. Create a MongoDB Atlas cluster
2. Configure Network Access:
   - Add `0.0.0.0/0` for Render's IP ranges (or use Atlas IP whitelist)
   - Or better: Add specific Render IP addresses
3. Create a database user with read/write permissions
4. Get connection string: `mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority`
5. Set `MONGO_URL` in Render environment variables

## File Storage on Render

**Important**: Render's filesystem is ephemeral (resets on each deploy).

### Options:

1. **Use Render Persistent Disk** (Recommended for production)
   - Add a Persistent Disk service in Render
   - Mount it to your service
   - Update `POLICIES_DIR` to point to mounted disk

2. **Use Cloud Storage** (Recommended for scale)
   - AWS S3, Google Cloud Storage, or similar
   - Update policy upload code to use cloud storage
   - Keep only metadata in MongoDB

3. **Accept Ephemeral Storage** (Development only)
   - Files will be lost on redeploy
   - Only use for testing

## Initial Setup After Deployment

1. **Initialize Database**
   ```bash
   curl -X POST https://your-app-name.onrender.com/api/init
   ```

2. **Default Admin Credentials**
   - Email: `admin@hospital.com`
   - Password: `admin123`
   - **⚠️ Change password immediately after first login**

## Monitoring

- **Logs**: View in Render Dashboard → Logs
- **Metrics**: CPU, Memory, Response Time in Render Dashboard
- **Health Checks**: Render automatically monitors `/api/health`

## Troubleshooting

### Build Fails

- Check Node version (should be 20.x)
- Verify all dependencies are in `dependencies` (not `devDependencies`)
- Check build logs in Render Dashboard

### Runtime Errors

- Check environment variables are set correctly
- Verify MongoDB connection string
- Check health endpoint: `curl https://your-app-name.onrender.com/api/health`

### Database Connection Issues

- Verify MongoDB Atlas Network Access allows Render IPs
- Check connection string format
- Ensure database user has correct permissions

### 503 Service Unavailable

- Check `/api/health` endpoint response
- Verify database connection
- Check application logs

## Security Checklist

- ✅ Never commit `.env` files
- ✅ Use strong `JWT_SECRET` (32+ characters, random)
- ✅ Configure CORS_ORIGINS with actual domain
- ✅ Use HTTPS (Render provides automatically)
- ✅ Enable MongoDB authentication
- ✅ Restrict MongoDB network access
- ✅ Change default admin password immediately

## Scaling

### Horizontal Scaling

Render supports horizontal scaling:
- Increase instance count in Render Dashboard
- Each instance shares the same MongoDB connection
- Sessions use MongoDB (shared across instances)

### Vertical Scaling

- Upgrade instance type in Render Dashboard
- Recommended: At least 512MB RAM for production

## Backup & Recovery

### MongoDB Backups

- Configure MongoDB Atlas automated backups
- Regular point-in-time recovery available

### Application State

- All state stored in MongoDB
- No application-level backup needed (stateless)

## Support

For issues:
1. Check Render Dashboard logs
2. Check `/api/health` endpoint
3. Review MongoDB Atlas logs
4. See [SECURITY.md](./SECURITY.md) for security configuration

---

**Last Updated**: January 2025
