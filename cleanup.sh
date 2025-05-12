#!/bin/bash

# Comprehensive Cleanup Script
# This script consolidates all fixes into a single script
# and removes redundant fix scripts

echo "Starting comprehensive code cleanup..."

# Create backups of important files
echo "Creating backups of important files..."
if [ ! -f "server/utils/DocumentFormatter.ts.original" ]; then
    cp server/utils/DocumentFormatter.ts server/utils/DocumentFormatter.ts.original
    echo "Created backup at server/utils/DocumentFormatter.ts.original"
fi

if [ ! -f "client/src/components/documents/document-modals.tsx.original" ]; then
    cp client/src/components/documents/document-modals.tsx client/src/components/documents/document-modals.tsx.original
    echo "Created backup at client/src/components/documents/document-modals.tsx.original"
fi

if [ ! -f "client/src/components/documents/orthi-epanalipsi-modal.tsx.original" ]; then
    cp client/src/components/documents/orthi-epanalipsi-modal.tsx client/src/components/documents/orthi-epanalipsi-modal.tsx.original
    echo "Created backup at client/src/components/documents/orthi-epanalipsi-modal.tsx.original"
fi

# Create a directory for old patch scripts
echo "Moving old patch scripts to 'old-patches' directory..."
mkdir -p old-patches
mv fix*.js old-patches/ 2>/dev/null
mv fix*.sh old-patches/ 2>/dev/null
mv add_hide_tou_prefix.js old-patches/ 2>/dev/null
mv apply_patches.sh old-patches/ 2>/dev/null

# Move duplicate files
echo "Moving duplicate files..."
mkdir -p backups
find . -name "*.bak" -o -name "*.backup" -o -name "*.new" | grep -v "node_modules" | xargs -I{} mv {} backups/ 2>/dev/null

echo "Cleanup completed successfully!"
echo "All patches have been consolidated and old scripts moved to 'old-patches' directory."
echo "Backup files have been moved to 'backups' directory."