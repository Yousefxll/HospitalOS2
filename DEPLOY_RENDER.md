# Render Deployment Guide

This guide ensures deterministic builds on Render.com.

## Package Manager

This project uses **yarn** as the package manager. The `packageManager` field in `package.json` enforces yarn v1.22.22.

**Important:** Only `yarn.lock` should be present. Do not commit `package-lock.json` or `pnpm-lock.yaml`.

## Node.js Version

- **Required:** Node.js 20.x (specified in `.nvmrc`)
- Render will automatically detect and use this version

## Build Configuration

### Render.yaml (Automated)

If using `render.yaml`, the configuration is:

```yaml
services:
  - type: web
    name: hospitalos
    env: node
    nodeVersion: 20
    buildCommand: yarn install --frozen-lockfile && yarn build
    startCommand: yarn start
```

### Manual Configuration

If configuring manually in Render Dashboard:

1. **Runtime:** Node
2. **Node Version:** 20
3. **Build Command:** `yarn install --frozen-lockfile && yarn build`
4. **Start Command:** `yarn start`

**Why `--frozen-lockfile`?**
- Ensures exact dependency versions from `yarn.lock`
- Prevents lockfile modifications during build
- Makes builds deterministic and reproducible

## Environment Variables

Required environment variables (set in Render Dashboard):

```env
MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
DB_NAME=hospital_ops
JWT_SECRET=your-super-secret-jwt-key-here-change-this
NEXT_PUBLIC_BASE_URL=https://your-app-name.onrender.com
```

Optional:
```env
OPENAI_API_KEY=sk-...
CRON_SECRET=your-cron-secret-here
CORS_ORIGINS=*
POLICIES_DIR=storage/policies
TRANSLATION_PROVIDER=none
OPENAI_TRANSLATION_MODEL=gpt-4o-mini
```

See `.env.example` for all available environment variables.

## SWC (Next.js Compiler)

Next.js automatically downloads the correct SWC binary for the build platform (Linux x64 on Render). No manual configuration needed.

If you encounter SWC download issues:
1. Ensure `node_modules` is in `.gitignore` (should not be committed)
2. Next.js will download the correct binary during `yarn install`
3. If issues persist, you can explicitly add `@next/swc-linux-x64-gnu` to dependencies (not recommended unless necessary)

## Build Troubleshooting

### "yarn: not found" Error

- Ensure `packageManager` field in `package.json` specifies yarn
- Render will automatically install the correct yarn version
- Check that `yarn.lock` exists in the repository

### Build Failures

1. **Check Node version:** Should be 20.x (check Render logs)
2. **Check lockfile:** Ensure `yarn.lock` is committed and not corrupted
3. **Check memory:** Free tier has limited memory; consider upgrading if build fails
4. **Check logs:** Review build logs in Render Dashboard for specific errors

### Dependencies Not Installing

- Ensure `yarn.lock` is committed to the repository
- Use `--frozen-lockfile` flag to prevent lockfile modifications
- Clear Render build cache if dependencies seem stale

## Local Development

To match the production environment:

1. Use Node.js 20.x (install via nvm: `nvm use`)
2. Use yarn: `yarn install`
3. Build: `yarn build`
4. Start: `yarn start`

## Deployment Checklist

- [ ] `yarn.lock` is committed
- [ ] `package-lock.json` is NOT committed (if exists, remove it)
- [ ] `.nvmrc` specifies Node 20
- [ ] `render.yaml` has correct build/start commands
- [ ] All required environment variables are set in Render
- [ ] `NEXT_PUBLIC_BASE_URL` matches your Render app URL
- [ ] MongoDB connection string is correct
- [ ] JWT_SECRET is set and secure

## After Deployment

1. Initialize database: `POST https://your-app.onrender.com/api/init`
2. Default admin credentials:
   - Email: `admin@hospital.com`
   - Password: `admin123`
   - **⚠️ Change password immediately after first login**

