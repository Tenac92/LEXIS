# Supabase Migration Guide

This guide explains the migration from using both PostgreSQL (Neon DB) and Supabase to using exclusively Supabase for all database operations.

## What Changed

The application was previously using:
1. Direct PostgreSQL connection through `pg` package to connect to Neon DB
2. Supabase client for some operations

This created several issues:
- Multiple database connection pools causing conflicts
- Connection issues with Neon DB in production
- Database error handling inconsistencies
- Errors on sdegdaefk.gr domain when database connections failed

The migration removes all direct PostgreSQL connections and uses only Supabase, which provides:
- Better reliability in production
- More consistent error handling
- Improved security through Supabase's RLS (Row Level Security)
- Simplified database access pattern

## Migration Files

The following files have been updated to remove PostgreSQL dependency:

1. `server/config/db.ts` - Replaced with Supabase-only implementation
2. `server/drizzle.ts` - Updated to use Supabase instead of direct pg connections
3. `server/data/index.ts` - Consolidated to use only Supabase
4. `server/middleware/databaseErrorRecovery.ts` - Enhanced error handling for Supabase
5. `server/auth/index.ts` - Updated session store to use memory storage temporarily

## How to Apply Changes

Execute the migration script:

```bash
# Make sure the script is executable
chmod +x migrate-to-supabase.sh

# Run the migration script
./migrate-to-supabase.sh
```

After applying the changes, restart your application.

## Post-Migration Notes

1. **Session Management**: The session store has been temporarily changed to use in-memory storage. This means users will need to log in again after deployment.

2. **Environment Variables**: Make sure the following environment variables are set:
   - `SUPABASE_URL` - Your Supabase project URL
   - `SUPABASE_KEY` or `SUPABASE_ANON_KEY` - Your Supabase API key

3. **Error Handling**: The error recovery middleware has been updated to handle Supabase-specific errors.

4. **Special sdegdaefk.gr Handling**: The application maintains special error handling for the sdegdaefk.gr domain, returning user-friendly messages in Greek.

## Rollback Plan

If issues occur, you can restore the original files from the backup folder:

```bash
# Restore from backups
cp ./backups/db.ts.bak ./server/config/db.ts
cp ./backups/drizzle.ts.bak ./server/drizzle.ts
cp ./backups/data-index.ts.bak ./server/data/index.ts
cp ./backups/databaseErrorRecovery.ts.bak ./server/middleware/databaseErrorRecovery.ts
cp ./backups/auth-index.ts.bak ./server/auth/index.ts
```

## Future Improvements

1. Replace the in-memory session store with a Supabase-based session store.
2. Fully implement Row Level Security (RLS) in Supabase for enhanced data protection.
3. Create database triggers in Supabase to handle automatic record updates.