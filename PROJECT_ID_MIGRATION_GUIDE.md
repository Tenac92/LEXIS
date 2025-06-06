# Project ID Migration Guide

## Overview
This guide documents the migration from using `mis` to `id` for project identification throughout the application. Users will see `na853` and `event_description` as the main project information, while the backend uses `id` for all database operations.

## Migration Strategy

### 1. Database Schema Updates
- Added `project_id` columns to all related tables
- Maintained `mis` columns for backward compatibility
- Updated foreign key relationships to use `project_id`
- Added indexes for performance optimization

### 2. Backend Changes
- Created `projectResolver.ts` utility for unified project lookups
- Updated `budgetService.ts` to use project IDs
- Added project resolver API endpoints
- Modified all routes to work with both identifiers during transition

### 3. Frontend Changes
- Created `use-project-resolver.ts` hook for project identification
- Updated components to display `na853` and `event_description`
- Maintained backward compatibility with existing data

## Key Files Modified

### Server-side
1. `server/utils/projectResolver.ts` - Core project resolution logic
2. `server/controllers/projectResolverController.ts` - API endpoints
3. `server/services/budgetService.ts` - Budget operations with project IDs
4. `shared/schema.ts` - Updated database schema

### Client-side
1. `client/src/hooks/use-project-resolver.ts` - Frontend project resolution
2. Project display components updated to show NA853 codes

### Database
1. `scripts/complete-project-id-migration.sql` - Database migration script

## Implementation Steps

### Phase 1: Database Migration
Run the SQL migration script to add `project_id` columns and update relationships:

```sql
-- Execute scripts/complete-project-id-migration.sql
```

### Phase 2: Backend Updates
1. Deploy updated server code with project resolver utilities
2. Update API endpoints to support both MIS and ID lookups
3. Ensure all budget operations use project IDs

### Phase 3: Frontend Updates
1. Deploy updated client code with new project resolver hooks
2. Update all project displays to show NA853 codes
3. Maintain backward compatibility during transition

## Testing Checklist

### Database
- [ ] All tables have `project_id` columns populated
- [ ] Foreign key constraints are properly set
- [ ] Indexes are created for performance

### Backend
- [ ] Project resolver endpoints work correctly
- [ ] Budget service uses project IDs
- [ ] Backward compatibility maintained

### Frontend
- [ ] Project displays show NA853 codes
- [ ] Document creation uses new identification system
- [ ] All project lookups work correctly

## User Experience Changes

### Before Migration
- Users saw numeric MIS codes (e.g., 5203790)
- Internal system used MIS for all operations

### After Migration
- Users see meaningful NA853 codes (e.g., 2024ΝΑ85300001)
- System displays project descriptions alongside codes
- Internal operations use database IDs for efficiency
- Backward compatibility maintained for existing data

## API Endpoints Added

### Project Resolution
- `GET /api/projects/resolve/:identifier` - Resolve any identifier to project data
- `GET /api/projects/id/:identifier` - Get project ID from any identifier
- `GET /api/projects/na853/:identifier` - Get NA853 from any identifier
- `POST /api/projects/batch-resolve` - Batch resolve multiple identifiers

## Benefits

1. **Better User Experience**: Users see meaningful project codes instead of numeric IDs
2. **Improved Performance**: Database operations use integer IDs for faster lookups
3. **Maintainable Code**: Centralized project resolution logic
4. **Future-Proof**: System ready for any future project identification changes
5. **Backward Compatibility**: Existing data continues to work during transition

## Rollback Plan

If issues arise, the migration can be rolled back by:
1. Reverting to use `mis` columns in application logic
2. Keeping `project_id` columns for future use
3. No data loss occurs as both fields are maintained

## Post-Migration Cleanup

After successful migration and testing:
1. Monitor system performance
2. Verify all project lookups work correctly
3. Update documentation to reflect new identification system
4. Train users on new project code format if necessary