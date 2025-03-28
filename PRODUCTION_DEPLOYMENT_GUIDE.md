# Production Deployment Guide

This guide will help you deploy the Supabase migration changes to your production environment.

## Pre-Deployment Checks

1. **Verify Supabase Connection**
   - Run the diagnostic script to test your production server's connectivity to Supabase:
   ```bash
   node check-supabase-connection.js
   ```
   - Make sure it completes successfully before proceeding

2. **Set Up Environment Variables**
   - Ensure you have these environment variables configured in your production environment:
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_supabase_key
   SESSION_SECRET=your_session_secret
   
   # For Drizzle compatibility, add this derived URL:
   DATABASE_URL=postgresql://postgres:[SUPABASE_KEY]@db.[project-ref].supabase.co:5432/postgres
   ```
   
   - Replace `[SUPABASE_KEY]` with your actual Supabase key
   - Replace `[project-ref]` with your Supabase project reference (from the URL)
   - Keep this DATABASE_URL for Drizzle compatibility even though we're using Supabase client for data access

## Deployment Steps

### Option 1: Using the Deployment Script

1. **Upload the deployment script**
   ```bash
   scp deploy-supabase-migration.sh user@your-production-server:/path/to/app/
   ```

2. **Make the script executable**
   ```bash
   chmod +x deploy-supabase-migration.sh
   ```

3. **Run the deployment script**
   ```bash
   ./deploy-supabase-migration.sh
   ```

4. **Restart your application**
   - This depends on how your application is hosted, common methods include:
   ```bash
   # For PM2
   pm2 restart your-app
   
   # For systemd
   sudo systemctl restart your-app.service
   ```

### Option 2: Manual File Updates

1. **Backup current files**
   ```bash
   mkdir -p backup_before_supabase
   cp server/config/db.ts server/drizzle.ts server/middleware/databaseErrorRecovery.ts server/index.ts server/storage.ts backup_before_supabase/
   ```

2. **Update core files**
   - Upload all updated files from your development environment to production

3. **Verify updates**
   - Double-check that the files were updated correctly:
   ```bash
   # Confirm DATABASE_URL reference is removed
   grep -r "DATABASE_URL" server/index.ts
   
   # Check for Supabase configuration
   grep -r "persistSession" server/config/db.ts
   ```

4. **Restart your application server**

## Post-Deployment Verification

1. **Check Application Logs**
   ```bash
   # For PM2
   pm2 logs your-app
   
   # For systemd
   journalctl -u your-app.service -f
   ```
   
2. **Look for Database Connection Messages**
   - Watch for successful connection messages:
   ```
   [Database] Supabase connection successfully verified
   ```
   
3. **Test Application Functionality**
   - Verify login works
   - Verify document operations work
   - Check other critical features

## Troubleshooting

### Common Issues and Solutions

1. **Application doesn't start**
   - Check logs for specific errors
   - Verify environment variables are set correctly

2. **Database connection errors**
   - Run the diagnostic script to check connectivity
   - Check firewall rules on your production server
   - Verify your IP is allowed in Supabase dashboard

3. **Authentication errors**
   - Verify SUPABASE_KEY has correct permissions
   - Check if your Supabase project is active

4. **Session-related issues**
   - The app now uses in-memory session storage instead of PostgreSQL
   - Users will need to log in again after deployment
   - If multiple server instances are used, consider implementing a distributed session strategy

### Reverting to Previous Version

If you need to roll back the changes:

1. **Restore from backup**
   ```bash
   # For automatic deployment script backups
   cp supabase_migration_backup_*/server/config/db.ts server/config/db.ts
   cp supabase_migration_backup_*/server/drizzle.ts server/drizzle.ts
   # etc.
   
   # For manual backups
   cp backup_before_supabase/* .
   ```

2. **Restore environment variables**
   - Add back the DATABASE_URL if needed

3. **Restart your application**