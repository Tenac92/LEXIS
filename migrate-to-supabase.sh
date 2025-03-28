#!/bin/bash

# Migration script to switch from Neon DB to Supabase
# This script will replace the existing database connections with Supabase-only implementation

echo "Starting migration to Supabase..."

# Check if the new files exist
if [ ! -f "./server/config/db.ts.new" ] || [ ! -f "./server/drizzle.ts.new" ] || [ ! -f "./server/data/index.ts.new" ] || [ ! -f "./server/middleware/databaseErrorRecovery.ts.new" ] || [ ! -f "./server/auth/index.ts.new" ]; then
  echo "Error: One or more new configuration files are missing!"
  echo "Please ensure all .new files are present before running this script."
  exit 1
fi

# Backup existing files
echo "Creating backups of critical files..."
mkdir -p ./backups
cp ./server/config/db.ts ./backups/db.ts.bak
cp ./server/drizzle.ts ./backups/drizzle.ts.bak
cp ./server/data/index.ts ./backups/data-index.ts.bak
cp ./server/middleware/databaseErrorRecovery.ts ./backups/databaseErrorRecovery.ts.bak
cp ./server/auth/index.ts ./backups/auth-index.ts.bak

# Install memorystore if not already present
echo "Checking for memorystore package..."
if ! grep -q "memorystore" package.json; then
  echo "Installing memorystore package for session management..."
  npm install --save memorystore
fi

# Apply new database configuration
echo "Replacing database configuration files..."
mv ./server/config/db.ts.new ./server/config/db.ts
mv ./server/drizzle.ts.new ./server/drizzle.ts
mv ./server/data/index.ts.new ./server/data/index.ts
mv ./server/middleware/databaseErrorRecovery.ts.new ./server/middleware/databaseErrorRecovery.ts
mv ./server/auth/index.ts.new ./server/auth/index.ts

echo "Migration complete!"
echo "Please restart your application to apply the changes."
echo ""
echo "NOTE: This migration has switched your session store to use memory storage temporarily."
echo "Your users will need to log in again after deployment."