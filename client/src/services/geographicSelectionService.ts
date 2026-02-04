/**
 * Centralized Geographical Selection Service
 * 
 * Purpose: Manage all geographic data loading rules with explicit, deterministic behavior.
 * Eliminates scattered geo-loading logic and implicit fallbacks across components.
 * 
 * Core Rules:
 * 1. FALLBACK RULE: If a Project has no geographic constraints assigned → load ALL available regions
 * 2. AUTO-LOAD RULE: If Regional Unit is selected → automatically load municipalities for that unit
 * 3. HIERARCHY RULE: Lower-level selections depend on higher-level ones (Region → Unit → Municipality)
 * 4. CLEARING RULE: Clearing a higher level automatically clears all lower levels
 */

import type {
  RegionOption,
  RegionalUnitOption,
  MunicipalityOption,
  RegiondetSelection,
} from "@/components/documents/utils/beneficiary-geo";

export interface ProjectGeographicConstraints {
  availableRegions: RegionOption[];
  availableUnits: RegionalUnitOption[];
  availableMunicipalities: MunicipalityOption[];
}

export interface GeographicSelectionState {
  selectedRegionCode: string | null;
  selectedUnitCode: string | null;
  selectedMunicipalityCode: string | null;
}

export interface FilteredGeographicOptions {
  regions: RegionOption[];
  regionalUnits: RegionalUnitOption[];
  municipalities: MunicipalityOption[];
  loadedMunicipalitiesFor?: string | null; // Track which unit had municipalities loaded
}

/**
 * Rule 1: FALLBACK RULE
 * 
 * If a Project has NO geographic constraints assigned → load ALL available regions
 * This is explicit and documented, not a silent fallback
 * 
 * @param projectConstraints The geographic constraints assigned to the project
 * @param allAvailableRegions All possible regions in the system
 * @returns true if we should use the fallback (load all regions)
 */
export function shouldUseFallbackRegions(
  projectConstraints: ProjectGeographicConstraints | null | undefined,
  allAvailableRegions: RegionOption[]
): boolean {
  // Fallback Rule: No constraints assigned = load all regions
  if (
    !projectConstraints ||
    !projectConstraints.availableRegions ||
    projectConstraints.availableRegions.length === 0
  ) {
    return allAvailableRegions && allAvailableRegions.length > 0;
  }
  return false;
}

/**
 * Get the complete set of regions to display
 * Applies FALLBACK RULE if necessary
 * 
 * @param projectConstraints Geographic constraints from the project
 * @param allAvailableRegions All possible regions in the system
 * @returns Regions to display (either project-constrained or all available)
 */
export function getAvailableRegions(
  projectConstraints: ProjectGeographicConstraints | null | undefined,
  allAvailableRegions: RegionOption[]
): RegionOption[] {
  // EXPLICIT: Check if using fallback
  const useFallback = shouldUseFallbackRegions(projectConstraints, allAvailableRegions);

  if (useFallback) {
    // RULE: No geographic constraints assigned → load ALL available regions
    console.log(
      "[GeoSelection] Using FALLBACK RULE: Project has no geographic constraints, loading all regions"
    );
    return allAvailableRegions;
  }

  // Project has specific constraints - use only those
  return projectConstraints?.availableRegions || [];
}

/**
 * Rule 2: AUTO-LOAD RULE
 * 
 * If a Regional Unit is selected → automatically load municipalities for that unit
 * This eliminates the need for manual municipality dropdown interaction
 * 
 * @param selectedUnitCode The code of the selected regional unit
 * @param availableMunicipalities All municipalities available for this project
 * @returns Municipalities filtered to only those under the selected unit
 */
export function getAutoLoadedMunicipalities(
  selectedUnitCode: string | null | undefined,
  availableMunicipalities: MunicipalityOption[]
): MunicipalityOption[] {
  if (!selectedUnitCode) {
    return [];
  }

  // AUTO-LOAD RULE: Filter municipalities to only those under the selected unit
  const filtered = availableMunicipalities.filter(
    (muni) => String(muni.unit_code) === String(selectedUnitCode)
  );

  if (filtered.length > 0) {
    console.log(
      `[GeoSelection] AUTO-LOAD RULE: Loaded ${filtered.length} municipalities for unit ${selectedUnitCode}`
    );
  }

  return filtered;
}

/**
 * Rule 3 & 4: HIERARCHY AND CLEARING RULES
 * 
 * Filter options based on current selection
 * Respects the hierarchy: Region → Regional Unit → Municipality
 * Clearing a higher level automatically clears lower levels
 * 
 * @param selection Current geographic selection
 * @param projectConstraints Geographic constraints from the project
 * @param allAvailableRegions All possible regions for fallback
 * @param allAvailableUnits All possible regional units
 * @param allAvailableMunicipalities All possible municipalities
 * @returns Filtered geographic options based on selection
 */
export function getFilteredGeographicOptions(
  selection: Partial<GeographicSelectionState>,
  projectConstraints: ProjectGeographicConstraints | null | undefined,
  allAvailableRegions: RegionOption[],
  allAvailableUnits: RegionalUnitOption[],
  allAvailableMunicipalities: MunicipalityOption[]
): FilteredGeographicOptions {
  // Apply FALLBACK RULE to get base regions
  const availableRegions = getAvailableRegions(projectConstraints, allAvailableRegions);

  // Filter regional units based on selected region (HIERARCHY RULE)
  let availableUnits = allAvailableUnits;
  if (selection.selectedRegionCode) {
    availableUnits = allAvailableUnits.filter(
      (unit) => String(unit.region_code) === String(selection.selectedRegionCode)
    );
  }

  // Get municipalities: either auto-loaded or empty (HIERARCHY & AUTO-LOAD RULES)
  let availableMunicipalities: MunicipalityOption[] = [];
  let loadedMunicipalitiesFor: string | null = null;

  if (selection.selectedUnitCode) {
    // AUTO-LOAD RULE: Automatically load municipalities for selected unit
    availableMunicipalities = getAutoLoadedMunicipalities(
      selection.selectedUnitCode,
      allAvailableMunicipalities
    );
    loadedMunicipalitiesFor = selection.selectedUnitCode;
  }

  return {
    regions: availableRegions,
    regionalUnits: availableUnits,
    municipalities: availableMunicipalities,
    loadedMunicipalitiesFor,
  };
}

/**
 * Rule 4: CLEARING RULE
 * 
 * When a higher-level selection is cleared, all lower levels must be cleared too
 * This maintains hierarchy integrity
 * 
 * @param clearedLevel Which level was cleared (region, unit, or municipality)
 * @param currentSelection Current selection state
 * @returns Updated selection with lower levels cleared if necessary
 */
export function applyClearingRules(
  clearedLevel: "region" | "unit" | "municipality",
  currentSelection: GeographicSelectionState
): GeographicSelectionState {
  const updated = { ...currentSelection };

  // CLEARING RULE: If higher level cleared, all lower levels must be cleared
  if (clearedLevel === "region") {
    // Clearing region: clear unit and municipality
    updated.selectedRegionCode = null;
    updated.selectedUnitCode = null;
    updated.selectedMunicipalityCode = null;
    console.log(
      "[GeoSelection] CLEARING RULE: Region cleared → also cleared unit and municipality"
    );
  } else if (clearedLevel === "unit") {
    // Clearing unit: clear municipality
    updated.selectedUnitCode = null;
    updated.selectedMunicipalityCode = null;
    console.log(
      "[GeoSelection] CLEARING RULE: Unit cleared → also cleared municipality"
    );
  } else if (clearedLevel === "municipality") {
    // Clearing municipality: only clear municipality
    updated.selectedMunicipalityCode = null;
    console.log("[GeoSelection] CLEARING RULE: Municipality cleared");
  }

  return updated;
}

/**
 * Build a RegiondetSelection from current geographic state
 * Used to create the final value for form submission
 * 
 * @param selection Current geographic selection state
 * @param regionOptions Available region options
 * @param unitOptions Available unit options
 * @param municipalityOptions Available municipality options
 * @returns RegiondetSelection object for form/API
 */
export function buildRegiondetFromSelection(
  selection: GeographicSelectionState,
  regionOptions: RegionOption[],
  unitOptions: RegionalUnitOption[],
  municipalityOptions: MunicipalityOption[]
): RegiondetSelection | null {
  // Build selection from current state
  const region =
    regionOptions.find((r) => String(r.code) === String(selection.selectedRegionCode)) ||
    null;

  const unit =
    selection.selectedUnitCode && unitOptions.length > 0
      ? unitOptions.find((u) => String(u.code) === String(selection.selectedUnitCode)) ||
        null
      : null;

  const municipality =
    selection.selectedMunicipalityCode && municipalityOptions.length > 0
      ? municipalityOptions.find(
          (m) => String(m.code) === String(selection.selectedMunicipalityCode)
        ) || null
      : null;

  // At least one selection required
  if (!region && !unit && !municipality) {
    return null;
  }

  const result: RegiondetSelection = {};

  if (region) {
    result.regions = [
      {
        code: region.code,
        name: region.name,
        region_code: region.region_code,
      },
    ];
  }

  if (unit) {
    result.regional_units = [
      {
        code: unit.code,
        name: unit.name,
        region_code: unit.region_code,
      },
    ];
  }

  if (municipality) {
    result.municipalities = [
      {
        code: municipality.code,
        name: municipality.name,
        unit_code: municipality.unit_code,
        id: municipality.id,
      },
    ];
  }

  return result;
}

/**
 * Derive the current geographic selection state from a RegiondetSelection object
 * Inverse of buildRegiondetFromSelection
 * 
 * @param regiondet The RegiondetSelection to extract from
 * @returns GeographicSelectionState with extracted codes
 */
export function deriveSelectionFromRegiondet(
  regiondet: RegiondetSelection | null | undefined
): GeographicSelectionState {
  if (!regiondet) {
    return {
      selectedRegionCode: null,
      selectedUnitCode: null,
      selectedMunicipalityCode: null,
    };
  }

  const selectedRegionCode =
    regiondet.regions?.[0]?.code ||
    regiondet.regions?.[0]?.region_code ||
    null;

  const selectedUnitCode =
    regiondet.regional_units?.[0]?.code ||
    regiondet.regional_units?.[0]?.region_code ||
    null;

  const selectedMunicipalityCode =
    regiondet.municipalities?.[0]?.code ||
    regiondet.municipalities?.[0]?.id ||
    null;

  return {
    selectedRegionCode,
    selectedUnitCode,
    selectedMunicipalityCode,
  };
}

/**
 * Check if a geographic selection is complete (required fields set)
 * 
 * @param selection Current selection state
 * @returns true if at least one level is selected
 */
export function isSelectionComplete(
  selection: Partial<GeographicSelectionState>
): boolean {
  return Boolean(
    selection.selectedRegionCode ||
      selection.selectedUnitCode ||
      selection.selectedMunicipalityCode
  );
}

/**
 * Get a human-readable label for the current selection
 * 
 * @param selection Current selection state
 * @param regionOptions Available regions
 * @param unitOptions Available units
 * @param municipalityOptions Available municipalities
 * @returns Human-readable label (e.g., "Ελλάδα › Αττική › Αθήνα")
 */
export function getSelectionLabel(
  selection: GeographicSelectionState,
  regionOptions: RegionOption[],
  unitOptions: RegionalUnitOption[],
  municipalityOptions: MunicipalityOption[]
): string {
  const parts: string[] = [];

  if (selection.selectedRegionCode) {
    const region = regionOptions.find(
      (r) => String(r.code) === String(selection.selectedRegionCode)
    );
    if (region) parts.push(region.name);
  }

  if (selection.selectedUnitCode) {
    const unit = unitOptions.find(
      (u) => String(u.code) === String(selection.selectedUnitCode)
    );
    if (unit) parts.push(unit.name);
  }

  if (selection.selectedMunicipalityCode) {
    const municipality = municipalityOptions.find(
      (m) => String(m.code) === String(selection.selectedMunicipalityCode)
    );
    if (municipality) parts.push(municipality.name);
  }

  return parts.length > 0 ? parts.join(" › ") : "Επιλέξτε περιοχή";
}
