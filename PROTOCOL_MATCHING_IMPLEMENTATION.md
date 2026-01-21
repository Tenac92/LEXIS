# Multi-Protocol Matching Implementation - Summary

## Overview
Implemented robust protocol parsing for handling "Ορθή Επανάληψη" (correction/re-issuance) cases where Excel cells contain multiple protocol numbers separated by Greek text.

## Key Changes

### 1. **Protocol Extraction Utility** (`server/utils/payment-import.ts`)
Added `extractProtocolCandidates()` function that:
- Extracts all numeric sequences from an input string using `/\d+/g` regex
- Preserves order of first occurrence
- Deduplicates automatically using a Set
- Handles leading zeros correctly (e.g., "00012" stays as "00012")
- Returns empty array for null/undefined/empty inputs

**Example transformations:**
- `"67501 Ο.Ε.(64379 Ο.Ε.63759)"` → `["67501", "64379", "63759"]`
- `"78235 ΟΕ 73175"` → `["78235", "73175"]`
- `"  00012  Ο.Ε  "` → `["00012"]`

### 2. **ParsedRow Interface Update** (`server/routes/imports.ts`)
Changed from single protocol pair to multi-candidate array:

**Before:**
```typescript
interface ParsedRow {
  protocolStrict: string;
  protocolLoose: string;
  afm: string;
  paymentDate: string;
  eps: string | null;
}
```

**After:**
```typescript
interface ParsedRow {
  protocolCandidates: string[];      // All protocols from cell (in order)
  selectedProtocol?: string;         // Protocol that matched (set during matching)
  afm: string;
  paymentDate: string;
  eps: string | null;
}
```

### 3. **Protocol Extraction in Row Parsing** (lines 228-236)
Updated the data row parsing loop to:
- Call `extractProtocolCandidates()` instead of `normalizeProtocol()`
- Validate that at least one candidate was found
- Store all candidates in the ParsedRow

```typescript
const protocolCandidates = extractProtocolCandidates(row[protocolIndex as number]);
if (protocolCandidates.length === 0) {
  report.error_rows.push({
    row: rowNumber,
    error: "missing_protocol",
    details: String(row[protocolIndex as number] ?? ""),
  });
  return;
}
```

### 4. **Document Mapping Refactored** (lines 327-333)
Simplified from strict/loose maps to direct protocol lookup:

**Before:**
```typescript
const documentsByStrict = new Map<string, { id: number | string }>();
const documentsByLoose = new Map<string, { id: number | string }>();
// ...complex normalization logic
```

**After:**
```typescript
const documentsById = new Map<string, { id: number | string; protocol_number_input: string }>();
const documentsByProtocol = new Map<string, { id: number | string; protocol_number_input: string }>();

documents.forEach((doc) => {
  documentsById.set(String(doc.id), doc);
  documentsByProtocol.set(doc.protocol_number_input, doc);
});
```

### 5. **Multi-Protocol Matching Logic** (lines 432-474)
Implemented candidate-by-candidate matching:

```typescript
for (const row of parsedRows) {
  // Try each protocol candidate in order
  let matchedDocument: { id: number | string; protocol_number_input: string } | null = null;
  let selectedProtocol: string | null = null;

  for (const candidate of row.protocolCandidates) {
    const doc = documentsByProtocol.get(candidate);
    if (doc) {
      matchedDocument = doc;
      selectedProtocol = candidate;
      break;  // Stop at first match
    }
  }

  if (!matchedDocument) {
    report.skipped_rows.push({
      row: row.rowNumber,
      reason: "protocol_not_found",
      details: `Tried candidates: ${row.protocolCandidates.join(", ")}`,
    });
    continue;
  }
  // ... continue with AFM and payment matching
}
```

### 6. **Enhanced Error Reporting**
Updated skip/error reasons to show which candidates were attempted:
- `"Tried candidates: 67501, 64379, 63759"` - Shows all protocol attempts
- `"Tried candidates: 78235, 73175"` - Shows partial matches
- Helps debug when multi-protocol entries don't match expected documents

## Matching Algorithm
The matching strategy prioritizes the first protocol candidate found:

1. **Extract Phase:** All numeric sequences extracted from Excel cell in order
2. **Batch Fetch Phase:** All candidate protocols fetched from database in single query (chunked by 500s)
3. **Try-in-Order Phase:** For each row, iterate protocol candidates
   - Stop at first candidate found in database
   - Set as `selectedProtocol`
   - Continue to AFM matching with this document
4. **AFM Phase:** Match the row's AFM against the document's beneficiary payments
5. **Skip/Accept:** If no candidate protocol matches → skip row with reason

## Test Results
All 9 test cases pass:
- ✓ Multi-protocol with Greek text
- ✓ Two protocols with abbreviation
- ✓ Single protocol with leading zeros
- ✓ Empty string
- ✓ Null input
- ✓ Undefined input
- ✓ Greek text only (no numbers)
- ✓ Single protocol
- ✓ Duplicate protocols (deduplicates correctly)

## Build Status
✅ **Build: SUCCESSFUL**
- No TypeScript compilation errors
- Output size: 1.1 MB
- Build time: 8-9 seconds

## Benefits
1. **Handles "Ορθή Επανάληψη":** Properly extracts multiple protocol numbers from correction documents
2. **Preserves Leading Zeros:** Protocol numbers like "00012" handled correctly
3. **Deterministic Matching:** First candidate always prioritized (reproducible results)
4. **Better Error Messages:** Shows all candidates attempted in report
5. **Backward Compatible:** Existing single-protocol entries still work (array with one element)
6. **Robust Edge Cases:** Handles null, undefined, empty, and text-only inputs

## Next Steps (Optional Enhancements)
1. Add unit tests for `extractProtocolCandidates()` in test framework
2. Integration testing with actual multi-protocol Excel files
3. Monitor report output to verify `selectedProtocol` tracking
4. Consider adding weighting if certain candidate positions should be prioritized
5. Add validation to ensure protocol_number_input values don't have unexpected formats

## Files Modified
1. `server/utils/payment-import.ts` - Added extractProtocolCandidates function
2. `server/routes/imports.ts` - Updated ParsedRow interface and matching logic
   - Updated protocol extraction (line 228)
   - Updated ParsedRow push (line 280)
   - Updated protocol set collection (line 298)
   - Updated document mapping (line 327)
   - Updated main matching loop (line 432)
   - Updated error messages with candidate list

## Database Query Changes
No changes to database schema required. The implementation works with existing:
- `generated_documents.protocol_number_input` - Used as-is for protocol matching
- `beneficiary_payments` - Used as-is for AFM and payment matching
