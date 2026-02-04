# BENEFICIARY PAGE UX + DATA CONSISTENCY AUDIT
**Production Financial Application | Greek Public Sector | Date: 2026-01-28**

---

## EXECUTIVE SUMMARY

The Beneficiary Page exhibits **moderate data integrity risks** and **significant UX/cognitive load issues** that could lead to:
- **Wrong payment linkage** (users confusing beneficiary contexts)
- **Silent data inconsistencies** between card and modal views
- **Operator errors** from unclear field labeling and missing validation feedback
- **Audit trail gaps** when viewing historical data

**Risk Level: MEDIUM-HIGH**  
**Immediate Action Required: 3 Critical issues**  
**Recommended Actions: 12 issues total**

---

## A. CRITICAL ISSUES (Payment Risk, Data Corruption, Audit Failure)

### 🔴 **CRITICAL #1: AFM Masking Inconsistency – Data Integrity Breach**

**Problem:**
- List/Grid cards display **masked AFM** (e.g., `***456789`)
- Modal details tab shows **unmasked full AFM** only when modal opens
- Users can flip card to "back" view and never see card-level click-to-copy AFM button
- **Race condition:** If payment data is stale, user could link payment to wrong beneficiary by AFM match

**Why It Matters:**
- **Audit Failure:** Beneficiaries matched by partial AFM could be wrong person
- **Payment to Wrong Person:** Non-deterministic beneficiary identification when searching by AFM
- **Trust Issue:** Operator can't verify identity from card view without opening modal
- **Greek Legal Requirement:** AFM is the authoritative identifier; masking for public display but requiring full AFM for operations creates inconsistency

**Current Code:**
- [beneficiaries-page.tsx](beneficiaries-page.tsx#L727): `ΑΦΜ: {beneficiary.afm}` (masked by backend)
- [BeneficiaryDetailsModal.tsx](BeneficiaryDetailsModal.tsx#L364): Fetches full AFM: `fullBeneficiaryData` with `staleTime: 0`

**Implementable Fix:**
1. **Change card display:** Show last 5 digits only (e.g., `AFM: ***456789` → `AFM: ...456789` with tooltip showing full masked version)
2. **Add copy button** to card header (not just modal), but only if user has view permission
3. **Fetch full AFM once on page load**, cache with user session, display consistently
4. **Add visual indicator** when AFM is masked vs unmasked

```tsx
// In card rendering (beneficiaries-page.tsx, ~line 727)
// BEFORE:
<span className="text-sm font-mono text-gray-700 bg-gray-100 px-2 py-1 rounded">
  ΑΦΜ: {beneficiary.afm}
</span>

// AFTER: Show last 5 digits with copy capability
<div className="flex items-center gap-2">
  <span className="text-sm font-mono text-gray-700 bg-gray-100 px-2 py-1 rounded">
    ΑΦΜ: ...{beneficiary.afm.slice(-5)}
  </span>
  {fullBeneficiaryData && (
    <Button 
      size="sm" 
      variant="ghost"
      onClick={() => copyToClipboard(fullBeneficiaryData.afm, "ΑΦΜ")}
      title={`ΑΦΜ: ${fullBeneficiaryData.afm}`}
    >
      <Copy className="w-3 h-3" />
    </Button>
  )}
</div>
```

---

### 🔴 **CRITICAL #2: Payment Amount & Status Divergence Between Card and Modal**

**Problem:**
- Cards show: `getTotalAmountForBeneficiary()` = sum of **visible page payments** only
- Modal shows: Fetches payments **fresh from DB** with `queryKey: ["/api/beneficiary-payments", beneficiary?.id]`
- If user:
  1. Opens card (sees €50,000 total)
  2. Adds payment in modal
  3. Closes modal without page reload
  4. Returns to card list: **Card still shows €50,000** (stale payment data)

**Why It Matters:**
- **Reconciliation Failure:** Auditors see discrepancy between card total and actual DB
- **Silent Overpayment:** If user adds payment and returns to card, believes old total is accurate
- **Operator Confusion:** "Why does modal show more/less than card?"

**Current Code:**
- [beneficiaries-page.tsx](beneficiaries-page.tsx#L478-L510): Payment data cached: `staleTime: 2 * 60 * 1000`
- [BeneficiaryDetailsModal.tsx](BeneficiaryDetailsModal.tsx#L595): Payments fetched fresh: `enabled: open && !!beneficiary?.id`
- After mutation success: Only `queryClient.invalidateQueries({ queryKey: ["/api/beneficiary-payments"] })` (line 759)

**Implementable Fix:**
1. **Immediate invalidation:** When mutation succeeds, also invalidate beneficiary list cache
2. **Synchronized totals:** Use same data source for card + modal summaries

```tsx
// In BeneficiaryDetailsModal.tsx, updatePaymentMutation.onSuccess (line ~752)
const updatePaymentMutation = useMutation({
  mutationFn: async ({ paymentId, data }: ...) => { ... },
  onSuccess: () => {
    // BEFORE: Only invalidates payment-specific cache
    queryClient.invalidateQueries({ queryKey: ["/api/beneficiary-payments"] });
    
    // AFTER: Also refresh beneficiary list to update card totals
    queryClient.invalidateQueries({ queryKey: ["/api/beneficiaries"] });
    queryClient.invalidateQueries({ queryKey: ["/api/beneficiary-payments", beneficiary?.id] });
    
    setEditingPayment(null);
    toast({ title: "Επιτυχία", ... });
  },
});
```

---

### 🔴 **CRITICAL #3: Modal Region/Geographic Data Consistency – Two Views, One Confusion**

**Problem:**
- Modal "Details" tab shows geographic info from `regiondetSelection` state
- Modal "Payments" tab at end shows **different section** with geographic selector that can edit independently
- If user:
  1. Selects region in "Details" tab
  2. Switches to "Payments" tab
  3. Edits region in the bottom section of "Payments" tab
  4. Result: **Two regiondet saves** happening at different times with potential race condition

**Why It Matters:**
- **Data Race:** Concurrent saves could overwrite each other
- **Audit Trail:** Which geographic selection is authoritative?
- **Cognitive Load:** User doesn't realize same field is being edited twice
- **State Leakage:** If user closes modal without confirming, regiondet from Details tab edit might not sync with Payments tab view

**Current Code:**
- [BeneficiaryDetailsModal.tsx](BeneficiaryDetailsModal.tsx#L1080-L1140): Geographic section in Details tab
- [BeneficiaryDetailsModal.tsx](BeneficiaryDetailsModal.tsx#L1375-L1420): Duplicate geographic section in Payments tab
- Both call `handleRegiondetChange()` which saves independently

**Implementable Fix:**
1. **Remove duplicate:** Keep geographic selector ONLY in Details tab
2. **In Payments tab:** Show read-only summary of selected regions, link to Details tab to edit

```tsx
// In BeneficiaryDetailsModal.tsx, replace second geographic section (around line 1375)
// BEFORE: Full editable BeneficiaryGeoSelector in Payments tab
// AFTER: Read-only summary + link to edit in Details tab
<div className="bg-blue-50 p-6 rounded-xl border border-blue-200 shadow-sm">
  <div className="flex items-center justify-between mb-3">
    <div className="flex items-center gap-2">
      <MapPin className="w-5 h-5 text-blue-700" />
      <h4 className="text-lg font-semibold text-blue-900">Γεωγραφικά Στοιχεία</h4>
    </div>
    <Button
      variant="outline"
      size="sm"
      onClick={() => setActiveTab("details")}
      className="text-xs"
    >
      Επεξεργασία
    </Button>
  </div>
  
  {/* READ-ONLY display only */}
  <div className="bg-white p-4 rounded-lg border border-blue-100">
    {(() => {
      const formatted = formatRegiondet((regiondetSelection as any) || beneficiary?.regiondet);
      if (formatted.regions.length === 0 && formatted.regionalUnits.length === 0) {
        return <p className="text-sm text-blue-700 text-muted-foreground">Δεν έχουν επιλεγεί περιοχές</p>;
      }
      return (
        <div className="space-y-2 text-sm text-blue-900">
          {formatted.regions.length > 0 && <div>Περιφέρειες: {formatted.regions.join(", ")}</div>}
          {formatted.regionalUnits.length > 0 && <div>Περιφερειακές Ενότητες: {formatted.regionalUnits.join(", ")}</div>}
          {formatted.municipalities.length > 0 && <div>Δήμοι: {formatted.municipalities.join(", ")}</div>}
        </div>
      );
    })()}
  </div>
</div>
```

---

## B. IMPORTANT IMPROVEMENTS (Trust, Errors, Cognitive Load)

### 🟠 **IMPORTANT #1: Engineer Names Show as IDs in Card "Back" View**

**Problem:**
- Card front shows: `ID: {beneficiary.ceng1}` (just the number)
- Card back shows: `ID: {beneficiary.ceng1}` (same)
- Modal shows: `getEngineerName(beneficiary.ceng1)` (resolved name)
- Cards never resolve engineer IDs to names

**Why It Matters:**
- **Incomplete Information:** Operator can't see engineer name without opening modal
- **Usability:** Field says "ID" not "Name" → unclear what to do with it
- **Accessibility:** ID number alone is meaningless without context

**Current Code:**
- [beneficiaries-page.tsx](beneficiaries-page.tsx#L1052-L1060): Shows only ID
- [BeneficiaryDetailsModal.tsx](BeneficiaryDetailsModal.tsx#L745): Uses `getEngineerName()` helper

**Implementable Fix:**
1. Prefetch engineers on page load (already doing at line 227)
2. Create memoized map: `const engineerMap = useMemo(() => new Map(engineers.map(e => [e.id, e])), [engineers])`
3. Replace card engineer display:

```tsx
// In card rendering, ~line 1052
// BEFORE:
{beneficiary.ceng1 && (
  <div className="bg-white/70 p-3 rounded border">
    <div className="text-xs text-orange-600 font-medium">Μηχανικός 1</div>
    <div className="text-sm text-orange-900 font-medium">ID: {beneficiary.ceng1}</div>
  </div>
)}

// AFTER:
{beneficiary.ceng1 && (
  <div className="bg-white/70 p-3 rounded border">
    <div className="text-xs text-orange-600 font-medium">Μηχανικός 1</div>
    <div className="text-sm text-orange-900 font-medium">
      {engineerMap?.get(beneficiary.ceng1)?.surname} {engineerMap?.get(beneficiary.ceng1)?.name} 
      {!engineerMap?.has(beneficiary.ceng1) && `(ID: ${beneficiary.ceng1})`}
    </div>
  </div>
)}
```

---

### 🟠 **IMPORTANT #2: Payment Status Color Legend Missing from Cards**

**Problem:**
- Modal shows payment status with colors: `getFinancialStatusColor(payment.status)` (green=paid, blue=submitted, yellow=pending)
- Cards show **no payment status indicators** at all
- Users see total amount and count, but not whether payments are pending/paid/submitted

**Why It Matters:**
- **Incomplete Risk Assessment:** Operator doesn't know if €100K shown is paid or pending without opening modal
- **Reconciliation Burden:** No quick visual check of payment stage
- **Audit Trail:** Historical status not visible on card

**Current Code:**
- [beneficiaries-page.tsx](beneficiaries-page.tsx#L750-L780): Shows only total amount + count, no status
- [BeneficiaryDetailsModal.tsx](BeneficiaryDetailsModal.tsx#L723-L735): Correct status colors in modal

**Implementable Fix:**
1. Add payment status summary to card when showing financial info:

```tsx
// In card financial section, after showing total amount, add status breakdown
{getTotalAmountForBeneficiary(beneficiary.id) > 0 && (
  <div className="space-y-2">
    {/* Existing total display */}
    <div className="flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded text-sm font-medium">
      <CreditCard className="w-4 h-4" />
      {getPaymentsForBeneficiary(beneficiary.id).length} πληρωμές
    </div>
    
    {/* NEW: Status breakdown */}
    {(() => {
      const payments = getPaymentsForBeneficiary(beneficiary.id);
      const byStatus = payments.reduce((acc, p) => {
        acc[p.status] = (acc[p.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      return (
        <div className="flex gap-1 flex-wrap text-xs">
          {byStatus.paid > 0 && <Badge className="bg-green-100 text-green-800">{byStatus.paid} πληρωμένες</Badge>}
          {byStatus.submitted > 0 && <Badge className="bg-blue-100 text-blue-800">{byStatus.submitted} υποβλημένες</Badge>}
          {byStatus.pending > 0 && <Badge className="bg-yellow-100 text-yellow-800">{byStatus.pending} εκκρεμείς</Badge>}
        </div>
      );
    })()}
  </div>
)}
```

---

### 🟠 **IMPORTANT #3: Empty States Not Distinguished from Zero-Value States**

**Problem:**
- Beneficiary with no payments: Card shows **nothing** (financial section hidden)
- Beneficiary with €0 payments: Card shows **nothing** (financial section hidden)
- Operator can't distinguish: "This person has no payments" vs "Payments data is missing"

**Why It Matters:**
- **Data Quality Question:** Is this a new beneficiary or corrupted record?
- **Audit Risk:** Missing payments could indicate deleted records
- **Operator Confidence:** No clear feedback

**Current Code:**
- [beneficiaries-page.tsx](beneficiaries-page.tsx#L745): `if (getTotalAmountForBeneficiary(beneficiary.id) > 0) return null`
- Card only renders financial section if total > 0

**Implementable Fix:**
1. Add explicit empty state indicator on card:

```tsx
// After financial summary section (~line 745), add:

{getTotalAmountForBeneficiary(beneficiary.id) === 0 && (
  <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
    <AlertCircle className="w-4 h-4 text-gray-500" />
    <span className="text-xs text-gray-600">Δεν υπάρχουν πληρωμές</span>
  </div>
)}
```

---

### 🟠 **IMPORTANT #4: Free Text Field "EPS" Label Misleading**

**Problem:**
- List view shows: `EPS: {latest?.freetext}` (line 707)
- Field is labeled as "EPS" but actually stores **freetext notes**
- Modal shows: `Ελεύθερο Κείμενο / Σημειώσεις` (free text / notes)
- EPS = "Ενιαίο Πληροφοριακό Σύστημα" (unified payment system) – not what this field is

**Why It Matters:**
- **Terminology Mismatch:** Legal/financial terms confused with implementation details
- **Operator Error:** User thinks "EPS" field is system-managed; actually free-form
- **Audit Trail:** Auditors see "EPS: {random notes}" and don't understand what it means

**Current Code:**
- [beneficiaries-page.tsx](beneficiaries-page.tsx#L700-L708): `EPS: {latest?.freetext || "—"}`
- [beneficiaries-page.tsx](beneficiaries-page.tsx#L815): `EPS: {latest?.freetext || "—"}`
- [BeneficiaryDetailsModal.tsx](BeneficiaryDetailsModal.tsx#L1189): Correctly labeled `Ελεύθερο Κείμενο / Σημειώσεις`

**Implementable Fix:**
1. Change card label from "EPS" to "Σημειώσεις" (Notes):

```tsx
// In list view, ~line 700
// BEFORE:
<span className="truncate" title={latest?.freetext || "—"}>
  EPS: {latest?.freetext || "—"}
</span>

// AFTER:
<span className="truncate text-gray-600" title={latest?.freetext || "—"}>
  {latest?.freetext ? `Σημ: ${latest.freetext}` : "Χωρίς σημειώσεις"}
</span>
```

---

### 🟠 **IMPORTANT #5: Region Display Missing From List View (Non-AFM Searches)**

**Problem:**
- Search feature supports: name, surname, AFM, **region**
- But card display never shows region data unless on "back" (flipped)
- User searches "Αττική" → cards load with no visual indication of region
- Search is 1-to-many (multiple beneficiaries in Αττική) but no differentiation visible

**Why It Matters:**
- **Search Ineffective:** User can't verify search worked correctly
- **Context Loss:** No geographic context visible on initial result
- **Usability:** For AFM searches, region would clarify which person matched

**Current Code:**
- [beneficiaries-page.tsx](beneficiaries-page.tsx#L385-L410): Search supports region but doesn't filter results
- [beneficiaries-page.tsx](beneficiaries-page.tsx#L827-L838): Region shows on card back only
- [beneficiaries-page.tsx](beneficiaries-page.tsx#L679): Region shown in list view

**Note:** Actually region IS shown in list view (line 679), so this may be less critical. **Defer to audit**

---

### 🟠 **IMPORTANT #6: No Validation Feedback When Editing Engineer Fields**

**Problem:**
- Modal allows user to select engineers via combobox (good UX)
- But in Details tab edit mode, if engineer lookup fails, user sees spinning "Φόρτωση μηχανικών..."
- If engineers never load, field stays in loading state forever
- No error message or retry mechanism

**Why It Matters:**
- **User Trapped:** Can't complete form if engineer data fails to load
- **No Clarity:** Is the system broken or just slow?
- **Form Submission Block:** Can't save beneficiary without knowing if engineers field is valid

**Current Code:**
- [BeneficiaryDetailsModal.tsx](BeneficiaryDetailsModal.tsx#L581-L595): `isEngineersLoading` spinner shown indefinitely
- No error state or timeout handling
- No fallback if fetch fails

**Implementable Fix:**
1. Add error state to engineer combobox and form field validation:

```tsx
// In BeneficiaryDetailsModal.tsx, update engineer loading + error handling
const { 
  data: engineersResponse, 
  isLoading: isEngineersLoading,
  error: engineersError  // NEW
} = useQuery({
  queryKey: ["/api/employees/engineers"],
  queryFn: async () => { ... },
  retry: 2,  // Retry failed requests
  staleTime: 30 * 60 * 1000,
  gcTime: 60 * 60 * 1000,
  refetchOnWindowFocus: false,
  refetchOnMount: false,
});

// In form field rendering:
{isEditing ? (
  <FormField
    control={form.control}
    name="ceng1"
    render={({ field }) => (
      <FormItem className="flex flex-col mt-1">
        <EngineerCombobox
          engineers={engineers}
          value={field.value}
          onValueChange={field.onChange}
          placeholder="Επιλέξτε μηχανικό..."
          testId="select-ceng1"
          isLoading={isEngineersLoading}
          error={engineersError?.message}  // NEW: Pass error
          onRetry={() => queryClient.refetchQueries({ queryKey: ["/api/employees/engineers"] })}  // NEW: Allow retry
        />
        {engineersError && (
          <FormMessage className="text-red-600 text-xs mt-1">
            Σφάλμα φόρτωσης μηχανικών. <Button size="xs" variant="link" onClick={() => ...}>Δοκιμήστε ξανά</Button>
          </FormMessage>
        )}
      </FormItem>
    )}
  />
) : (
  <p className="text-orange-900 font-medium mt-1">
    {getEngineerName(beneficiary?.ceng1)}
  </p>
)}
```

---

### 🟠 **IMPORTANT #7: Modal Close Without Save = Silent State Loss**

**Problem:**
- User edits beneficiary details in modal (name, engineers, freetext)
- Modal closes without clicking Save (e.g., clicks X, presses Esc)
- Form state reverts silently
- **No confirmation dialog** asking "Do you want to save changes?"

**Why It Matters:**
- **Data Loss:** Operator loses edits without knowing
- **Audit Risk:** If someone was editing and modal closes, no log of what they were doing
- **UX Confusion:** User thinks they saved but didn't

**Current Code:**
- [BeneficiaryDetailsModal.tsx](BeneficiaryDetailsModal.tsx#L915): `onOpenChange` closes modal without checking for unsaved changes
- No `beforeunload` or form dirty state check

**Implementable Fix:**
1. Check form dirty state on modal close:

```tsx
// In BeneficiaryDetailsModal.tsx, update onOpenChange handler
const handleModalClose = (shouldClose: boolean) => {
  if (!shouldClose) {
    // Modal is being closed
    if (isEditing && form.formState.isDirty) {
      // Show confirmation dialog
      if (!confirm("Έχετε αποθηκεύσει τις αλλαγές σας; Κλείστε χωρίς αποθήκευση;")) {
        return;  // Don't close
      }
    }
  }
  onOpenChange(shouldClose);
};

// Use in Dialog:
<Dialog open={open} onOpenChange={handleModalClose}>
```

---

### 🟠 **IMPORTANT #8: Payment Edit Mode Has No Clear Completion Visual**

**Problem:**
- Payment card shows "Επεξεργασία" button
- User clicks it → switches to edit mode with X and Save buttons
- After saving, payment card returns to normal state
- **But:** No visual feedback of what changed (background highlight, color pulse, etc.)
- User doesn't know if their edit persisted

**Why It Matters:**
- **Operator Uncertainty:** Did the save work?
- **Potential Re-edit:** User might click save twice thinking it didn't work
- **Audit Trail:** No visual history of what was modified

**Current Code:**
- [BeneficiaryDetailsModal.tsx](BeneficiaryDetailsModal.tsx#L1305-L1325): Payment card edit mode exists but no visual completion indicator

**Implementable Fix:**
1. Add temporary success flash on payment card after save:

```tsx
// In BeneficiaryDetailsModal.tsx, add state for recently saved payment IDs
const [recentlySavedPayments, setRecentlySavedPayments] = useState<Set<number>>(new Set());

// In updatePaymentMutation.onSuccess:
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["/api/beneficiary-payments"] });
  setEditingPayment(null);
  
  // NEW: Add visual feedback
  setRecentlySavedPayments(prev => new Set(prev).add(paymentId));
  setTimeout(() => {
    setRecentlySavedPayments(prev => {
      const next = new Set(prev);
      next.delete(paymentId);
      return next;
    });
  }, 2000);  // Flash for 2 seconds
  
  toast({ title: "Επιτυχία", description: "Η πληρωμή ενημερώθηκε επιτυχώς" });
};

// In payment card rendering:
<div key={payment.id} className={`
  bg-white p-6 rounded-xl border border-gray-200 shadow-sm 
  ${recentlySavedPayments.has(payment.id) ? 'bg-green-50 border-green-300' : ''} 
  transition-colors duration-200
`}>
```

---

### 🟠 **IMPORTANT #9: Card Flip UX Unintuitive for New Users**

**Problem:**
- Cards have "flip" animation on click
- Front shows summary, back shows details
- **But:** No visual indicator that card is "flipable"
- At bottom of front: "Περισσότερα στοιχεία" button (More details)
- **Contradiction:** Button suggests it's modal-like, but it's actually flip-animation

**Why It Matters:**
- **Discovery:** Users don't know cards are interactive
- **Accessibility:** Animation-based interaction is invisible to assistive tech
- **Cognitive Load:** "Flip" is not a common pattern for financial app UX

**Current Code:**
- [beneficiaries-page.tsx](beneficiaries-page.tsx#L821): `onClick={handleCardClick}` triggers flip
- No visual cues (rotation, cursor change, hover effect on non-button areas)

**Implementable Fix:**
1. Add visual flip indicator and improve UX:

```tsx
// In card CSS (add to component styles or Tailwind):
.flip-card {
  cursor: pointer;  // Show clickable
  position: relative;
}

.flip-card:hover::before {
  content: '';  // Visual flip indicator on hover
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 12px;
  color: #999;
  pointer-events: none;
}

// In flip card front, add flip icon next to button:
<Button
  variant="outline"
  size="sm"
  onClick={() => toggleCardFlip(beneficiary.id)}
  className="text-purple-600 border-purple-200 hover:bg-purple-50"
>
  <RotateCw className="w-4 h-4 mr-2" />  {/* NEW: Rotation icon */}
  Περισσότερα στοιχεία
</Button>
```

---

### 🟠 **IMPORTANT #10: No Indication of Payment "Status" in List View**

**Problem:**
- List view shows payment count and total
- But doesn't indicate if any are pending vs paid
- User sees "3 πληρωμές" without knowing if they're all processed or some are stuck in approval

**Why It Matters:**
- **Operational Visibility:** No quick scan for "which beneficiaries have pending payments"
- **Risk Management:** Can't prioritize follow-up without opening each modal
- **Audit Trail:** Status visibility is critical for public-sector financial tracking

**Current Code:**
- [beneficiaries-page.tsx](beneficiaries-page.tsx#L673-L680): List view shows count + total only

**Note:** This is similar to IMPORTANT #2 but for list view specifically.

**Implementable Fix:**
Same as IMPORTANT #2 suggestion – add status badges to list view payment summary.

---

### 🟠 **IMPORTANT #11: AFM Field Validation Error Message Not Greek-Localized Clearly**

**Problem:**
- Modal AFM field validation: "Μη έγκυρο ΑΦΜ" (Invalid AFM)
- But doesn't say **why** it's invalid
- User doesn't know: wrong checksum? wrong length? not numeric?

**Why It Matters:**
- **Operator Frustration:** Can't fix validation error without understanding it
- **Data Entry Burden:** Has to try random values until validation passes
- **User Trust:** Unclear error messages reduce confidence in system

**Current Code:**
- [beneficiaries-page.tsx](beneficiaries-page.tsx#L109-L121): Validation schema with generic error message

**Implementable Fix:**
1. Improve validation error messages:

```tsx
// In beneficiaryFormSchema validation:
afm: z
  .string()
  .length(9, "Το ΑΦΜ πρέπει να έχει ακριβώς 9 ψηφία")
  .regex(/^\d{9}$/, "Το ΑΦΜ πρέπει να περιέχει μόνο ψηφία 0-9")
  .refine((val) => {
    // Greek AFM validation algorithm
    const digits = val.split("").map(Number);
    let sum = 0;
    for (let i = 0; i < 8; i++) {
      sum += digits[i] * Math.pow(2, 8 - i);
    }
    const remainder = sum % 11;
    const checkDigit = remainder < 2 ? remainder : 11 - remainder;
    return checkDigit === digits[8];
  }, "Το τελευταίο ψηφίο ΑΦΜ δεν ταιριάζει με τον αλγόριθμο ελέγχου (έγκυρο ελληνικό ΑΦΜ απαιτείται)")
```

---

### 🟠 **IMPORTANT #12: Search Function Unclear Scope**

**Problem:**
- Input placeholder: "Αναζήτηση δικαιούχων (όνομα, επώνυμο, ΑΦΜ, περιοχή)..."
- But implementation:
  - AFM: Server-side search optimized (line 372-379)
  - Name/Surname: Client-side filtering (line 381-394)
  - Region: **Not actually searched** (listed in placeholder but no filter logic)

**Why It Matters:**
- **Broken Feature:** User types "Αττική" expecting to find beneficiaries by region, gets nothing
- **Operator Confusion:** Placeholder promises region search but doesn't deliver
- **Inconsistent UX:** Some searches are fast (AFM server) others are slow (client filtering)

**Current Code:**
- [beneficiaries-page.tsx](beneficiaries-page.tsx#L381-L394): Filter only by name/surname, no region logic

**Implementable Fix:**
1. **Option A (Simple):** Update placeholder to match actual behavior:
```tsx
// BEFORE:
placeholder="Αναζήτηση δικαιούχων (όνομα, επώνυμο, ΑΦΜ, περιοχή)..."

// AFTER:
placeholder="Αναζήτηση δικαιούχων (όνομα, επώνυμο, ΑΦΜ)..."
```

2. **Option B (Better):** Implement region filtering:
```tsx
// In filteredBeneficiaries memoization (line 375-410)
const filteredBeneficiaries = useMemo(() => {
  if (afmSearchResults) return afmSearchResults;
  
  if (!searchTerm.trim()) return beneficiaries;
  
  const searchLower = searchTerm.toLowerCase();
  return beneficiaries.filter((beneficiary) => {
    // Existing name/surname check
    const nameMatch = beneficiary.surname?.toLowerCase().includes(searchLower) ||
                      beneficiary.name?.toLowerCase().includes(searchLower);
    
    // NEW: Region check
    const regions = formatRegiondet(beneficiary.regiondet);
    const regionMatch = regions.some(r => r.toLowerCase().includes(searchLower));
    
    return nameMatch || regionMatch;
  });
}, [beneficiaries, searchTerm, afmSearchResults]);
```

---

## C. OPTIONAL ENHANCEMENTS (Pure UX Polish, Zero Business Impact)

### 💡 **OPT #1: Card "Back" State Overflow Not Scrollable**

**Problem:**
- Card back shows financial overview + admin info + engineering info + notes
- On small screens, content may overflow without scroll
- User can't see all details on card back

**Impact:** Low – modal shows same info in scrollable tab
**Fix:** Add `overflow-y-auto` to flip-card-back content area

---

### 💡 **OPT #2: Engineer Combobox Search Could Support Reverse Name Order**

**Problem:**
- Searching "Παπαδόπουλος Ιωάννης" works
- Searching "Ιωάννης Παπαδόπουλος" (reverse) doesn't find "Παπαδόπουλος Ιωάννης"

**Impact:** Low – user can search by surname first
**Fix:** Already implemented at [BeneficiaryDetailsModal.tsx](BeneficiaryDetailsModal.tsx#L237-L242), just hidden in code

---

### 💡 **OPT #3: Copy Button Feedback Animation Too Fast**

**Problem:**
- AFM copy button shows toast notification (1-2 seconds)
- Button doesn't give visual feedback (no color change, hover state)
- User might click again thinking it didn't work

**Impact:** Very low – toast appears
**Fix:** Add temporary button color change on copy success

---

---

## D. EDGE CASES & HIGH-RISK SCENARIOS

### Edge Case #1: Beneficiary with Multiple Project-Indexed Regiondet Entries

**Risk: Data Merging Inconsistency**

**Scenario:**
- Beneficiary linked to Project A in Αττική (regiondet entry 1)
- Later added to Project B in Θεσσαλονίκη (regiondet entry 2)
- DB has beneficiary with `regiondet = [{regions: [{name: "Αττική"}]}, {regions: [{name: "Θεσσαλονίκη"}]}]`

**Current Behavior:**
- [formatRegiondet()](BeneficiaryDetailsModal.tsx#L82-L112) **merges all entries** using Sets (deduplication)
- Result: Shows both Αττική and Θεσσαλονίκη as if beneficiary operates in both

**Problem:**
- Auditor sees: Beneficiary in 2 regions → assumes legitimate operation
- Reality: Only Project A (Αττική) is valid; Project B (Θεσσαλονίκη) may have been deleted

**Fix Required:**
- Show region data **per-project**, not merged
- In Details tab: "Πρόγραμμα A: Αττική | Πρόγραμμα B: Θεσσαλονίκη"

---

### Edge Case #2: Beneficiary Created, No Payments Added

**Risk: Incomplete Data Record**

**Scenario:**
- User creates beneficiary with all fields
- Never adds a payment (no installment, amount, etc.)
- Beneficiary sits in DB with no financial context

**Current Behavior:**
- Card shows no payment info (empty state)
- Modal shows "Δεν υπάρχουν πληρωμές"
- No indication if this is incomplete setup vs legitimate (waiting-for-funding) state

**Audit Problem:**
- Beneficiary in system but no transaction trail
- Compliance auditor can't determine: Is this person actually receiving funds?

**Fix Recommended:**
- Add creation date + "last modified" date to card
- Show on card: "Δημιουργήθηκε: {date} | Δεν υπάρχουν πληρωμές"

---

### Edge Case #3: AFM Masked But Search Results Refer to Full AFM

**Risk: Mismatch During High-Volume Search**

**Scenario:**
- Beneficiary AFM: 123456789 (masked as 123456789 in list)
- User searches "123456789" via AFM search
- Results return unmasked AFM from full data fetch
- **If there are duplicate/similar AFMs**, user could select wrong beneficiary

**Current Behavior:**
- [beneficiaries-page.tsx](beneficiaries-page.tsx#L372-L379): AFM search uses server endpoint
- [BeneficiaryDetailsModal.tsx](BeneficiaryDetailsModal.tsx#L401): Full AFM fetched when modal opens

**Fix Recommended:**
- Always validate full AFM matches before linking payment
- Confirmation dialog: "Confirm linking payment to {surname} {name} ΑΦΜ {full_afm}?"

---

### Edge Case #4: Rapid Payment Additions Cause Race Condition

**Risk: Payment Duplication or Loss**

**Scenario:**
- User opens beneficiary modal
- Clicks "Νέα Πληρωμή" twice rapidly
- Two requests sent to API

**Current Behavior:**
- [BeneficiaryDetailsModal.tsx](BeneficiaryDetailsModal.tsx#L784-L803): `addPaymentMutation` doesn't have loading state disabling the button
- Button stays clickable

**Fix Recommended:**
```tsx
// In "Νέα Πληρωμή" button:
<Button
  onClick={handleAddNewPayment}
  size="sm"
  disabled={addPaymentMutation.isPending}  // ADD THIS
  className="bg-green-600 hover:bg-green-700"
>
  <Plus className="w-4 h-4 mr-1" />
  {addPaymentMutation.isPending ? "Αποθήκευση..." : "Νέα Πληρωμή"}
</Button>
```

---

### Edge Case #5: Deleted Engineer – Foreign Key Constraint

**Risk: Orphaned Reference**

**Scenario:**
- Beneficiary linked to Engineer ID 42 (ceng1)
- Engineer 42 is deleted from DB (without cascade)
- Modal engineer combobox doesn't show engineer 42
- Modal shows: "Δεν έχει καθοριστεί" but DB has `ceng1=42`

**Current Behavior:**
- [BeneficiaryDetailsModal.tsx](BeneficiaryDetailsModal.tsx#L745): `getEngineerName(beneficiary?.ceng1)` returns "Δεν έχει καθοριστεί" if not found
- No error message about broken reference

**Fix Recommended:**
1. Show warning if engineer not found in combobox:
```tsx
{beneficiary?.ceng1 && !engineerMap?.has(beneficiary.ceng1) && (
  <Badge variant="destructive" className="text-xs">
    ⚠️ Ο μηχανικός έχει διαγραφεί
  </Badge>
)}
```
2. Allow nullification: "Αφαίρεση μηχανικού" button

---

## E. DATA FETCHING & CACHING CONSISTENCY SUMMARY

| Data Source | Location | Fetch Strategy | Cache TTL | Invalidation |
|---|---|---|---|---|
| **Beneficiaries List** | Page + Card | `GET /api/beneficiaries` | 5 min | On create/update/delete |
| **Full Beneficiary (unmasked AFM)** | Modal Details | `GET /api/beneficiaries/{id}` | staleTime: 0 | On modal open, always fresh |
| **Payments (visible page)** | Page + Card totals | `GET /api/beneficiary-payments?ids=...` | 2 min | On payment mutation |
| **Payments (modal)** | Modal Payments tab | `GET /api/beneficiary-payments?id=...` | default | On payment mutation |
| **Engineers** | Modal selectors | `GET /api/employees/engineers` | 30 min | Prefetch on page load |
| **Geographic Data** | Modal geo selector | `GET /api/geographic-data` | 60 min | On modal open |
| **Projects** | Beneficiary form | `GET /api/projects` | 10 min | On form mount |

**Key Risks:**
- ⚠️ Payment cache in page (2 min) vs modal (fresh) can diverge
- ⚠️ Beneficiary list not invalidated when regional data changes
- ⚠️ No cache invalidation on engineer delete

---

## F. REQUIRED SCHEMA NOTES

The following fixes assume **no schema changes**:
- ✅ regiondet can store array of objects (already multi-entry capable)
- ✅ AFM hashing already implemented (afm_hash field exists)
- ✅ Engineer foreign keys already in place (ceng1, ceng2)
- ✅ Payment status already tracked
- ✅ Freetext field multi-use (notes/EPS confusion is UI only)

---

## IMPLEMENTATION PRIORITY

### Phase 1 (Weeks 1-2): CRITICAL Issues
1. Fix AFM masking inconsistency (CRITICAL #1)
2. Fix payment amount divergence (CRITICAL #2)
3. Remove duplicate geographic selectors (CRITICAL #3)

### Phase 2 (Weeks 3-4): IMPORTANT Issues
4. Resolve engineer name display (IMPORTANT #1)
5. Add payment status indicators (IMPORTANT #2)
6. Clarify empty states (IMPORTANT #3)
7. Fix EPS labeling (IMPORTANT #4)
8. Add engineer load error handling (IMPORTANT #6)
9. Add unsaved changes confirmation (IMPORTANT #7)

### Phase 3 (Weeks 5+): Nice-to-Have
10. Payment card save feedback (IMPORTANT #8)
11. Card flip UX improvement (IMPORTANT #9)
12. Search scope clarification (IMPORTANT #12)
13. AFM validation messages (IMPORTANT #11)

---

## TESTING CHECKLIST

- [ ] Verify AFM consistency: card (masked) vs modal (unmasked)
- [ ] Verify payment amount: card total = modal total after add/edit
- [ ] Verify regiondet: single source of truth (no duplicate edits)
- [ ] Verify engineer names resolve on cards (not just IDs)
- [ ] Verify payment status visible on both card and modal
- [ ] Verify form unsaved changes warning on modal close
- [ ] Verify empty state shows for no-payment beneficiaries
- [ ] Verify geographic selector loads and handles errors
- [ ] Verify AFM search returns correct beneficiary
- [ ] Verify card flip doesn't interfere with button clicks

---

## CONCLUSION

The Beneficiary Page has **solid technical foundation** (caching, queries, state management) but **UX/clarity issues** that could lead to operator errors in payment matching and geographic assignment.

**Immediate fixes** focus on:
1. **Data consistency** (same totals everywhere)
2. **Visual clarity** (status, regions, engineers visible upfront)
3. **Error handling** (load failures, validation feedback)
4. **Confirmation dialogs** (prevent accidental data loss)

These changes are **implementable with existing code patterns** and require **zero schema modifications**.

---

**Audit Completed:** 2026-01-28  
**Risk Level:** MEDIUM-HIGH  
**Recommendation:** Prioritize CRITICAL issues for next sprint
