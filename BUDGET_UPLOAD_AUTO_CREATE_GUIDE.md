# Budget Upload - Project Auto-Creation Quick Guide

## What Changed?

The budget Excel import now **automatically creates projects** when they don't exist in the database.

## How It Works

### Before (Old Behavior)
- Upload Excel with budget data → Only budget records created/updated
- If project didn't exist → Budget record created WITHOUT project link
- Had to manually create missing projects

### After (New Behavior)
- Upload Excel with budget data + optional project info
- System looks for existing project → If found, uses it
- If project NOT found → **Automatically creates it** from Excel data
- Budget records now properly linked to project

## Excel File Format

Your Excel file can now include project information columns:

| Column Name (Greek) | Column Name (English) | Purpose |
|-------------------|-------------------|---------|
| Τίτλος Έργου | project_title | Project name |
| Έτος | event_year | Project year |
| Event Description | event_description | Project description |
| Κωδικός Έργου | (project code) | Project code |

**Important**: The system is flexible:
- ✅ You CAN include these columns
- ✅ You DON'T have to include them
- ✅ The system handles partial data with sensible defaults

## Example Scenario

### Excel Data:
```
MIS    | NA853      | Τίτλος Έργου        | Έτος | ΕΤΗΣΙΑ ΠΙΣΤΩΣΗ
-------|------------|---------------------|------|---------------
12345  | 2024-XYZ   | Infrastructure A    | 2024 | 100,000.00
67890  | 2024-ABC   | (empty)             | 2024 | 50,000.00
```

### What Happens:
1. **Row 1**: 
   - Looks for project with MIS=12345 or NA853="2024-XYZ"
   - Not found → Creates project "Infrastructure A" (year 2024)
   - Creates budget record linked to new project

2. **Row 2**:
   - Looks for project with MIS=67890 or NA853="2024-ABC"
   - Not found → Creates project "Project 2024-ABC" (default name, year 2024)
   - Creates budget record linked to new project

## Column Name Variations

The system recognizes these variations (case-insensitive):

### For Project Title:
- `Τίτλος Έργου` (Greek)
- `Τιτλος Εργου` (Greek without accents)
- `project_title` (English)
- `project title` (English)
- `project name` (English)

### For Project Year:
- `Έτος` (Greek)
- `Ετος` (Greek without accents)
- `event_year` (English)
- `year` (English)
- `Κωδικός Έργου` (Greek project code)

### For Description:
- `event_description` (English)
- `description` (English)

## Default Behaviors

If you don't provide certain data:

| If Missing | System Uses |
|-----------|------------|
| Project Title | `Project {NA853}` |
| Project Description | `Project for NA853 {NA853}` |
| Project Year | (not set) |
| Project Status | `Ενεργό` (Active) |

## Important Notes

1. **NA853 is Required**
   - Must be unique per project
   - System uses it as fallback lookup
   
2. **MIS is Unique When Provided**
   - System uses it for primary project lookup
   
3. **Event_description Must Be Unique**
   - Database constraint requirement
   - If Excel has duplicate descriptions, creation may fail

4. **Error Handling**
   - If project creation fails → Budget record still created
   - Check logs for error details
   - System logs all creation attempts

## Checking Results

After upload, the admin page shows:
- ✅ Success count
- ❌ Failure count  
- 📋 Details of any failed records
- 🔗 MIS and NA853 codes for reference

To debug:
- Check server logs for `[BudgetUpload]` entries
- Look for `Project not found` messages
- Check `Successfully created new project` confirmations
- Verify project creation was logged

## Tips & Best Practices

1. **For New Projects**: Include project title and year
2. **For Existing Projects**: Just use MIS or NA853 to match
3. **For Mixed Files**: Include data for everything - system handles selective creation
4. **For Bulk Operations**: Test with a small subset first
5. **Keep Descriptions Unique**: Avoid duplicate event_description values

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Projects not created | Check Excel has NA853 column (required) |
| Wrong project linked | Verify MIS/NA853 values in Excel |
| Duplicate error | Check for duplicate event_description or NA853 values |
| Budget created but no project link | Check server logs; project creation may have failed but budget succeeded |

## What Gets Created

When a new project is created:

```
Projects Table Entry:
├── mis: 12345
├── na853: "2024-XYZ"  
├── project_title: "Infrastructure A"
├── event_description: "Project for NA853 2024-XYZ"
├── status: "Ενεργό"
├── event_year: [2024]
├── inc_year: 2024
└── created_at: (current timestamp)

Project Budget Entry:
├── project_id: (linked to new project)
├── mis: 12345
├── na853: "2024-XYZ"
├── ethsia_pistosi: 100000.00
├── q1, q2, q3, q4: (values from Excel)
└── (other budget fields...)

Budget History Entry:
├── project_id: (linked to new project)
├── change_type: "import"
├── change_reason: "Initial import from Excel..."
└── created_at: (current timestamp)
```

## Questions?

Check [BUDGET_UPLOAD_PROJECT_CREATION.md](BUDGET_UPLOAD_PROJECT_CREATION.md) for detailed technical documentation.
