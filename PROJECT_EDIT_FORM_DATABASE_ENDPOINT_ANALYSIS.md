# Project Edit Form Database Endpoint Analysis Report

Generated on: August 4, 2025

## Executive Summary

This report analyzes the comprehensive project edit form (`client/src/pages/projects/[mis]/comprehensive-edit-fixed.tsx`) to identify fields that lack proper database endpoint support. The form is complex with multiple sections and relies on various API endpoints for CRUD operations.

## Form Structure Analysis

The comprehensive edit form contains 5 main sections:

### Section 1: Decisions
- **Form Fields**: protocol_number, fek (year/issue/number), ada, implementing_agency, decision_budget, expenditure_type, decision_type, included, comments
- **Database Table**: `project_decisions`
- **Endpoint Status**: ❌ **MISSING ENDPOINTS**

### Section 2: Event & Location Details
- **Event Fields**: event_name, event_year
- **Location Fields**: implementing_agency, event_type, expenditure_types, regions (region/regional_unit/municipality)
- **Database Tables**: `projects`, `project_index`, `kallikratis`, `event_types`, `expenditure_types`, `Monada`
- **Endpoint Status**: ✅ **PARTIALLY SUPPORTED** via PATCH `/api/projects/:mis`

### Section 3: Project Details
- **Form Fields**: mis, sa, enumeration_code, inclusion_year, project_title, project_description, summary_description, expenses_executed, project_status
- **Database Table**: `projects`, `project_history`
- **Endpoint Status**: ✅ **SUPPORTED** via PATCH `/api/projects/:mis`

### Section 4: Formulation Details
- **Form Fields**: sa, enumeration_code, protocol_number, ada, decision_year, project_budget, epa_version, total_public_expense, eligible_public_expense, decision_status, change_type, connected_decisions, comments
- **Database Table**: `project_formulations`
- **Endpoint Status**: ❌ **MISSING ENDPOINTS**

### Section 5: Changes
- **Form Fields**: description (array of change descriptions)
- **Database Table**: `project_history`
- **Endpoint Status**: ❌ **MISSING ENDPOINTS**

## Detailed Analysis of Missing Endpoints

### 1. Project Decisions Management ❌

**Missing Endpoints:**
- `GET /api/projects/:mis/decisions` - Fetch existing decisions
- `POST /api/projects/:mis/decisions` - Create new decision
- `PATCH /api/projects/:mis/decisions/:id` - Update existing decision
- `DELETE /api/projects/:mis/decisions/:id` - Delete decision

**Current Status:**
- The form fetches decisions data via `/api/projects/:mis/complete`
- No dedicated CRUD operations for individual decisions
- Form submission attempts to save via main project PATCH endpoint

**Impact:**
- Users cannot individually manage decisions
- All decision changes must go through the main project update
- No validation of decision-specific business rules

### 2. Project Formulations Management ❌

**Missing Endpoints:**
- `GET /api/projects/:mis/formulations` - Fetch existing formulations
- `POST /api/projects/:mis/formulations` - Create new formulation
- `PATCH /api/projects/:mis/formulations/:id` - Update existing formulation
- `DELETE /api/projects/:mis/formulations/:id` - Delete formulation

**Current Status:**
- The form fetches formulations data via `/api/projects/:mis/complete`
- Connected decisions mapping exists but lacks proper CRUD operations
- Form data is processed but not properly persisted to `project_formulations` table

**Impact:**
- Complex formulation data (SA types, budgets, EPA versions) cannot be properly managed
- Connected decisions linking is not functional
- Financial data integrity cannot be maintained

### 3. Project History/Changes Management ❌

**Missing Endpoints:**
- `GET /api/projects/:mis/history` - Fetch project change history
- `POST /api/projects/:mis/changes` - Record new changes

**Current Status:**
- `project_history` table exists in schema
- Some history recording happens during project updates
- No dedicated change tracking interface

**Impact:**
- Users cannot view comprehensive project change history
- Change descriptions from the form are not properly recorded
- Audit trail is incomplete

### 4. Enhanced Location Data Management ⚠️

**Partially Missing:**
- Location details are processed via `project_lines` in the main PATCH endpoint
- Complex geographic relationships require better dedicated endpoints

**Recommendations:**
- `POST /api/projects/:mis/locations` - Manage location relationships
- `GET /api/projects/:mis/locations` - Fetch location details with full geographic hierarchy

## Currently Working Endpoints ✅

### Main Project Update
- `PATCH /api/projects/:mis` - Updates core project fields and processes location data
- Handles: project_title, event_description, budgets, status, event_year, project_lines

### Reference Data
- `GET /api/projects/reference-data` - Fetches all reference tables
- `GET /api/projects/:mis/complete` - Comprehensive project data fetch

### Lookup and Search
- `GET /api/projects/:mis` - Individual project fetch
- Various search and filter endpoints

## Database Schema Support Analysis

### Well-Supported Tables ✅
- `Projects` - Main project table with comprehensive PATCH support
- `project_index` - Location relationships handled via project_lines
- Reference tables (`event_types`, `expenditure_types`, `Monada`, `kallikratis`)

### Poorly Supported Tables ❌
- `project_decisions` - Table exists, no CRUD endpoints
- `project_formulations` - Table exists, no CRUD endpoints  
- `project_history` - Table exists, minimal usage

## Form Submission Flow Analysis

The form currently uses a single mutation that:

1. ✅ Updates main project fields via `PATCH /api/projects/:mis`
2. ❌ Attempts to save decisions (but no proper endpoint exists)
3. ❌ Attempts to save formulations (but no proper endpoint exists)
4. ✅ Updates location data via `project_lines` processing
5. ❌ Does not save change descriptions

## Recommendations

### Priority 1: Critical Missing Endpoints

1. **Project Decisions CRUD**
   ```
   GET    /api/projects/:mis/decisions
   POST   /api/projects/:mis/decisions
   PATCH  /api/projects/:mis/decisions/:id
   DELETE /api/projects/:mis/decisions/:id
   ```

2. **Project Formulations CRUD**
   ```
   GET    /api/projects/:mis/formulations
   POST   /api/projects/:mis/formulations
   PATCH  /api/projects/:mis/formulations/:id
   DELETE /api/projects/:mis/formulations/:id
   ```

### Priority 2: Enhanced Functionality

3. **Project History Management**
   ```
   GET    /api/projects/:mis/history
   POST   /api/projects/:mis/changes
   ```

4. **Enhanced Location Management**
   ```
   GET    /api/projects/:mis/locations
   POST   /api/projects/:mis/locations
   PATCH  /api/projects/:mis/locations/:id
   ```

### Priority 3: Form Integration Improvements

5. **Batch Operations**
   ```
   POST   /api/projects/:mis/batch-update
   ```
   - Handle multiple form sections in a single transaction
   - Ensure data consistency across related tables

## Technical Implementation Notes

### Current Workarounds
- Form attempts to save all data through the main project PATCH endpoint
- Some data is saved to `project_history` but not properly structured
- Connected decisions are logged but not persistently linked

### Required Changes
1. Create missing controller methods for decisions and formulations
2. Implement proper foreign key relationship management
3. Add transaction support for multi-table operations
4. Enhance error handling for complex form validations

## Conclusion

The project edit form is **functionally incomplete** due to missing database endpoints for critical sections:

- **60%** of form fields lack proper database endpoint support
- **3 out of 5** major form sections cannot properly persist data
- Current workarounds create data integrity risks

**Immediate Action Required:**
- Implement missing CRUD endpoints for decisions and formulations
- Add proper change tracking endpoints
- Enhance transaction support for multi-section form submissions

This analysis confirms that the comprehensive edit form needs significant backend endpoint development to function as designed.