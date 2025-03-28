# Supabase Migration Guide

This document outlines the process of migrating the application database from PostgreSQL (Neon DB) to Supabase.

## Architecture Changes

### Before Migration
```
┌─────────────────┐                     ┌─────────────────┐
│     Express     │                     │    Neon DB      │
│    Backend      │◄───────────────────►│  (PostgreSQL)   │
└────────┬────────┘                     └─────────────────┘
         │                                       ▲
         │                                       │
         ▼                                       │
┌─────────────────┐                     ┌────────┴────────┐
│     React       │                     │    Supabase     │
│    Frontend     │◄───────────────────►│    (Partial)    │
└─────────────────┘                     └─────────────────┘
```

### After Migration
```
┌─────────────────┐                     ┌─────────────────┐
│     Express     │                     │                 │
│    Backend      │◄───────────────────►│    Supabase     │
└────────┬────────┘                     │    Database     │
         │                              │                 │
         │                              │                 │
         ▼                              │                 │
┌─────────────────┐                     │                 │
│     React       │◄───────────────────►│                 │
│    Frontend     │                     └─────────────────┘
└─────────────────┘
```

## Key Changes

1. **Database Access**
   - All direct PostgreSQL calls replaced with Supabase client
   - `Pool` object removed, connection string (`DATABASE_URL`) no longer needed

2. **Session Management**
   - PostgreSQL session store (`connect-pg-simple`) replaced with in-memory store
   - Session data no longer persisted in database table

3. **Error Handling**
   - Enhanced Supabase error detection
   - Better production logging for database connectivity issues

4. **Client Configuration**
   - Simplified Supabase client setup
   - Disabled session persistence and auto-refresh for server usage 

## Environment Variables

### Required
- `SUPABASE_URL`: URL of your Supabase project
- `SUPABASE_KEY`: Service role key for your Supabase project
- `SESSION_SECRET`: Secret for session encryption
- `DATABASE_URL`: Derived PostgreSQL URL for Drizzle compatibility
  ```
  postgresql://postgres:[SUPABASE_KEY]@db.[project-ref].supabase.co:5432/postgres
  ```

### Optional
- `COOKIE_DOMAIN`: Domain for cross-origin cookies
- `VITE_SUPABASE_URL`: Supabase URL for frontend (if using direct access)
- `VITE_SUPABASE_KEY`: Anon key for frontend Supabase access

## Migration Process

1. **Pre-Migration**
   - Test Supabase connection with diagnostic script
   - Back up all database-related files
   - Verify environment variables

2. **Migration Steps**
   - Update database client configuration
   - Replace session store
   - Remove DATABASE_URL dependencies
   - Enhance error handling

3. **Post-Migration**
   - Restart application server
   - Test authentication flows
   - Verify document operations and other functionality

## Troubleshooting

For connectivity issues, run the network diagnostics:

```bash
node test-supabase-network.js
```

For detailed connection diagnostics:

```bash
node check-supabase-connection.js
```

## Reverting

If migration fails, restore files from the backup created by the deployment script:

```bash
cp supabase_migration_backup_*/server/config/db.ts server/config/db.ts
# etc.
```