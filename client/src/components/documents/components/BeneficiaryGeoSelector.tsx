import { memo, useEffect, useMemo, useState } from "react";
import { MapPin, AlertCircle, RefreshCcw, X } from "lucide-react";
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
  const [regionCode, setRegionCode] = useState<string>("");
  const [unitCode, setUnitCode] = useState<string>("");
  const [municipalityCode, setMunicipalityCode] = useState<string>("");

  // Hydrate local selectors from incoming value
  useEffect(() => {
    const { regionCode, unitCode, municipalityCode } =
      deriveGeoSelectionFromRegiondet(value);
    setRegionCode(regionCode);
    setUnitCode(unitCode);
    setMunicipalityCode(municipalityCode);
  }, [value]);

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
    return municipalities;
  }, [municipalities, unitCode, regionCode, filteredUnits]);

  const handleRegionChange = (code: string) => {
    const selectedRegion =
      regions.find((r) => String(r.code) === String(code)) || null;
    setRegionCode(code);
    setUnitCode("");
    setMunicipalityCode("");
    onChange(
      buildRegiondetSelection({
        region: selectedRegion,
        regionalUnit: null,
        municipality: null,
      }),
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
    setRegionCode(parentRegion?.code ? String(parentRegion.code) : "");
    setUnitCode(code);
    setMunicipalityCode("");
    onChange(
      buildRegiondetSelection({
        region: parentRegion || null,
        regionalUnit: selectedUnit,
        municipality: null,
      }),
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

    setRegionCode(parentRegion?.code ? String(parentRegion.code) : "");
    setUnitCode(parentUnit?.code ? String(parentUnit.code) : "");
    setMunicipalityCode(code);

    onChange(
      buildRegiondetSelection({
        region: parentRegion || null,
        regionalUnit: parentUnit || null,
        municipality: selectedMunicipality,
      }),
    );
  };

  const handleClear = () => {
    setRegionCode("");
    setUnitCode("");
    setMunicipalityCode("");
    onChange(null);
  };

  const isValid = isRegiondetComplete(value);

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          <span>
            Γεωγραφική επιλογή{" "}
            {required && <span className="text-destructive">*</span>}
          </span>
        </div>

        <div className="min-w-[180px] flex-1">
          <Select
            value={regionCode || ""}
            onValueChange={handleRegionChange}
            disabled={loading}
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder="Περιφέρεια" />
            </SelectTrigger>
            <SelectContent>
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

        <div className="min-w-[180px] flex-1">
          <Select
            value={unitCode || ""}
            onValueChange={handleUnitChange}
            disabled={loading || filteredUnits.length === 0}
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder="Περιφερειακή ενότητα" />
            </SelectTrigger>
            <SelectContent>
              {filteredUnits.map((unit) => (
                <SelectItem
                  key={`unit-${unit.code || unit.name}`}
                  value={String(unit.code || unit.name)}
                >
                  {unit.name}
                </SelectItem>
              ))}
              {filteredUnits.length === 0 && (
                <SelectItem value="no-units" disabled>
                  Δεν υπάρχουν διαθέσιμες ενότητες
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[200px] flex-1">
          <Select
            value={municipalityCode || ""}
            onValueChange={handleMunicipalityChange}
            disabled={loading || filteredMunicipalities.length === 0}
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder="Δήμος" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {filteredMunicipalities.map((municipality) => (
                <SelectItem
                  key={`municipality-${municipality.code || municipality.id || municipality.name}`}
                  value={String(municipality.code || municipality.name)}
                >
                  {municipality.name}
                </SelectItem>
              ))}
              {filteredMunicipalities.length === 0 && (
                <SelectItem value="no-municipalities" disabled>
                  Δεν υπάρχουν διαθέσιμοι δήμοι
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleClear}
          disabled={loading || (!regionCode && !unitCode && !municipalityCode)}
          className="h-9"
        >
          <X className="h-4 w-4 mr-1" />
          Καθαρισμός
        </Button>
      </div>

      {!isValid && required && (
        <div className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>Επιλέξτε περιφέρεια, ενότητα ή δήμο</span>
        </div>
      )}

      {error && (
        <div className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>{error}</span>
          {onRetry && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onRetry}
              className="h-7 px-2"
            >
              <RefreshCcw className="h-3 w-3 mr-1" />
              Προσπάθεια ξανά
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
