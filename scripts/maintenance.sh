#!/bin/bash

# Comprehensive Codebase Maintenance Script
# This script helps maintain the codebase by:
# 1. Organizing files into appropriate directories
# 2. Cleaning up temporary and backup files
# 3. Performing basic code quality checks

echo "Starting codebase maintenance..."

# Create necessary directories if they don't exist
mkdir -p scripts/tests
mkdir -p scripts/database
mkdir -p scripts/patches
mkdir -p backups

# Move test scripts to tests directory
find . -maxdepth 1 -name "test-*.js" -exec mv {} scripts/tests/ \;
echo "✓ Test scripts organized"

# Move SQL files to database directory
find . -maxdepth 1 -name "*.sql" -exec mv {} scripts/database/ \;
echo "✓ SQL files organized"

# Move patch files to patches directory
find . -maxdepth 1 -name "*.patch" -exec mv {} scripts/patches/ \;
echo "✓ Patch files organized"

# Move backup files to backups directory
find . -not -path "./node_modules/*" -not -path "./backups/*" \
  \( -name "*.bak" -o -name "*.backup" -o -name "*.new" \) \
  -exec mv {} backups/ \;
echo "✓ Backup files organized"

# Check for TODO comments and report them
echo "Finding TODOs in the codebase..."
grep -r "TODO" --include="*.ts" --include="*.tsx" --include="*.js" . \
  | grep -v "node_modules" || echo "No TODOs found"

# Check for console.log statements in production code
echo "Finding console.log statements in the codebase..."
grep -r "console.log" --include="*.ts" --include="*.tsx" . \
  | grep -v "node_modules" || echo "No console.log statements found"

echo "Maintenance completed!"
echo "Remember to review the TODO items and console.log statements for cleanup."