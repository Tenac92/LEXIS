# Environment Configuration Guide

This document describes all environment variables used by the Lexis Budget Management System and how to configure them for different deployment scenarios.

## Quick Start

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in the required values based on your deployment environment (see sections below)

3. For development, minimal configuration is needed - just copy the file as-is

## Environment Variables Reference

### Core Deployment Settings

#### `NODE_ENV`
- **Type**: `'development' | 'production' | 'staging'`
- **Default**: `'development'`
- **Description**: Controls application behavior, security settings, and logging verbosity
- **Notes**:
  - `development`: Verbose logging, relaxed CORS, error stack traces in responses
  - `production`: Strict security headers, HTTPS required, minimal logging
  - `staging`: Similar to production but with some development features enabled

#### `PORT`
- **Type**: `number` (1024-65535)
- **Default**: `5000`
- **Description**: Server listening port
- **Notes**: Use 443 in production for HTTPS, or 80 for HTTP behind a reverse proxy

### Database & Supabase Configuration

#### `SUPABASE_URL` ⚠️ Required
- **Type**: `string` (URL)
- **Format**: `https://[project-id].supabase.co`
- **Description**: Supabase project URL
- **Where to find**: Supabase Dashboard → Settings → API
- **Notes**: Found in both client and server environments

#### `SUPABASE_ANON_KEY` ⚠️ Required
- **Type**: `string` (JWT token)
- **Description**: Public anon key for client-side Supabase operations
- **Where to find**: Supabase Dashboard → Settings → API
- **Security**: Safe to expose in frontend code
- **Notes**: Used for RLS (Row-Level Security) authenticated requests

#### `SUPABASE_SERVICE_KEY`
- **Type**: `string` (JWT token with elevated permissions)
- **Description**: Server-side service role key for admin operations
- **Where to find**: Supabase Dashboard → Settings → API
- **Security**: ⚠️ **SECRET** - Never expose in client code or version control
- **Notes**: 
  - Used for server-side database operations
  - Bypasses RLS policies
  - Required for migrations and admin operations

#### `SUPABASE_ANON_KEY` (fallback)
- **Type**: `string` (JWT token)
- **Description**: Can be used as fallback if SUPABASE_KEY not available
- **Notes**: Less secure than SUPABASE_SERVICE_KEY for server-side ops

#### `DATABASE_URL`
- **Type**: `string` (PostgreSQL connection string)
- **Format**: `postgresql://user:password@host:port/database`
- **Description**: Direct PostgreSQL connection (used if Supabase keys unavailable)
- **When used**: Fallback option for local development with direct DB access
- **Notes**:
  - Only needed if not using Supabase
  - Used by Drizzle ORM for migrations
  - Example: `postgresql://postgres:password@localhost:5432/lexis_budget`

### Security & Authentication

#### `SESSION_SECRET` ⚠️ Highly Sensitive
- **Type**: `string` (random hex string)
- **Length**: Minimum 32 characters recommended
- **Description**: Secret key for express-session encryption
- **Generation**: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- **Security**:
  - ⚠️ **CRITICAL** - Change this in production
  - If compromised, all sessions become vulnerable
  - Different secret = invalidates all existing sessions
  - Never commit to version control
- **Default fallback** (development only): `'document-manager-secret'`

#### `COOKIE_DOMAIN`
- **Type**: `string` (domain with leading dot)
- **Format**: `.example.com` or `example.com`
- **Description**: Domain scope for session cookies
- **When required**: Production deployments with subdomain cookies
- **Examples**:
  - `.sdegdaefk.gr` - cookie shared across all subdomains
  - `budget.sdegdaefk.gr` - cookie only for this subdomain
- **Notes**:
  - Leave empty for localhost/local testing
  - Required for cross-subdomain SSO in production
  - Affects cookie `secure` and `sameSite` flags:
    - Production: `secure=true, sameSite='none'`
    - Development: `secure=false, sameSite='lax'`

#### `AFM_KEY` ⚠️ Sensitive
- **Type**: `string` (encryption key)
- **Description**: Encryption key for Greek Tax ID (AFM) data
- **Usage**: Used by `server/utils/crypto.ts` for AFM encryption/decryption
- **Security**: 
  - Should be a strong random string
  - Different key = cannot decrypt previously encrypted AFMs
  - Store securely in production (e.g., AWS Secrets Manager)
- **Fallback** (development only): Uses SESSION_SECRET if AFM_KEY not set
- **Generation**: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### Logging Configuration

#### `LOG_LEVEL`
- **Type**: `'DEBUG' | 'INFO' | 'WARN' | 'ERROR'` (case-insensitive)
- **Default**: `'INFO'` in production, `'DEBUG'` in development
- **Description**: Minimum log level to output
- **Levels**:
  - `DEBUG`: Verbose tracing, all operations
  - `INFO`: Standard operation info, user actions
  - `WARN`: Warning conditions that should be reviewed
  - `ERROR`: Error conditions only
- **Usage**: Used by `server/utils/logger.ts`
- **Examples**:
  ```env
  LOG_LEVEL=DEBUG    # Development: verbose output
  LOG_LEVEL=WARN     # Production: only warnings and errors
  ```

### Deployment & URLs

#### `DEPLOYED_URL`
- **Type**: `string` (full HTTPS URL)
- **Format**: `https://domain.com` (no trailing slash)
- **Description**: Public URL where application is deployed
- **Examples**:
  - Local: Leave empty or `http://localhost:5000`
  - Staging: `https://budget-staging.sdegdaefk.gr`
  - Production: `https://budget.sdegdaefk.gr`
- **Usage**:
  - Security headers (HSTS, CSP origin validation)
  - CORS allowed origin
  - Email links and redirects
  - Password reset URLs
- **Notes**: Affects security posture - must match actual deployment URL

### Session Management

#### `SESSION_COOKIE_NAME`
- **Type**: `string` (alphanumeric)
- **Default**: `'sid'`
- **Description**: HTTP cookie name for session storage
- **Notes**: Only change if conflicts with other services on same domain

## Setup Instructions by Environment

### Local Development

Create `.env` with minimal configuration:

```env
NODE_ENV=development
PORT=5000

# Use Supabase development project
SUPABASE_URL=https://dev-project.supabase.co
SUPABASE_ANON_KEY=your-dev-anon-key
SUPABASE_SERVICE_KEY=your-dev-service-key

# Simple secrets for development
SESSION_SECRET=dev-session-secret-12345678901234567890
AFM_KEY=dev-afm-key-12345678901234567890

LOG_LEVEL=DEBUG
```

**Run**: `npm run dev`

### Staging Deployment

Create `.env` with staging configuration:

```env
NODE_ENV=production
PORT=5000

# Staging Supabase project
SUPABASE_URL=https://staging-project.supabase.co
SUPABASE_ANON_KEY=${STAGING_SUPABASE_ANON_KEY}
SUPABASE_SERVICE_KEY=${STAGING_SUPABASE_SERVICE_KEY}

# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_SECRET=${STAGING_SESSION_SECRET}
AFM_KEY=${STAGING_AFM_KEY}

COOKIE_DOMAIN=.staging-budget.sdegdaefk.gr
DEPLOYED_URL=https://budget-staging.sdegdaefk.gr

LOG_LEVEL=INFO
```

**Deploy**: 
```bash
npm run build
NODE_ENV=production node dist/index.js
```

### Production Deployment

Create `.env` with production configuration:

```env
NODE_ENV=production
PORT=5000

# Production Supabase project
SUPABASE_URL=https://prod-project.supabase.co
SUPABASE_ANON_KEY=${PROD_SUPABASE_ANON_KEY}
SUPABASE_SERVICE_KEY=${PROD_SUPABASE_SERVICE_KEY}

# CRITICAL: Use strong random secrets
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_SECRET=${PROD_SESSION_SECRET}
AFM_KEY=${PROD_AFM_KEY}

COOKIE_DOMAIN=.sdegdaefk.gr
DEPLOYED_URL=https://budget.sdegdaefk.gr

LOG_LEVEL=WARN
```

**Security Checklist**:
- ✅ All secrets generated with cryptographically secure randomness
- ✅ `.env` file excluded from git (see `.gitignore`)
- ✅ Secrets stored in production CI/CD secrets manager (GitHub Secrets, GitLab CI, etc.)
- ✅ NODE_ENV=production to enable all security headers
- ✅ COOKIE_DOMAIN set to production domain
- ✅ DEPLOYED_URL matches actual deployment URL
- ✅ LOG_LEVEL=WARN to reduce information disclosure

## Environment Variable Priority

When multiple sources are available, the system uses this priority:

1. **Environment variables** (highest priority)
2. **.env file** (loaded via dotenv)
3. **Hardcoded defaults** (lowest priority)

Example for database:
```
If SUPABASE_URL is set → use it
Else if DATABASE_URL is set → extract Supabase credentials
Else → fail with error
```

## Security Best Practices

### Never Commit Secrets
```bash
# Good: .gitignore entries
.env
.env.local
.env.*.local
```

### Use Different Secrets Per Environment
```bash
# Bad: same key everywhere
SESSION_SECRET=production-secret

# Good: unique per environment
PROD_SESSION_SECRET=<strong-random-key>
STAGING_SESSION_SECRET=<different-strong-key>
DEV_SESSION_SECRET=dev-key-ok-for-testing
```

### Rotate Secrets Regularly
- Session secrets: every 6-12 months
- Database keys: every 12 months
- AFM encryption keys: on demand if compromised

### Use Secrets Management in Production
```bash
# GitHub Actions example
PROD_SESSION_SECRET=${{ secrets.PROD_SESSION_SECRET }}
PROD_AFM_KEY=${{ secrets.PROD_AFM_KEY }}
```

### Enable HTTPS in Production
```env
NODE_ENV=production
COOKIE_DOMAIN=.sdegdaefk.gr  # Enables secure flag
DEPLOYED_URL=https://budget.sdegdaefk.gr  # Enables strict CSP
```

## Troubleshooting

### "SUPABASE_URL or SUPABASE_KEY not configured"
```
✓ Check .env file exists
✓ Verify SUPABASE_URL and SUPABASE_KEY are set
✓ Ensure no trailing spaces in values
✓ Check NODE_ENV is not preventing initialization
```

### "Session secret not configured"
```
✓ Check SESSION_SECRET is set
✓ Verify it's a non-empty string
✓ Generate new one if suspicious: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### "AFM decryption failed"
```
✓ Check AFM_KEY matches the one used when encrypting
✓ If you rotated AFM_KEY, old AFMs cannot be decrypted
✓ Consider maintaining old key for backward compatibility
```

### Cookies Not Persisting Across Requests
```
✓ Check SESSION_SECRET is consistent across restarts
✓ Verify COOKIE_DOMAIN matches your domain
✓ Check browser cookie settings allow third-party cookies
✓ Ensure HTTPS is used with secure flag
```

## Migration Guide: Local → Production

1. **Generate all production secrets**:
   ```bash
   node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
   node -e "console.log('AFM_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Update Supabase credentials** to production project

3. **Set domain-specific variables**:
   ```env
   COOKIE_DOMAIN=.sdegdaefk.gr
   DEPLOYED_URL=https://budget.sdegdaefk.gr
   ```

4. **Verify all values** before deployment:
   ```bash
   grep -E "^[A-Z_]+=" .env | grep -v "^NODE_ENV\|^PORT\|^LOG_LEVEL"
   # All should be filled, no defaults
   ```

5. **Test production build locally**:
   ```bash
   npm run build
   NODE_ENV=production node dist/index.js
   # Verify no errors, all services initialize
   ```

6. **Deploy with secrets** from CI/CD manager:
   ```bash
   npm run build
   PORT=5000 node dist/index.js
   # Environment variables injected by deployment platform
   ```

## See Also

- [Supabase Documentation](https://supabase.com/docs)
- [Node.js Environment Variables](https://nodejs.org/en/knowledge/file-system/how-to-use-the-path-module/)
- [Express.js Deployment Guide](https://expressjs.com/en/advanced/best-practice-security.html)
- [Project Security Guide](./SECURITY.md)
