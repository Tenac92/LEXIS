#!/bin/bash
# Supabase Migration Deployment Script
# This script automates the deployment process for Supabase migration

set -e  # Exit immediately on error

# ANSI color codes for better output formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions to handle different output types
info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
  echo -e "${RED}[ERROR]${NC} $1"
  exit 1
}

# Check if required environment variables are set
check_env_vars() {
  info "Checking environment variables..."
  
  # Backend variables
  if [ -z "$SUPABASE_URL" ]; then
    error "SUPABASE_URL environment variable is not set!"
  fi
  
  if [ -z "$SUPABASE_KEY" ] && [ -z "$SUPABASE_ANON_KEY" ]; then
    error "Neither SUPABASE_KEY nor SUPABASE_ANON_KEY environment variable is set!"
  fi
  
  if [ -z "$SESSION_SECRET" ]; then
    error "SESSION_SECRET environment variable is not set!"
  fi
  
  # Check frontend variables (optional)
  if [ -z "$VITE_SUPABASE_URL" ]; then
    warning "VITE_SUPABASE_URL is not set. Frontend direct Supabase access will not work."
  fi
  
  if [ -z "$VITE_SUPABASE_KEY" ]; then
    warning "VITE_SUPABASE_KEY is not set. Frontend direct Supabase access will not work."
  fi
  
  success "Environment variables check completed!"
}

# Test connection to Supabase
test_connection() {
  info "Testing connection to Supabase..."
  
  # Run the node script to test connection
  if node -e "
    const { createClient } = require('@supabase/supabase-js');
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
    
    console.log('Connecting to Supabase at:', supabaseUrl);
    
    async function testConnection() {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey, {
          auth: { persistSession: false, autoRefreshToken: false }
        });
        
        console.log('Client created, testing connection...');
        const { data, error } = await supabase.from('users').select('id').limit(1);
        
        if (error) throw error;
        console.log('Connection successful!', data);
        return true;
      } catch (err) {
        console.error('Connection failed:', err);
        return false;
      }
    }
    
    testConnection().then(success => {
      process.exit(success ? 0 : 1);
    });
  "; then
    success "Supabase connection test succeeded!"
  else
    error "Supabase connection test failed! Check network settings and credentials."
  fi
}

# Create backup of current production files
backup_production() {
  local backup_dir="supabase_migration_backup_$(date +%Y%m%d_%H%M%S)"
  
  info "Creating backup of critical files in ./$backup_dir..."
  
  mkdir -p "$backup_dir"
  
  # Backup all critical files
  cp server/config/db.ts "$backup_dir/" 2>/dev/null || warning "Could not backup server/config/db.ts"
  cp server/drizzle.ts "$backup_dir/" 2>/dev/null || warning "Could not backup server/drizzle.ts"
  cp server/middleware/databaseErrorRecovery.ts "$backup_dir/" 2>/dev/null || warning "Could not backup server/middleware/databaseErrorRecovery.ts"
  cp server/index.ts "$backup_dir/" 2>/dev/null || warning "Could not backup server/index.ts"
  cp server/storage.ts "$backup_dir/" 2>/dev/null || warning "Could not backup server/storage.ts"
  cp .env "$backup_dir/" 2>/dev/null || warning "Could not backup .env"
  
  success "Backup created in ./$backup_dir"
}

# Deploy the migrated files
deploy_migration() {
  info "Deploying Supabase migration changes..."
  
  # Copy prepared migration files from the source directory
  # Note: Update the source_dir to match where your updated files are located
  local source_dir="."
  
  # Make sure critical directories exist
  mkdir -p server/middleware
  
  # Deploy updated files
  if [ -f "$source_dir/server/config/db.ts" ]; then
    cp "$source_dir/server/config/db.ts" server/config/db.ts
    success "Deployed updated server/config/db.ts"
  else
    warning "server/config/db.ts not found in source directory"
  fi
  
  if [ -f "$source_dir/server/drizzle.ts" ]; then
    cp "$source_dir/server/drizzle.ts" server/drizzle.ts
    success "Deployed updated server/drizzle.ts"
  else
    warning "server/drizzle.ts not found in source directory"
  fi
  
  if [ -f "$source_dir/server/middleware/databaseErrorRecovery.ts" ]; then
    cp "$source_dir/server/middleware/databaseErrorRecovery.ts" server/middleware/databaseErrorRecovery.ts
    success "Deployed updated server/middleware/databaseErrorRecovery.ts"
  else
    warning "server/middleware/databaseErrorRecovery.ts not found in source directory"
  fi
  
  if [ -f "$source_dir/server/index.ts" ]; then
    cp "$source_dir/server/index.ts" server/index.ts
    success "Deployed updated server/index.ts"
  else
    warning "server/index.ts not found in source directory"
  fi
  
  if [ -f "$source_dir/server/storage.ts" ]; then
    cp "$source_dir/server/storage.ts" server/storage.ts
    success "Deployed updated server/storage.ts"
  else
    warning "server/storage.ts not found in source directory"
  fi
}

# Verify deployment
verify_deployment() {
  info "Verifying deployment..."
  
  # Check for DATABASE_URL in server/index.ts
  if grep -q "DATABASE_URL" server/index.ts; then
    warning "server/index.ts still contains references to DATABASE_URL!"
  else
    success "DATABASE_URL removed from server/index.ts"
  fi
  
  # Verify Supabase client configuration in config/db.ts
  if grep -q "persistSession: false" server/config/db.ts && grep -q "autoRefreshToken: false" server/config/db.ts; then
    success "server/config/db.ts has proper Supabase client configuration"
  else
    warning "server/config/db.ts might not have the optimal Supabase client configuration"
  fi
  
  # Check if PostgreSQL session store has been replaced with in-memory store
  if grep -q "MemoryStore" server/storage.ts && grep -q "In-memory session store initialized" server/storage.ts; then
    success "server/storage.ts is using in-memory session store instead of PostgreSQL"
  else
    warning "server/storage.ts might still be using PostgreSQL for session storage"
  fi
  
  # Check enhanced error detection
  if grep -q "DbErrorDetection" server/middleware/databaseErrorRecovery.ts; then
    success "Enhanced database error detection is in place"
  else
    warning "server/middleware/databaseErrorRecovery.ts might not have the enhanced error detection"
  fi
}

# Clean up temp files
cleanup() {
  info "Cleaning up..."
  # Add any cleanup steps here if needed
  success "Deployment process completed!"
}

# Main script execution
main() {
  info "Starting Supabase migration deployment..."
  
  # Step 1: Check environment variables
  check_env_vars
  
  # Step 2: Test connection
  test_connection
  
  # Step 3: Create backup
  backup_production
  
  # Step 4: Deploy migration
  deploy_migration
  
  # Step 5: Verify deployment
  verify_deployment
  
  # Step 6: Cleanup
  cleanup
  
  echo ""
  echo "----------------------------------------"
  echo "🚀 Supabase migration deployment completed!"
  echo "----------------------------------------"
  echo "Next steps:"
  echo "1. Restart your application server"
  echo "2. Monitor server logs for any database connection issues"
  echo "3. Test critical functionality (authentication, document operations)"
  echo "4. If any issues occur, consider rolling back using the backup created in ./supabase_migration_backup_*"
  echo "----------------------------------------"
}

# Run the script
main