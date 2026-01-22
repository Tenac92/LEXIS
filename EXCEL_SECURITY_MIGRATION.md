# Excel Library Security Hardening - Implementation Summary

## Overview

Migrated server-side Excel file processing from `xlsx` to `exceljs` to mitigate high-severity vulnerabilities (GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9).

## Changes Made

### 1. Created Safe Excel Utilities

#### `server/utils/safeExcel.ts`

- `readXlsxToRows()`: Safe Excel reader with limits (maxRows, maxCols, maxSheets)
- Uses `exceljs` with validation to prevent resource exhaustion
- Already existed, confirmed working

#### `server/utils/safeExcelWriter.ts` (NEW)

- `createEmptyWorkbook()`: Generate simple message workbooks
- `createWorkbookFromData()`: Create multi-sheet workbooks with currency formatting
- `sendExcelResponse()`: Standardized response headers for downloads

### 2. Server-Side Migration

#### `server/utils/payment-import.ts`

- **Removed**: `import * as XLSX from "xlsx"`
- **Added**: Native Excel serial date parser (`excelSerialToDate()`)
- Replaced `XLSX.SSF.parse_date_code()` with native implementation
- No external dependency for date parsing

#### `server/routes/imports.ts`

- Already using `readXlsxToRows()` from `safeExcel`
- Enforced `.xlsx` only (reject legacy `.xls`)
- Limits: maxRows=20001, maxCols=200, maxSheets=3

#### `server/routes/budget-upload.ts`

- Already using `readXlsxToRows()` from `safeExcel`
- Enforced `.xlsx` only (reject legacy `.xls`)
- Limits: maxRows=20000, maxCols=200, maxSheets=3

#### `server/routes/budget.ts`

- Replaced 4 instances of `xlsx` exports with `safeExcelWriter` utilities
- Migrated complex multi-sheet export with currency formatting
- All empty workbook cases now use `createEmptyWorkbook()`

#### `server/controllers/projectController.ts`

- Removed unused `import * as XLSX from "xlsx"`
- Already using `ExcelJS` for exports (line was dead code)

### 3. Validation & Hardening

**Server-side file limits:**

- File size: 10 MB max (via multer)
- Rows: 20,000 max
- Columns: 200 max
- Sheets: 3 max
- Format: .xlsx only (modern format, no legacy .xls)

**Date parsing:**

- Native Excel serial number conversion (no external lib)
- Strict validation of year/month/day ranges
- Multiple format support (serial, ISO, DMY)

## Remaining xlsx Usage

### Client-side (Low Risk)

- `client/src/pages/employees.tsx` (line 575): Dynamic import for parsing uploaded employee data
- **Risk**: Lower severity - runs in browser, requires user to upload malicious file to affect themselves
- **Mitigation**: File size limits in place, user controls the upload

### Why client-side is acceptable:

1. Attacker must convince user to upload malicious file
2. Attack surface limited to user's own browser session
3. No server-side impact or data corruption
4. Browser sandboxing provides additional isolation

## Security Improvements

1. ✅ Eliminated server-side `xlsx` processing vulnerability
2. ✅ Enforced strict file size and complexity limits
3. ✅ Rejected legacy `.xls` format (higher attack surface)
4. ✅ Used `exceljs` with bounded resource consumption
5. ✅ Centralized Excel I/O through safe utilities
6. ✅ Native date parsing (no dependency)

## Testing Recommendations

1. Test budget history export with multiple sheets
2. Test payment import with various date formats
3. Test employee upload (client-side xlsx still in use)
4. Verify file size limits (10 MB) are enforced
5. Test `.xls` upload rejection on server routes
6. Confirm row/column limits prevent DoS

## npm audit Status

**Before:**

- 5 vulnerabilities (4 moderate esbuild, 1 high xlsx)

**After:**

- 1 high severity (xlsx - client-side only, no fix available)
- esbuild patched via overrides to ^0.25.11

## Future Considerations

Optional: Replace client-side xlsx with file-saver + exceljs for employee uploads if additional hardening is desired. However, given the low risk of client-side processing, this is not urgent.
