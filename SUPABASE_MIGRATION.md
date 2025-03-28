# Supabase Migration Guide

This document provides a comprehensive guide for migrating the application to use Supabase exclusively for all database operations. This migration resolves connectivity issues in production environments.

## Prerequisites

Before starting the migration, ensure you have:

1. A Supabase project set up with all required tables
2. The Supabase URL and API key
3. Network connectivity to Supabase services
4. Appropriate permissions for your Supabase API key

## Environment Variables

The application requires the following environment variables:

```
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your-supabase-api-key
SESSION_SECRET=your-session-secret
```

Notes:
- `SUPABASE_URL` - The URL of your Supabase project
- `SUPABASE_KEY` - Your Supabase project's service role API key (for server-side operations)
- `DATABASE_URL` - No longer required, removed from dependency

## Migration Steps

1. **Verify Supabase Connection**

   Run the connection test script:
   ```bash
   node test-supabase.js
   ```

   If this fails, run the network diagnostic script:
   ```bash
   node test-supabase-network.js
   ```

2. **Deploy the Updated Code**

   Execute the migration script:
   ```bash
   bash migrate-to-supabase.sh
   ```

   This script:
   - Verifies environment variables
   - Tests Supabase connectivity
   - Restarts the application
   - Tests API health endpoints

3. **Verify Application Health**

   Access the health check endpoints:
   ```
   GET /api/health
   GET /api/health/db
   GET /api/health/db/detail
   ```

   These endpoints provide detailed diagnostics about database connectivity.

## Key Changes

The migration includes the following key changes:

1. **Database Connectivity**
   - Removed PostgreSQL direct connection dependency
   - Updated all database operations to use Supabase client
   - Enhanced error handling for Supabase-specific errors

2. **Session Management**
   - Migrated from PostgreSQL session store to in-memory session store
   - This resolves authentication issues in production

3. **Error Handling**
   - Added specialized error handlers for database connectivity issues
   - Implemented automatic connection recovery mechanisms
   - Enhanced error logs with database-specific diagnostics

4. **Monitoring**
   - Added health check endpoints for application monitoring
   - Created diagnostic tools for connectivity troubleshooting
   - Implemented periodic database health checks

## Troubleshooting

If you encounter issues after migration:

1. **Database Connectivity Issues**
   - Verify Supabase credentials are correct
   - Check network connectivity with `test-supabase-network.js`
   - Ensure Supabase service is operational

2. **Authentication Problems**
   - Clear browser cookies and session data
   - Verify session secret is properly set
   - Check user permissions in Supabase dashboard

3. **Application Errors**
   - Check server logs for detailed error messages
   - Use the health check endpoints to diagnose specific issues
   - Verify Row Level Security (RLS) policies are properly configured

## Rollback Plan

If you need to rollback the migration:

1. Restore the previous code from version control
2. Ensure the `DATABASE_URL` environment variable is properly set
3. Restart the application

## Testing

After migration, test the following critical functionality:

1. User authentication (login/logout)
2. Document creation and retrieval
3. Project search and filtering
4. Budget operations
5. Admin functionality

## Support

For additional support:

- Consult the Supabase documentation: https://supabase.com/docs
- Check Supabase status: https://status.supabase.com/
- Refer to the test scripts for connectivity diagnostics