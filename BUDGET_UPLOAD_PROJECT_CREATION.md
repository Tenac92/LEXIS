# Budget Upload - Automatic Project Creation Feature

## Overview
Enhanced the budget Excel import functionality to automatically create projects when they don't exist in the database. This feature reads project information from the Excel file and creates new project records before linking budget data.

## Changes Made

### 1. **Column Header Detection**
Added support for detecting project-related columns in the Excel file:

#### Project Title Column
Matches any of these variations (case-insensitive):
- `Τίτλος Έργου` (Greek)
- `Τιτλος Εργου` (Greek without accents)
- `project_title` (English)
- `project title` (English with space)
- `project name` (English alternative)

#### Project Year Column
Matches any of these variations:
- `Έτος` (Greek - Year)
- `Ετος` (Greek without accents)
- `event_year` (English)
- `year` (English)
- `Κωδικός Έργου` (Greek - sometimes contains year info)

#### Event Description Column
Matches any of these variations:
- `event_description` (English)
- `description` (English)

### 2. **Project Creation Logic**
When processing budget records from the Excel file:

1. **Lookup Phase**: First tries to find an existing project by:
   - MIS (numeric code) - primary lookup
   - NA853 (alphanumeric code) - secondary lookup

2. **Creation Phase**: If no project is found, creates a new project with:
   - `mis`: Project MIS code from Excel
   - `na853`: Project NA853 code from Excel (required, unique)
   - `project_title`: Title from Excel or default fallback (`Project {NA853}`)
   - `event_description`: Description from Excel or default fallback
   - `status`: Set to "Ενεργό" (Active) by default
   - `event_year`: Array containing the year if provided in Excel
   - `inc_year`: Inclusion year (same as event_year if available)
   - `created_at` & `updated_at`: Current timestamp

3. **Budget Linking**: After project creation or lookup:
   - Uses the project_id to create/update budget records
   - Creates budget history entries for tracking changes
   - Falls back to MIS/NA853 lookup if project creation fails

## Data Flow

```
Excel File
    ↓
Extract Budget Data + Project Data
    ↓
Try to Find Existing Project (by MIS or NA853)
    ↓
    ├─ Found? → Use project_id
    │
    └─ Not Found? → Create New Project
         ↓
         ├─ Success? → Use new project_id
         │
         └─ Fail? → Continue with MIS/NA853 lookup only
    ↓
Create/Update Budget Record (project_id optional)
    ↓
Create Budget History Entry (if project_id exists)
```

## Implementation Details

### File Modified
- **[server/routes/budget-upload.ts](server/routes/budget-upload.ts)**

**Important Note**: The PostgreSQL table name is `Projects` (capital P), not `projects`. This is case-sensitive in queries.

### Key Changes

#### 1. Column Detection (Lines ~260-283)
Added three new column key detection blocks:
- `projectTitleKey`
- `projectYearKey`
- `eventDescriptionKey`

#### 2. Update Data Object (Lines ~298-322)
Extended the update object structure to include:
```typescript
projectData: {
  title: projectTitleKey ? String(row[projectTitleKey]).trim() : null,
  year: projectYearKey ? parseEuropeanNumber(row[projectYearKey]) : null,
  description: eventDescriptionKey ? String(row[eventDescriptionKey]).trim() : null
}
```

#### 3. Project Creation (Lines ~455-491)
Added logic to:
- Check if project exists (existing lookup)
- Create project if not found with Excel data
- Handle creation errors gracefully
- Log all project creation attempts

## Error Handling

The implementation includes robust error handling:
- **Project Creation Failure**: Logs warning but continues with budget record creation
- **Missing Data**: Uses sensible defaults for required fields
- **Invalid Data**: parseEuropeanNumber handles various number formats (EU format with dots and commas)

## Logging

All project creation activities are logged with `[BudgetUpload]` prefix for easy debugging:
- Project lookup attempts
- Project creation success/failure
- Default fallback usage
- Budget record linking

## Excel File Format

The Excel file should include:
- **Required**: MIS and NA853 columns
- **Optional**: Project Title, Project Year, Event Description columns
- **Budget Data**: All existing budget-related columns (Q1-Q4, annual budget, etc.)

## Example

If an Excel file has a row:
```
| MIS | NA853    | Τίτλος Έργου     | Έτος | ΕΤΗΣΙΑ |
|-----|----------|------------------|------|--------|
| 123 | 2024-ABC | New Infrastructure | 2024 | 50000  |
```

The system will:
1. Look for project with MIS=123 or NA853="2024-ABC"
2. If not found, create a new project with:
   - mis: 123
   - na853: "2024-ABC"
   - project_title: "New Infrastructure"
   - inc_year: 2024
   - event_year: [2024]
3. Create/update budget records linked to this project

## Testing Recommendations

1. **Test Case 1**: Upload file with existing projects
   - Should match and update budget data only
   - No new projects created

2. **Test Case 2**: Upload file with new projects
   - Should create projects and budget records
   - Should link them correctly

3. **Test Case 3**: Mixed existing and new projects
   - Should handle both cases in same file
   - Check project_id linking in budget records

4. **Test Case 4**: Missing optional columns
   - Should use defaults and succeed
   - Check logs for fallback messages

## Database Constraints

Note: The implementation respects database constraints:
- **na853**: Unique constraint - must be unique per project
- **mis**: Unique constraint - must be unique per project (if provided)
- **project_title & event_description**: Must be unique in projects table

If Excel data violates these constraints, the creation will fail and a warning will be logged.

## Future Enhancements

Possible improvements:
1. Add configuration option to skip project creation
2. Add option to update existing project data
3. Support more column name variations
4. Add validation for project data before creation
5. Add batch error recovery with partial commits
