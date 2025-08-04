/**
 * Geographic Code Utilities
 * 
 * Handles the logic for interpreting geographic codes based on digit count:
 * - 4 digits: Municipality level (kodikos_neou_ota)
 * - 3 digits: Regional Unit level (kodikos_perifereiakis_enotitas)
 * - 2 digits: Region level (kodikos_perifereias)
 */

export type GeographicLevel = 'municipality' | 'regional_unit' | 'region';

export interface GeographicInfo {
  level: GeographicLevel;
  code: string | number;
  lookupField: string;
  displayFields: string[];
}

/**
 * Determine the geographic level based on the code's digit count
 */
export function getGeographicInfo(code: string | number | null | undefined): GeographicInfo | null {
  if (!code) return null;
  
  const codeStr = code.toString();
  const digitCount = codeStr.length;
  
  if (digitCount === 4) {
    return {
      level: 'municipality',
      code: parseInt(codeStr),
      lookupField: 'kodikos_neou_ota',
      displayFields: ['perifereia', 'perifereiaki_enotita', 'onoma_neou_ota']
    };
  } else if (digitCount === 3) {
    return {
      level: 'regional_unit',
      code: parseInt(codeStr),
      lookupField: 'kodikos_perifereiakis_enotitas',
      displayFields: ['perifereia', 'perifereiaki_enotita']
    };
  } else if (digitCount === 2) {
    return {
      level: 'region',
      code: parseInt(codeStr),
      lookupField: 'kodikos_perifereias',
      displayFields: ['perifereia']
    };
  }
  
  return null;
}

/**
 * Format geographic display based on level and kallikratis data
 */
export function formatGeographicDisplay(kallikratisEntry: any, level: GeographicLevel): string {
  if (!kallikratisEntry) return '';
  
  switch (level) {
    case 'municipality':
      return `${kallikratisEntry.perifereia} > ${kallikratisEntry.perifereiaki_enotita} > ${kallikratisEntry.onoma_neou_ota}`;
    case 'regional_unit':
      return `${kallikratisEntry.perifereia} > ${kallikratisEntry.perifereiaki_enotita}`;
    case 'region':
      return kallikratisEntry.perifereia;
    default:
      return '';
  }
}

/**
 * Get the appropriate geographic code for saving based on selected location data
 */
export function getGeographicCodeForSave(location: {
  region?: string;
  regional_unit?: string;
  municipality?: string;
  municipal_community?: string;
}, kallikratisEntry: any): string | null {
  if (!kallikratisEntry) return null;
  
  // Clean up location data - also check for empty strings
  const hasRegion = location.region && location.region !== "__clear__" && location.region.trim() !== "";
  const hasRegionalUnit = location.regional_unit && location.regional_unit !== "__clear__" && location.regional_unit.trim() !== "";
  const hasMunicipality = location.municipality && location.municipality !== "__clear__" && location.municipality.trim() !== "";
  
  console.log("Geographic Code Selection Debug:", {
    hasRegion,
    hasRegionalUnit, 
    hasMunicipality,
    region_value: location.region,
    regional_unit_value: location.regional_unit,
    municipality_value: location.municipality
  });
  
  // Determine which code to use based on available data
  if (hasRegion && hasRegionalUnit && hasMunicipality) {
    // Municipality level - use 4-digit code
    console.log("Using municipality code:", kallikratisEntry.kodikos_neou_ota);
    return kallikratisEntry.kodikos_neou_ota?.toString() || null;
  } else if (hasRegion && hasRegionalUnit) {
    // Regional unit level - use 3-digit code
    console.log("Using regional unit code:", kallikratisEntry.kodikos_perifereiakis_enotitas);
    return kallikratisEntry.kodikos_perifereiakis_enotitas?.toString() || null;
  } else if (hasRegion) {
    // Region level - use 2-digit code
    console.log("Using region code:", kallikratisEntry.kodikos_perifereias);
    return kallikratisEntry.kodikos_perifereias?.toString() || null;
  }
  
  return null;
}