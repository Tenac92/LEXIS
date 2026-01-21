# Payment Date & EPS Display - Manual Testing Scenarios

## Test Environment Setup
Before running tests, ensure:
1. Database has `beneficiary_payments` table with `payment_date` and `freetext` columns
2. At least one document with beneficiary_payments associated
3. Some beneficiary_payments records have payment_date and freetext (EPS) values set

## Test Scenarios

### Scenario 1: Document Card - Back View with Payments
**Objective:** Verify latest payment info displays correctly on document card

**Steps:**
1. Navigate to Documents page
2. Click on a document card to flip to back view
3. Scroll down to "Λεπτομέρειες Δαπάνης" section
4. Look for new fields:
   - "Πληρωμή: <date>" 
   - "EPS: <value>"

**Expected Results:**
- ✓ Latest payment date displayed in dd/MM/yyyy format (e.g., "15/01/2026")
- ✓ EPS value shown below (e.g., "EPS-123456")
- ✓ If no payments: shows "—" or hides field
- ✓ Date formatted in Greek locale
- ✓ EPS text is truncated if very long

**Data Points to Check:**
- Verify date matches latest payment_date in database
- Verify EPS value matches freetext field from latest payment
- If multiple payments exist, should show the one with max payment_date

---

### Scenario 2: Document Card - Multiple Payments
**Objective:** Verify aggregation selects correct "latest" payment

**Steps:**
1. Find a document with 3+ beneficiary payments
2. Check that two payments have different payment_dates
3. Look at card back view payment display
4. Query database to verify which payment has max(payment_date)

**Expected Results:**
- ✓ Card shows payment info from the one with latest payment_date
- ✓ If two payments have same date, uses one with latest created_at
- ✓ Date displayed is definitely the latest

**SQL to Verify:**
```sql
SELECT id, beneficiary_id, payment_date, freetext, created_at 
FROM beneficiary_payments 
WHERE document_id = <doc_id>
ORDER BY COALESCE(payment_date, '0000-01-01') DESC, created_at DESC
LIMIT 3;
```

---

### Scenario 3: Document Details Modal - Payments Section
**Objective:** Verify modal shows payment information

**Steps:**
1. Click Info icon on document card (front view)
2. Look for new "Πληρωμές" section (blue background)
3. Verify it appears below Recipients section

**Expected Results:**
- ✓ Section shows only if payment_count > 0
- ✓ Displays "Πληρωμές (N)" where N is payment count
- ✓ Shows:
  - "Ημερομηνία Πληρωμής (Τελευταία): <date>"
  - "EPS (Ελεύθερο κείμενο): <value>"
- ✓ Date formatted as dd/MM/yyyy
- ✓ EPS value truncated if needed
- ✓ Blue background for visual distinction

**Test Cases:**
1. Document with 1 payment → shows payment info
2. Document with 5 payments → shows latest only
3. Document with no payments → section not shown
4. Document with payment but null payment_date → shows "—"
5. Document with payment but null freetext → shows "—"

---

### Scenario 4: Beneficiary Modal - Payment List
**Objective:** Verify payment list displays EPS field

**Steps:**
1. Navigate to Beneficiaries page
2. Click on any beneficiary to open details modal
3. Scroll to "Πληρωμές" tab/section
4. Look at payment list table

**Expected Results:**
- ✓ 4-column layout:
  1. "Τύπος Δαπάνης" (Expenditure Type)
  2. "Ημερομηνία Πληρωμής" (Payment Date) - **EXISTING**
  3. "EPS" (Freetext) - **NEW**
  4. "Καταχωρήθηκε" (Created At)
- ✓ Payment date shows as dd/MM/yyyy or "Δ/Υ"
- ✓ EPS shows freetext value or "Δ/Υ"
- ✓ All values are readable (no overflow)

**Test Cases:**
1. Beneficiary with 3 payments → all rows show EPS
2. Some payments missing EPS → shows "Δ/Υ"
3. Some payments missing payment_date → shows "Δ/Υ"
4. Payment with very long EPS → text truncated properly

---

### Scenario 5: Empty/Null Value Handling
**Objective:** Verify graceful handling of missing data

**Test Cases:**

**5a. No Payments**
- Document with empty beneficiary_payments_id
- Expected: No payment fields shown or shows "—"

**5b. Null Payment Date**
- Payment with payment_date = NULL
- Expected: Shows "Δ/Υ" or field hidden

**5c. Null EPS**
- Payment with freetext = NULL
- Expected: Shows "Δ/Υ"

**5d. Empty String EPS**
- Payment with freetext = ""
- Expected: Shows "Δ/Υ" or nothing

---

### Scenario 6: Date Formatting
**Objective:** Verify Greek locale date formatting

**Test Cases:**

**Date Examples to Test:**
- 01/01/2026 → displays as "01/01/2026" ✓
- 15/01/2026 → displays as "15/01/2026" ✓
- 31/12/2025 → displays as "31/12/2025" ✓

**Verify:**
- ✓ Format is dd/MM/yyyy (NOT mm/dd/yyyy)
- ✓ All dates use Greek locale
- ✓ No time portion shown (date only)

---

### Scenario 7: Performance Check
**Objective:** Verify no performance degradation

**Steps:**
1. Documents page loads list with 50+ documents
2. Check Network tab in dev tools
3. Look for document count in API response

**Expected Results:**
- ✓ Single API call for documents list (not one per document)
- ✓ Payment data included in response (not separate calls)
- ✓ Card flip instant (no loading delay)
- ✓ Modal open instant (data already present)

---

### Scenario 8: Integration with Edit Modal
**Objective:** Verify edit functionality doesn't break payment display

**Steps:**
1. Open document card back view (see payments)
2. Click Edit button
3. Edit some document field
4. Save changes
5. Close modal and flip card back

**Expected Results:**
- ✓ Payment info still shows after edit
- ✓ No changes to payment_date or EPS (they're read-only on cards)
- ✓ Card displays same payment data as before

---

## Database Verification Queries

### Check Payment Data Exists
```sql
SELECT COUNT(*) as payment_count
FROM beneficiary_payments
WHERE payment_date IS NOT NULL 
   OR freetext IS NOT NULL;
```

### Find Documents with Payments
```sql
SELECT 
  gd.id,
  gd.protocol_number_input,
  COUNT(bp.id) as payment_count,
  MAX(bp.payment_date) as latest_payment_date
FROM generated_documents gd
LEFT JOIN beneficiary_payments bp ON gd.id = bp.document_id
WHERE gd.beneficiary_payments_id IS NOT NULL
GROUP BY gd.id
ORDER BY gd.created_at DESC
LIMIT 20;
```

### Verify Aggregation Logic
```sql
SELECT 
  bp.document_id,
  bp.id,
  bp.payment_date,
  bp.freetext,
  bp.created_at,
  ROW_NUMBER() OVER (
    PARTITION BY bp.document_id 
    ORDER BY COALESCE(bp.payment_date, '0000-01-01') DESC, bp.created_at DESC
  ) as rn
FROM beneficiary_payments bp
LIMIT 20;
-- Should see rn=1 for the latest payment
```

---

## Regression Testing
Verify that existing functionality still works:
- [ ] Document creation still works
- [ ] Document list filters work correctly
- [ ] Document editing doesn't break payments
- [ ] Beneficiary creation/editing works
- [ ] Payment add/edit/delete works
- [ ] AFM search still functional
- [ ] Export documents feature works

---

## Success Criteria
- [x] All 4 files compile without errors
- [ ] Document card shows payment info on back view
- [ ] Document modal shows Πληρωμές section
- [ ] Beneficiary modal shows EPS in payment list
- [ ] Dates formatted correctly (dd/MM/yyyy)
- [ ] Null values handled gracefully
- [ ] No performance degradation
- [ ] No regressions in existing features
