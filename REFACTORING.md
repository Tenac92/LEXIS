# Code Refactoring Documentation

This document describes the refactoring and code improvements applied to the codebase.

## Summary of Changes

1. **Improved Data Safety**
   - Added consistent null/undefined checks for all recipient properties
   - Created utility functions for safe data handling
   - Fixed amount calculations to properly handle non-numeric values

2. **Code Organization**
   - Created `scripts/tests/` for all test scripts
   - Created `scripts/database/` for SQL files
   - Created `scripts/patches/` for patch files
   - Moved redundant fix scripts to `old-patches/`
   - Moved backup files to `backups/`

3. **Refactored Large Files**
   - Split `DocumentFormatter.ts` (2381 lines) into smaller, focused modules:
     - `SafeDataHelpers.ts` - Utility functions for safely handling data
     - `TableFormatter.ts` - Functions for table generation
     - `RecipientFormatter.ts` - Functions for recipient data formatting
     - `HeaderFormatter.ts` - Functions for document headers and titles
     - `DocumentHelpers.ts` - General document structure helpers

4. **Maintenance Tools**
   - Created `scripts/maintenance.sh` for code organization
   - Created `scripts/code-check.js` for code quality analysis
   - Created `scripts/replace-console-logs.js` for automated console.log replacement with structured logging

## Future Refactoring Recommendations

Based on the code-check analysis, the following files should be broken down further:

1. `server/routes.ts` (1325 lines) - Split by functional area
2. `server/services/budgetService.ts` (1119 lines) - Split into smaller services
3. `client/src/components/documents/create-document-dialog.tsx` (2895 lines) - Extract subcomponents

Additionally:
- 663 console.log statements should be replaced with a proper logging system
- 5 TODO comments should be addressed

## File Organization Standards

- **All business logic** should be in `server/services/`
- **All route handling** should be in `server/routes/`
- **All utility functions** should be in `server/utils/`
- **All data models** should be in `shared/schema.ts`
- **All React components** should be in `client/src/components/`
- **All React pages** should be in `client/src/pages/`

## Development Guidelines

1. Keep files under 500 lines when possible
2. Use the safe data helpers for all external data
3. Add proper typings for function parameters and return values
4. Replace console.log statements with a structured logging system
5. Run the maintenance script periodically to keep the project organized