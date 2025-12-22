# Security Guidelines

## ⚠️ CRITICAL: Never Commit Secrets

**Secrets must NEVER be committed to the repository.**

This includes:
- API keys (OpenAI, etc.)
- Database connection strings with credentials
- JWT secrets
- Authentication tokens
- Private keys (.pem, .key files)
- Credentials files (credentials*.json, client_secret*.json)
- Environment files with real values (.env.local, .env.*.local)

## Environment Variables

### Required Variables

The following environment variables are **required** for the application to run:

- `MONGO_URL` - MongoDB connection string
- `JWT_SECRET` - Secret key for JWT token signing

### Optional Variables

- `DB_NAME` - Database name (defaults to 'hospital_ops')
- `OPENAI_API_KEY` - OpenAI API key (required for AI features)
- `CRON_SECRET` - Secret for protecting cron endpoints
- `CORS_ORIGINS` - Allowed CORS origins (defaults to '*')
- `POLICIES_DIR` - Policies storage directory (defaults to 'storage/policies')
- `TRANSLATION_PROVIDER` - Translation provider ('none' or 'openai')
- `OPENAI_TRANSLATION_MODEL` - Model for translations (defaults to 'gpt-4o-mini')
- `NEXT_PUBLIC_BASE_URL` - Public base URL (defaults to 'http://localhost:3000')

### Setup

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Fill in the required values in `.env.local`

3. **Never commit `.env.local`** - it's already in `.gitignore`

## Environment Variable Access

All server-side code should use the `env` module from `@/lib/env` instead of accessing `process.env` directly:

```typescript
import { env } from '@/lib/env';

// ✅ Correct
const mongoUrl = env.MONGO_URL;
const apiKey = env.OPENAI_API_KEY;

// ❌ Wrong - Don't do this
const mongoUrl = process.env.MONGO_URL;
```

The `env` module provides:
- Type-safe access to environment variables
- Runtime validation of required variables
- Clear error messages if required variables are missing
- Default values for optional variables

## What's Protected

The following files and patterns are excluded from git (see `.gitignore`):

- `.env.local`
- `.env.*.local`
- `*.pem`
- `*.key`
- `credentials*.json`
- `client_secret*.json`

## Rotating Compromised Credentials

If you discover that secrets have been committed to the repository:

1. **Immediately rotate all exposed credentials:**
   - Change MongoDB passwords
   - Regenerate JWT secrets
   - Rotate API keys

2. **Remove secrets from git history:**
   ```bash
   # Use git-filter-repo or BFG Repo-Cleaner to remove secrets from history
   # This requires force-pushing, so coordinate with your team
   ```

3. **Verify .gitignore is properly configured**

4. **Ensure all team members update their local .env.local files**

## Best Practices

1. ✅ Use `.env.local` for local development
2. ✅ Use platform environment variables for production (Render, Vercel, etc.)
3. ✅ Never hardcode secrets in source code
4. ✅ Use strong, randomly generated secrets (e.g., `openssl rand -base64 32`)
5. ✅ Review pull requests for accidental secret commits
6. ✅ Use secret scanning tools in CI/CD pipelines

## Reporting Security Issues

If you discover a security vulnerability, please report it privately to the project maintainers.

