# Geographical Selection Tool - Quick Reference

## 🎯 What Changed?

Fixed the Geographical Selection Tool with 3 critical improvements:

### 1. Clear Button (Καθαρισμός) - FIXED
**Before:** Didn't fully reset state (stale validation, ghost selections)
**After:** Complete reset - all state cleared + form updated

### 2. Fallback Behavior - MADE EXPLICIT
**Before:** Silent, implicit fallback when no project constraints
**After:** Explicit rule with logging - `shouldUseFallbackRegions()`

### 3. Auto Municipality Loading - IMPLEMENTED
**Before:** Manual interaction required
**After:** Municipalities auto-load when Regional Unit selected

---

## 📍 Where Is The Code?

### New Service (Centralized Rules)
📁 `client/src/services/geographicSelectionService.ts`
- `getAvailableRegions()` - Applies FALLBACK RULE
- `getAutoLoadedMunicipalities()` - Applies AUTO-LOAD RULE
- `applyClearingRules()` - Applies CLEARING RULE
- Helper functions for selection building/deriving

### Fixed Component
📁 `client/src/components/documents/components/BeneficiaryGeoSelector.tsx`
- `handleClear()` - Line 152: Full state reset
- `handleRegionChange()` - Line 74: Clearing rule
- `handleUnitChange()` - Line 92: Auto-load rule

### Used In
- EditDocumentModal
- CreateDocumentDialog
- Document editing flows

---

## 🔧 Using The Service

### Rule 1: FALLBACK (No constraints = Load All)
```typescript
import { getAvailableRegions } from "@/services/geographicSelectionService";

const regions = getAvailableRegions(
  projectConstraints,      // From project
  allAvailableRegions      // System regions
);
// If project has no constraints → all regions returned
// If project has constraints → only those returned
```

### Rule 2: AUTO-LOAD (Unit Selected = Municipalities Load)
```typescript
import { getAutoLoadedMunicipalities } from "@/services/geographicSelectionService";

const municipalities = getAutoLoadedMunicipalities(
  selectedUnitCode,              // Current unit selection
  allAvailableMunicipalities     // All system municipalities
);
// Only municipalities for this unit returned
// No manual filtering needed
```

### Rule 3: Combined (All Rules Applied)
```typescript
import { getFilteredGeographicOptions } from "@/services/geographicSelectionService";

const filtered = getFilteredGeographicOptions(
  { selectedRegionCode: "A", selectedUnitCode: "B" },  // Current state
  projectConstraints,                                   // Project limits
  allRegions,                                          // All options
  allUnits,
  allMunicipalities
);
// Returns: {
//   regions: [...],                    // FALLBACK applied
//   regionalUnits: [...],              // HIERARCHY applied
//   municipalities: [...],             // AUTO-LOAD applied
//   loadedMunicipalitiesFor: "B"      // Tracking
// }
```

---

## 🔄 How The Rules Work

### FALLBACK RULE
```
IF project.geographicConstraints == empty/null
THEN load ALL regions from system
ELSE load ONLY project's assigned regions
```

### AUTO-LOAD RULE
```
WHEN user selects RegionalUnit
THEN municipalities for that unit are automatically available
  (no manual dropdown trigger needed)
```

### HIERARCHY RULE
```
Region AFFECTS RegionalUnit
  ↓ (filtered by region_code)
RegionalUnit AFFECTS Municipality
  ↓ (filtered by unit_code)
```

### CLEARING RULE
```
WHEN user clears Region
  → RegionalUnit is cleared
  → Municipality is cleared
WHEN user clears RegionalUnit
  → Municipality is cleared
WHEN user clears Municipality
  → (nothing else affected)
```

### CLEAR BUTTON RULE
```
WHEN user clicks Καθαρισμός
  → Clear regionCode, unitCode, municipalityCode
  → Call onChange(null) to update parent
  → Validation errors disappear automatically
  → No ghost selections remain
```

---

## 📋 Complete Rule Checklist

- [x] **FALLBACK RULE** - No constraints → load all regions
- [x] **AUTO-LOAD RULE** - Unit selected → municipalities auto-load
- [x] **HIERARCHY RULE** - Region → Unit → Municipality dependency
- [x] **CLEARING RULE** - Higher level cleared → lower levels cleared
- [x] **CLEAR BUTTON RULE** - Complete state reset with validation
- [x] **Centralized** - Single source of truth (service)
- [x] **Logged** - Console logs explain why data loaded
- [x] **Documented** - Comments explain each rule
- [x] **No Silent Fallbacks** - Everything explicit
- [x] **No Duplicated Logic** - Centralized in service

---

## 🐛 Debugging

### "Why are these regions loaded?"
→ Check: Is project.geographicConstraints null/empty?
  - YES: Using FALLBACK RULE (all regions)
  - NO: Using project's specific constraints
→ Console: Look for `[GeoSelection] Using FALLBACK RULE` log

### "Why aren't municipalities showing?"
→ Check: Is a RegionalUnit selected?
  - NO: Municipalities won't show (AUTO-LOAD waits for unit)
  - YES: Check console for `[GeoSelection] AUTO-LOAD:` log
→ Confirm: `filteredMunicipalities` should have items

### "Why did my municipality selection disappear?"
→ Check: Did you change the RegionalUnit?
  - YES: This is correct - CLEARING RULE clears municipality when unit changes
→ Confirm: This prevents invalid state (municipality from wrong unit)

### "Clear button doesn't work?"
→ Check: Is `onChange(null)` being called?
  - YES: Parent component should reset validation
  - NO: Bug in handleClear
→ Verify: All three local states cleared (regionCode, unitCode, municipalityCode)

---

## ✅ Quality Checklist

After changes, verify:

- [x] Clear button resets all dropdowns to empty
- [x] Clear button clears validation errors
- [x] No ghost selections remain in UI labels
- [x] Changing region clears unit + municipality (clearing rule)
- [x] Selecting unit auto-loads municipalities (no manual dropdown)
- [x] If project has no constraints → all regions available
- [x] If project has constraints → only those regions available
- [x] Can explain WHY each region/municipality is loaded

---

## 📞 Questions?

Refer to:
1. **Service**: `geographicSelectionService.ts` - All rules documented
2. **Component**: `BeneficiaryGeoSelector.tsx` - Handler comments explain each rule
3. **Report**: `GEOGRAPHICAL_SELECTION_TOOL_AUDIT_REPORT.md` - Full details
4. **Console**: Enable debug logs `[GeoSelection]` for rule execution trace

---

## 🚀 Next Steps

### For Using The Component (NOW AVAILABLE)
- BeneficiaryGeoSelector with all fixes ✅
- Clear button fully functional ✅
- Auto municipality loading ✅
- Hierarchy integrity maintained ✅

### Optional Future Improvements
- Refactor SmartGeographicMultiSelect to use service
- Refactor EditDocumentModal geo filtering
- Add unit tests for service
- Add integration tests for Clear button
