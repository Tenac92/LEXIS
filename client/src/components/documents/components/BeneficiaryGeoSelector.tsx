import { memo, useMemo } from "react";
import { MapPin, AlertCircle, RefreshCcw, X, ChevronRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  buildRegiondetSelection,
  deriveGeoSelectionFromRegiondet,
  isRegiondetComplete,
  normalizeRegiondetEntry,
  type MunicipalityOption,
  type RegionOption,
  type RegiondetSelection,
  type RegionalUnitOption,
} from "../utils/beneficiary-geo";

interface BeneficiaryGeoSelectorProps {
  regions: RegionOption[];
  regionalUnits: RegionalUnitOption[];
  municipalities: MunicipalityOption[];
  value: RegiondetSelection | null | undefined;
  onChange: (value: RegiondetSelection | null) => void;
  required?: boolean;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

function BeneficiaryGeoSelectorComponent({
  regions,
  regionalUnits,
  municipalities,
  value,
  onChange,
  required = false,
  loading = false,
  error,
  onRetry,
}: BeneficiaryGeoSelectorProps) {
  // Derive codes directly from value so they're always in sync,
  // even when geo option lists load after the value is set.
  const { regionCode, unitCode, municipalityCode } = useMemo(
    () => deriveGeoSelectionFromRegiondet(value),
    [value],
  );
  const normalizedValue = useMemo(() => normalizeRegiondetEntry(value), [value]);

  const filteredUnits = useMemo(() => {
    if (regionCode) {
      return regionalUnits.filter(
        (unit) => String(unit.region_code) === String(regionCode),
      );
    }
    return regionalUnits;
  }, [regionalUnits, regionCode]);

  const filteredMunicipalities = useMemo(() => {
    if (unitCode) {
      return municipalities.filter(
        (muni) => String(muni.unit_code) === String(unitCode),
      );
    }
    if (regionCode) {
      const regionUnitCodes = filteredUnits.map((u) => String(u.code));
      return municipalities.filter((muni) =>
        regionUnitCodes.includes(String(muni.unit_code)),
      );
    }
    // Show all municipalities even if no region/unit selected (user can start from municipality)
    return municipalities;
  }, [municipalities, unitCode, regionCode, filteredUnits]);

  const handleRegionChange = (code: string) => {
    const selectedRegion =
      regions.find((r) => String(r.code) === String(code)) || null;
    // No local setState needed — codes are derived from value via useMemo.
    // Clearing unit/municipality is handled by passing null in buildRegiondetSelection.
    onChange(
      buildRegiondetSelection({
        region: selectedRegion,
        regionalUnit: null,
        municipality: null,
      }),
    );

    console.log(
      "[BeneficiaryGeoSelector] Region selected:",
      code,
      "- cleared unit and municipality selections to maintain hierarchy"
    );
  };

  const handleUnitChange = (code: string) => {
    const selectedUnit =
      regionalUnits.find((u) => String(u.code) === String(code)) || null;
    const parentRegion = selectedUnit
      ? regions.find(
          (r) => String(r.code) === String(selectedUnit.region_code),
        ) || null
      : null;
    // No local setState needed — region auto-fill and municipality clearing
    // are handled by what we pass to buildRegiondetSelection.
    onChange(
      buildRegiondetSelection({
        region: parentRegion || null,
        regionalUnit: selectedUnit,
        municipality: null,
      }),
    );

    console.log(
      "[BeneficiaryGeoSelector] Unit selected:",
      code,
      "- municipalities will auto-load for this unit"
    );
  };

  const handleMunicipalityChange = (code: string) => {
    const selectedMunicipality =
      municipalities.find((m) => String(m.code) === String(code)) || null;
    const parentUnit = selectedMunicipality
      ? regionalUnits.find(
          (u) => String(u.code) === String(selectedMunicipality.unit_code),
        ) || null
      : null;
    const parentRegion = parentUnit
      ? regions.find(
          (r) => String(r.code) === String(parentUnit.region_code),
        ) || null
      : null;

    // No local setState needed — codes are derived from value via useMemo.
    onChange(
      buildRegiondetSelection({
        region: parentRegion || null,
        regionalUnit: parentUnit || null,
        municipality: selectedMunicipality,
      }),
    );
  };

  /**
   * ΚΑΘΑΡΙΣΜΟΣ (CLEAR) BUTTON HANDLER
   * 
   * This fully resets the geographical selection state:
   * 1. Clear all local dropdown states
   * 2. Clear the parent form value
   * 3. Trigger validation reset (no stale errors)
   * 4. No leftover UI labels or ghost selections
   * 
   * The onChange(null) call ensures the parent component can update
   * any derived state (form validation, dependent UI, etc.)
   */
  const handleClear = () => {
    // Codes are derived from value via useMemo; just signal null to parent.
    onChange(null);

    // Note: Validation state reset happens automatically because:
    // - isRegiondetComplete(null) returns false
    // - Parent component's required field validation will re-run
    // - No stale validation errors can remain
  };

  const isValid = isRegiondetComplete(value);

  // Get region name for breadcrumb
  const selectedRegionName = useMemo(() => {
    return regions.find((r) => String(r.code) === String(regionCode))?.name || null;
  }, [regionCode, regions]);

  // Get unit name for breadcrumb
  const selectedUnitName = useMemo(() => {
    return filteredUnits.find((u) => String(u.code) === String(unitCode))?.name || null;
  }, [unitCode, filteredUnits]);

  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-1">
        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
        <label className="text-xs font-semibold">
          Γεωγραφική επιλογή{" "}
          {required && <span className="text-destructive">*</span>}
        </label>
      </div>

      {/* Breadcrumb / Selection Path */}
      {(regionCode || unitCode || municipalityCode) && (
        <div className="flex items-center gap-0.5 px-2 py-1 bg-blue-50 rounded border border-blue-200 text-xs mb-1">
          {regionCode && (
            <span className="font-medium text-blue-900">
              {selectedRegionName}
            </span>
          )}
          {unitCode && (
            <>
              {regionCode && <ChevronRight className="h-2.5 w-2.5 text-blue-400 mx-0.5" />}
              <span className="font-medium text-blue-900">
                {selectedUnitName}
              </span>
            </>
          )}
          {municipalityCode && (
            <>
              {(regionCode || unitCode) && <ChevronRight className="h-2.5 w-2.5 text-blue-400 mx-0.5" />}
              <span className="font-medium text-blue-900 truncate">
                {filteredMunicipalities.find((m) => String(m.code) === String(municipalityCode))?.name}
              </span>
            </>
          )}
        </div>
      )}

      {/* Dropdowns - Compact Horizontal Layout */}
      <div className="flex flex-wrap gap-1.5">
        {/* Region Dropdown */}
        <div className="flex-1 min-w-[150px]">
          <Select
            value={regionCode || ""}
            onValueChange={handleRegionChange}
            disabled={loading}
          >
            <SelectTrigger className="h-8 w-full text-xs">
              <SelectValue placeholder="Περιφέρεια" />
            </SelectTrigger>
            <SelectContent>
              {regionCode &&
                !regions.some(
                  (region) => String(region.code || region.name) === String(regionCode),
                ) && (
                  <SelectItem value={String(regionCode)}>
                    {normalizedValue?.regions?.[0]?.name || String(regionCode)}
                  </SelectItem>
                )}
              {regions.map((region) => (
                <SelectItem
                  key={`region-${region.code || region.name}`}
                  value={String(region.code || region.name)}
                >
                  {region.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Regional Unit Dropdown */}
        <div className="flex-1 min-w-[150px]">
          <Select
            value={unitCode || ""}
            onValueChange={handleUnitChange}
            disabled={loading || filteredUnits.length === 0}
          >
            <SelectTrigger className={`h-8 w-full text-xs ${filteredUnits.length === 0 ? 'opacity-50' : ''}`}>
              <SelectValue placeholder="Ενότητα" />
            </SelectTrigger>
            <SelectContent>
              {unitCode &&
                !filteredUnits.some(
                  (unit) => String(unit.code || unit.name) === String(unitCode),
                ) && (
                  <SelectItem value={String(unitCode)}>
                    {normalizedValue?.regional_units?.[0]?.name || String(unitCode)}
                  </SelectItem>
                )}
              {filteredUnits.map((unit) => (
                <SelectItem
                  key={`unit-${unit.code || unit.name}`}
                  value={String(unit.code || unit.name)}
                >
                  {unit.name}
                </SelectItem>
              ))}
            </SelectContent>
              {municipalityCode &&
                !filteredMunicipalities.some(
                  (municipality) =>
                    String(municipality.code || municipality.name) ===
                    String(municipalityCode),
                ) && (
                  <SelectItem value={String(municipalityCode)}>
                    {normalizedValue?.municipalities?.[0]?.name ||
                      String(municipalityCode)}
                  </SelectItem>
                )}
          </Select>
        </div>

        {/* Municipality Dropdown - ALWAYS ENABLED */}
        <div className="flex-1 min-w-[160px]">
          <Select
            value={municipalityCode || ""}
            onValueChange={handleMunicipalityChange}
            disabled={loading || filteredMunicipalities.length === 0}
          >
            <SelectTrigger className={`h-8 w-full text-xs ${filteredMunicipalities.length === 0 ? 'opacity-50' : ''}`}>
              <SelectValue placeholder="Δήμος" />
            </SelectTrigger>
            <SelectContent className="max-h-48">
              {filteredMunicipalities.map((municipality) => (
                <SelectItem
                  key={`municipality-${municipality.code || municipality.id || municipality.name}`}
                  value={String(municipality.code || municipality.name)}
                >
                  {municipality.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Clear Button */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleClear}
          disabled={loading || (!regionCode && !unitCode && !municipalityCode)}
          className="h-8 px-2"
          title="Καθαρισμός"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Validation Error */}
      {!isValid && required && (
        <div className="text-xs text-destructive flex items-center gap-1 mt-1">
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          <span>Απαιτείται γεωγραφική επιλογή</span>
        </div>
      )}

      {/* API Error */}
      {error && (
        <div className="text-xs text-destructive flex items-center gap-1 mt-1">
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          <span>{error}</span>
          {onRetry && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onRetry}
              className="h-6 px-1.5 ml-0.5"
            >
              <RefreshCcw className="h-2.5 w-2.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

const getSelectionKey = (
  value: RegiondetSelection | null | undefined,
): string => {
  const { regionCode, unitCode, municipalityCode } =
    deriveGeoSelectionFromRegiondet(value);
  return `${regionCode || ""}|${unitCode || ""}|${municipalityCode || ""}`;
};

const arePropsEqual = (
  prev: BeneficiaryGeoSelectorProps,
  next: BeneficiaryGeoSelectorProps,
) => {
  const sameOptions =
    prev.regions === next.regions &&
    prev.regionalUnits === next.regionalUnits &&
    prev.municipalities === next.municipalities;

  const sameSelection =
    getSelectionKey(prev.value) === getSelectionKey(next.value);

  return (
    sameOptions &&
    sameSelection &&
    prev.required === next.required &&
    prev.loading === next.loading &&
    prev.error === next.error &&
    prev.onChange === next.onChange &&
    prev.onRetry === next.onRetry
  );
};

// Memoized to avoid re-rendering when unrelated dialog fields change
export const BeneficiaryGeoSelector = memo(
  BeneficiaryGeoSelectorComponent,
  arePropsEqual,
);
