# BUDGET HISTORY AUDIT FIX CHECKLIST
**Quick Reference for Development Team**

---

## CRITICAL ISSUES (Must Complete)

### ☐ CRITICAL #1: Semantic Labels for Amounts

**Files to Change:**
- `client/src/pages/budget-history-page.tsx`

**Lines to Update:**
- Line 1417: Table header labels → Add "(Διαθέσιμο)" subtitle
- Line 906-914: Metadata warning → Expand with yellow callout box
- Line 950+: Add documentAmountSection before previousVersionSection

**What it fixes:** Auditor won't misread "€100 → €80" as spending vs. available budget

**Time:** 3 hours  
**Complexity:** Low (UI text changes)  
**Testing:** Visual inspection in browser

---

### ☐ CRITICAL #2: Document Amount Validation + Audit Flag

**Files to Change:**
- `server/storage.ts` (2 places)

**Lines to Update:**
- Line 273-302: createBudgetHistoryEntry() → Add validation logic before insert
- Line 476-486: updateProjectBudgetSpending() → Enhance change_reason format

**What it fixes:** Detects mismatches between available budget change and actual document amount

**Time:** 4 hours  
**Complexity:** Medium (backend logic)  
**Testing:** Insert entries with known document amounts; verify metadata

---

### ☐ CRITICAL #3: Batch Import Metadata Capture

**Files to Change:**
- `server/routes/budget-upload.ts` (or batch import handler)
- `client/src/pages/budget-history-page.tsx`

**What it fixes:** Users can see what file was imported, when, by whom, and drill into individual entries

**Time:** 3 hours  
**Complexity:** Medium (backend + frontend)  
**Testing:** Import an Excel file; expand batch row; verify all metadata displays

---

### ☐ CRITICAL #4: Sequence Numbering for Same-Timestamp Entries

**Files to Change:**
- `server/storage.ts` (getBudgetHistory method)
- `client/src/pages/budget-history-page.tsx`

**Lines to Update:**
- Line 1436: Add `.order('metadata->sequence_in_batch', { ascending: false })` between created_at and id
- Add metadata capture logic when creating batch entries
- Display sequence in expanded view

**What it fixes:** Entries with identical timestamps are ordered by insertion sequence, not ID randomness

**Time:** 2 hours  
**Complexity:** Low-Medium (mostly data capture + UI)  
**Testing:** Create 3 entries with same timestamp; verify display order

---

## IMPORTANT ISSUES (Should Complete)

### ☐ IMPORTANT #1: Operation Type Badges

**Files to Change:**
- `client/src/pages/budget-history-page.tsx`

**Lines to Update:**
- Line 691+: Add getOperationTypeBadge() helper function
- Line 1505: Use badge in table rendering

**What it fixes:** Visually distinguish auto (🤖), import (📤), rollback (⟲), manual (✏️) operations

**Time:** 2 hours  
**Complexity:** Low (UI components)  
**Testing:** Check that each entry type shows correct badge

---

### ☐ IMPORTANT #2: Date Filter Boundary Documentation

**Files to Change:**
- `client/src/pages/budget-history-page.tsx`

**Lines to Update:**
- Line 1233+: Add helper text under each date input
- Line 1390: Add date range indicator in results

**What it fixes:** Users understand that date filters are inclusive on both ends

**Time:** 1 hour  
**Complexity:** Low (UI text)  
**Testing:** Enter date range; see explanation text

---

### ☐ IMPORTANT #3: Excel Export Enhancement

**Files to Change:**
- `client/src/pages/budget-history-page.tsx`

**Lines to Update:**
- Line 610: Replace getExportFilename() logic
- Backend (not specified): Ensure 2 decimal place formatting in Excel

**What it fixes:** Export filename includes context (date range, filters); Excel uses proper currency format

**Time:** 2 hours  
**Complexity:** Low (filename logic)  
**Testing:** Export file; verify filename has timestamp and filters; check decimal formatting in Excel

---

### ☐ IMPORTANT #4: Retroactive Entry Flagging

**Files to Change:**
- `server/storage.ts`
- `client/src/pages/budget-history-page.tsx`

**Lines to Update:**
- Line 273+: Add timestamp comparison logic in createBudgetHistoryEntry()
- In renderMetadata(): Add display for retroactive_flag

**What it fixes:** Entries backdated into the past are flagged for review

**Time:** 2 hours  
**Complexity:** Low-Medium (validation logic)  
**Testing:** Manually insert old entry; verify flag is set and displayed

---

### ☐ IMPORTANT #5: Aggregation Scope Clarity

**Files to Change:**
- `client/src/pages/budget-history-page.tsx`

**Lines to Update:**
- Line 1353: Update statistics badge with tooltip
- Line 1624: Clarify count text in pagination footer

**What it fixes:** Users understand statistics are for all matching rows, not just current page

**Time:** 1 hour  
**Complexity:** Low (UI text + tooltip)  
**Testing:** Apply filter; see clarification text in results

---

### ☐ IMPORTANT #6: Empty State Messaging

**Files to Change:**
- `client/src/pages/budget-history-page.tsx`

**Lines to Update:**
- Line 1411: Replace generic empty message with contextual help

**What it fixes:** Users get guidance when no results are found

**Time:** 1 hour  
**Complexity:** Low (UI)  
**Testing:** Apply filter that returns no results; see helpful message

---

## OPTIONAL ENHANCEMENTS (Nice-to-Have)

### ☐ OPTIONAL #1: Anomaly Highlights
Add visual flag for unusual budget jumps (€50k+, negative balances)

### ☐ OPTIONAL #2: Carry-Forward Audit Details
Show full calculation for quarterly/year-end transitions

### ☐ OPTIONAL #3: PDF Export
Export with audit trail, signature line, cryptographic hash

### ☐ OPTIONAL #4: Column Reordering
Let users drag to rearrange columns

### ☐ OPTIONAL #5: Duplicate Detection
Flag potential duplicate entries (same project, amount, timestamp within 5 min)

---

## TESTING PROTOCOL

### Unit Tests (Developer)
```
- [ ] Document amount validation passes with matching amounts
- [ ] Document amount validation flags with mismatched amounts
- [ ] Batch metadata is captured for all entries
- [ ] Sequence numbers are assigned correctly (1, 2, 3...)
- [ ] Retroactive flag only set for old timestamps
```

### Integration Tests (QA)
```
- [ ] Query a project's history and manually sum documents
- [ ] Verify sum matches available_budget calculations
- [ ] Import Excel file with 10 entries; verify all show in batch
- [ ] Create 3 entries with identical created_at; verify display order
- [ ] Filter by date range; count entries; verify all within range
- [ ] Export to Excel; verify filename has timestamp and filter context
- [ ] Check decimal precision in exported file (should be €X.XX)
```

### Audit Tests (Senior Dev/QA Lead)
```
- [ ] Full reconciliation: pick project → sum docs → verify history matches
- [ ] Batch import scenario: upload file → verify metadata → delete one entry → check remaining
- [ ] Retroactive edit scenario: create old entry → verify flagged
- [ ] Statistics scenario: apply filter → check count matches rows
- [ ] Chronology test: create entries with overlapping timestamps → verify order
- [ ] Null safety: try edge cases (missing document, orphaned entry, deleted project)
```

---

## DEPLOYMENT CHECKLIST

### Pre-Deployment (Dev)
- [ ] All code reviewed and approved
- [ ] Unit tests passing
- [ ] No console errors in dev build
- [ ] Database backup taken
- [ ] Rollback plan documented

### Deployment (DevOps)
- [ ] Deploy to staging first
- [ ] Run smoke tests on staging
- [ ] Deploy to production during low-traffic window
- [ ] Monitor error logs for 1 hour post-deploy

### Post-Deployment (QA + PM)
- [ ] Visual QA on production
- [ ] Test with real production data (small dataset)
- [ ] Verify stats calculations match expectations
- [ ] Check Excel export works end-to-end
- [ ] Confirm no performance regression

---

## TIMELINE

| Week | Task | Owner | Hours |
|------|------|-------|-------|
| Week 1 (Jan 29-Feb 2) | Critical #1, #2, #3, #4 | Dev Team | 12 |
| Week 1 (Feb 2-3) | Code Review + QA Testing | Tech Lead + QA | 8 |
| Week 1 (Feb 3) | Deploy Phase 1 | DevOps | 1 |
| Week 2 (Feb 5-9) | Important #1-6 | Dev Team | 9 |
| Week 2 (Feb 9-10) | Code Review + QA Testing | Tech Lead + QA | 6 |
| Week 2 (Feb 10) | Deploy Phase 2 | DevOps | 1 |

**Total:** 37 hours over 2 weeks

---

## RISK MITIGATION

| Risk | Mitigation |
|------|-----------|
| Breaking existing functionality | Test with real data before production; keep rollback ready |
| Performance degradation | Index metadata JSONB queries; load test on staging |
| User confusion from UI changes | Add inline help text; brief user community |
| Data inconsistency during deploy | No schema changes = no migration risk |

---

## COMMUNICATION PLAN

**Day 1 (Jan 29):**
- Send audit report to stakeholders
- Schedule team standup to review checklist

**Week 1:**
- Daily 15-min sync on Critical fixes
- Include QA early for testing scenarios

**Week 2:**
- Review metrics (error rates, performance)
- Plan Important improvements

**Post-Deploy:**
- Send user communication: "What's New in Budget History"
- Monitor audit log for issues

---

## FILE REFERENCE

| File | Changes | Lines |
|------|---------|-------|
| `client/src/pages/budget-history-page.tsx` | All UI changes | 1417, 906, 950, 691, 1505, 1233, 1390, 610, 1411, etc. |
| `server/storage.ts` | Validation, ordering, batch metadata | 273, 476, 1436 |
| `server/routes/budget-upload.ts` | Batch metadata capture | ~580 |

---

## SUCCESS METRICS

After implementation:
- ✅ Zero audit findings on "amounts ambiguity"
- ✅ 100% of batch imports attributed to source file
- ✅ All retroactive entries flagged
- ✅ Discrepancies between history & budget detected automatically
- ✅ User satisfaction survey: "I understand what each entry means" > 90%

---

**Document Version:** 1.0  
**Last Updated:** January 28, 2026  
**Owner:** Engineering Leadership

