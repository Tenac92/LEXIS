# Multi-Protocol Matching Workflow

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    EXCEL FILE (User Upload)                 │
│  Αριθμός Παραστατικού | ΑΦΜ Δικαιούχου | ... | EPS         │
│  "67501 Ο.Ε.(64379 Ο.Ε.63759)" | "123456789" | ... | "EUR" │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────────┐
        │  Extract Protocol Candidates           │
        │  extractProtocolCandidates()           │
        │  Input: "67501 Ο.Ε.(64379 Ο.Ε.63759)" │
        │  ├─ Match /\d+/g                       │
        │  ├─ ["67501", "64379", "63759"]        │
        │  └─ Deduplicate & preserve order       │
        └────────────────────┬───────────────────┘
                             │
                    ┌────────▼────────┐
                    │   ParsedRow     │
                    ├─────────────────┤
                    │ protocolCandidates
                    │   ["67501",     │
                    │    "64379",     │
                    │    "63759"]     │
                    │ selectedProtocol│ ← (null at this stage)
                    │ afm: "123456789"│
                    │ paymentDate: ... │
                    │ eps: "EUR"      │
                    └────────┬────────┘
                             │
        ┌────────────────────▼──────────────────┐
        │  Collect All Unique Candidates       │
        │  protocolSet.add(candidate)          │
        │  For ALL rows in batch               │
        │  Result: Set["67501", "64379",       │
        │           "63759", ...]              │
        └────────────────────┬─────────────────┘
                             │
        ┌────────────────────▼──────────────────┐
        │  Batch Fetch Documents               │
        │  SELECT * FROM generated_documents   │
        │  WHERE protocol_number_input IN (...)│
        │  CHUNK SIZE: 500 at a time           │
        └────────────────────┬─────────────────┘
                             │
            ┌────────────────▼────────────────┐
            │  Build Document Maps            │
            ├────────────────────────────────┤
            │ documentsById:                  │
            │   "12345" → {...doc...}        │
            │                                 │
            │ documentsByProtocol:            │
            │   "67501" → {...doc_A...}     │
            │   "64379" → {...doc_B...}     │
            │   "63759" → {...doc_C...}     │
            └────────────────┬────────────────┘
                             │
        ┌────────────────────▼──────────────────┐
        │  Fetch All Document Beneficiary      │
        │  SELECT * FROM beneficiary_payments  │
        │  WHERE document_id IN (...)          │
        │  With beneficiary AFM data           │
        └────────────────────┬─────────────────┘
                             │
        ┌────────────────────▼──────────────────┐
        │  Build Payment Index Map              │
        │  paymentsByDocument[docId][afm]       │
        │    = [payment1, payment2, ...]       │
        └────────────────────┬─────────────────┘
                             │
        ┌────────────────────▼──────────────────┐
        │  FOR EACH ParsedRow:                  │
        │  Multi-Protocol Candidate Matching    │
        └────────────────────┬─────────────────┘
                             │
        ┌────────────────────▼──────────────────┐
        │  TRY EACH CANDIDATE IN ORDER:        │
        │                                      │
        │  Iteration 1: candidate = "67501"   │
        │  ├─ documentsByProtocol.get("67501")│
        │  ├─ Found: doc_A                    │
        │  ├─ selectedProtocol = "67501"      │
        │  ├─ BREAK (stop trying others)      │
        │  └─ Continue to AFM matching        │
        │                                      │
        │  ✓ If found: stop here (step out)   │
        │  ✗ If not found:                    │
        │     Iteration 2: candidate = "64379"│
        │     └─ (repeat for each candidate)   │
        └────────────────────┬─────────────────┘
                             │
        ┌────────────────────▼──────────────────┐
        │  CHECK: Document Payments Exist?    │
        │  paymentsByDocument.get(docId)       │
        │  ├─ If exists: continue             │
        │  └─ If not: SKIP ROW                │
        └────────────────────┬─────────────────┘
                             │
        ┌────────────────────▼──────────────────┐
        │  MATCH AFM:                          │
        │  paymentsByDocument[docId][parsedAFM]│
        │  ├─ If matches found: continue      │
        │  └─ If no match: SKIP ROW           │
        └────────────────────┬─────────────────┘
                             │
        ┌────────────────────▼──────────────────┐
        │  UPDATE PAYMENTS:                    │
        │  FOR each matching payment:         │
        │  ├─ Update payment_date (if needed) │
        │  ├─ Update freetext (eps, if needed)│
        │  └─ Record update count             │
        │                                      │
        │  OUTPUT: ParsedRow with selected    │
        │  protocol recorded                   │
        └────────────────────┬─────────────────┘
                             │
                             ▼
        ┌─────────────────────────────────────┐
        │  GENERATE IMPORT REPORT:            │
        ├─────────────────────────────────────┤
        │ total_rows: 1000                    │
        │ matched_rows: 850                   │
        │ skipped_rows: [                     │
        │   {                                 │
        │     row: 42,                        │
        │     reason: "protocol_not_found",   │
        │     details: "Tried candidates:     │
        │              67501, 64379, 63759"   │
        │   },                                │
        │   ...                               │
        │ ]                                   │
        │ error_rows: [...]                   │
        └─────────────────────────────────────┘
```

## Matching Algorithm Pseudocode

```
FOR EACH parsedRow IN parsedRows:
  matchedDocument ← NULL
  selectedProtocol ← NULL
  
  // Step 1: Try protocol candidates in order
  FOR EACH candidate IN parsedRow.protocolCandidates:
    document ← documentsByProtocol.get(candidate)
    IF document EXISTS:
      matchedDocument ← document
      selectedProtocol ← candidate
      BREAK  // Stop at first match
    ENDIF
  ENDFOR
  
  // Step 2: Check if document found
  IF matchedDocument IS NULL:
    SKIP ROW with reason "protocol_not_found"
    CONTINUE
  ENDIF
  
  // Step 3: Check if document has payments
  payments ← paymentsByDocument.get(matchedDocument.id)
  IF payments IS NULL:
    SKIP ROW with reason "document_has_no_payments"
    CONTINUE
  ENDIF
  
  // Step 4: Match AFM
  afmMatches ← payments.get(parsedRow.afm)
  IF afmMatches IS EMPTY:
    SKIP ROW with reason "afm_not_found"
    CONTINUE
  ENDIF
  
  // Step 5: Update payments
  FOR EACH payment IN afmMatches:
    payload ← {}
    
    IF parsedRow.paymentDate EXISTS AND (override OR NOT payment.payment_date):
      payload.payment_date ← parsedRow.paymentDate
    ENDIF
    
    IF parsedRow.eps EXISTS AND (override OR NOT payment.freetext):
      payload.freetext ← parsedRow.eps
    ENDIF
    
    IF payload HAS CHANGES:
      UPDATE beneficiary_payments SET payload WHERE id = payment.id
      increment matched_rows
    ENDIF
  ENDFOR
ENDFOR
```

## Example: Processing "Ορθή Επανάληψη" Document

### Input Row from Excel
```
Αριθμός Παραστατικού: "67501 Ο.Ε.(64379 Ο.Ε.63759)"
ΑΦΜ Δικαιούχου:       "123456789"
Ημ/νία Πρωτοκόλλου:   "2024-01-15"
EPS:                  "EUR"
```

### Step 1: Extract Protocol Candidates
```
Input: "67501 Ο.Ε.(64379 Ο.Ε.63759)"
Regex /\d+/g matches: ["67501", "64379", "63759"]
Deduplication: ["67501", "64379", "63759"] (no duplicates)
Output: ["67501", "64379", "63759"]
```

### Step 2: Collect All Candidates (from entire batch)
```
Row 1: ["67501", "64379", "63759"]
Row 2: ["78235", "73175"]
Row 3: ["67501"]  (duplicate from row 1)
Set: {"67501", "64379", "63759", "78235", "73175"}
```

### Step 3: Fetch Documents from Database
```
SELECT id, protocol_number_input FROM generated_documents
WHERE protocol_number_input IN ("67501", "64379", "63759", "78235", "73175")

Results:
- id: 12345, protocol_number_input: "67501"
- id: 12346, protocol_number_input: "64379"
- id: 12347, protocol_number_input: "63759"
- id: 12348, protocol_number_input: "78235"
(73175 not found in database)
```

### Step 4: Build Maps
```
documentsByProtocol:
  "67501" → {id: 12345, protocol_number_input: "67501"}
  "64379" → {id: 12346, protocol_number_input: "64379"}
  "63759" → {id: 12347, protocol_number_input: "63759"}
  "78235" → {id: 12348, protocol_number_input: "78235"}
```

### Step 5: Match Row 1 Protocol Candidates
```
ParsedRow 1:
  protocolCandidates: ["67501", "64379", "63759"]
  afm: "123456789"

Try Candidate 1: "67501"
  ├─ documentsByProtocol.get("67501") 
  ├─ Found: {id: 12345}
  ├─ matchedDocument ← 12345
  ├─ selectedProtocol ← "67501"
  └─ BREAK (stop trying other candidates)

Continue with document 12345...
```

### Step 6: Final Update
```
Beneficiary payments for document 12345 with AFM 123456789:
- Update payment_date to "2024-01-15" ✓
- Update freetext to "EUR" ✓

Matched row! ✓
Report increments: matched_rows += 1
```

## Key Properties

### Deterministic Ordering
- Protocol candidates extracted in order of appearance in Excel cell
- First candidate always tried first
- If multiple protocols exist in database, first matching one is always selected
- Ensures consistent, reproducible matching across runs

### Backward Compatibility
- Single-protocol entries work as-is (array with one element)
- Existing code that didn't need multi-protocol continues to work
- Old `protocolStrict` / `protocolLoose` logic replaced with simpler candidate iteration

### Edge Cases Handled
```
Empty/Null Input          → []                           (skip row)
"Ορθή Επανάληψη"         → []                           (skip row)
"  00012  "              → ["00012"]                    (preserves leading zeros)
"67501 67501"            → ["67501"]                    (deduplicates)
"67501 Ο.Ε.(64379)"      → ["67501", "64379"]          (extracts all numbers)
"PDF_67501_64379.pdf"    → ["67501", "64379"]          (ignores non-digit text)
```

## Performance Characteristics

### Time Complexity
- Extract: O(n × m) where n = rows, m = max cell length
- Fetch: O(1) with database batch chunking (500 at a time)
- Matching: O(n × c × p) where c = candidates per row, p = payments per doc
  - Typical: c = 1-3, p = 1-5, so effectively O(n × 15-20)

### Space Complexity
- protocolSet: O(unique protocols in batch) ≈ O(10,000) typical
- documentsByProtocol map: O(unique protocols found) ≈ O(5,000) typical
- paymentsByDocument nested map: O(total payments) ≈ O(50,000) typical

### Batch Processing
- Excel rows: processed in single transaction
- Protocols: fetched in chunks of 500
- Payments: fetched in chunks of 500
- Total DB queries: ~4 (headers, documents, payments, updates)
