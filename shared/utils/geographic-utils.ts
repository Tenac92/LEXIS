/**
 * Geographic Code Utilities
 * 
 * Updated to work with normalized geographic structure:
 * - regions table: 2-digit codes
 * - regional_units table: 3-digit codes with region_code FK
 * - municipalities table: 4-digit codes with unit_code FK
 */

export type GeographicLevel = 'municipality' | 'regional_unit' | 'region';

export interface GeographicInfo {
  level: GeographicLevel;
  code: string | number;
  lookupField: string;
  displayFields: string[];
}

// New interfaces for normalized geographic data
export interface NormalizedGeographicData {
  region?: {
    code: string;
    name: string;
  };
  regionalUnit?: {
    code: string;
    name: string;
    region_code: string;
  };
  municipality?: {
    code: string;
    name: string;
    unit_code: string;
  };
}

/**
 * Determine the geographic level based on the code's digit count
 * Updated for normalized table structure
 */
export function getGeographicInfo(code: string | number | null | undefined): GeographicInfo | null {
  if (!code) return null;
  
  const codeStr = code.toString();
  const digitCount = codeStr.length;
  
  if (digitCount >= 4) {
    return {
      level: 'municipality',
      code: codeStr,
      lookupField: 'code',
      displayFields: ['region_name', 'regional_unit_name', 'municipality_name']
    };
  } else if (digitCount === 3) {
    return {
      level: 'regional_unit',
      code: codeStr,
      lookupField: 'code',
      displayFields: ['region_name', 'regional_unit_name']
    };
  } else if (digitCount <= 2) {
    return {
      level: 'region',
      code: codeStr,
      lookupField: 'code',
      displayFields: ['region_name']
    };
  }
  
  return null;
}

/**
 * New utility functions for normalized geographic data
 */

/**
 * Get geographic code for saving based on normalized data
 */
export function getGeographicCodeForSaveNormalized(location: {
  region?: string;
  regional_unit?: string;
  municipality?: string;
}, geographicData: NormalizedGeographicData, forceLevel?: GeographicLevel): string | null {
  // Clean up location data
  const hasRegion = location.region && location.region !== "__clear__" && location.region.trim() !== "";
  const hasRegionalUnit = location.regional_unit && location.regional_unit !== "__clear__" && location.regional_unit.trim() !== "";
  const hasMunicipality = location.municipality && location.municipality !== "__clear__" && location.municipality.trim() !== "";
  
  console.log("Normalized Geographic Code Selection:", {
    hasRegion,
    hasRegionalUnit, 
    hasMunicipality,
    region_value: location.region,
    regional_unit_value: location.regional_unit,
    municipality_value: location.municipality,
    forceLevel
  });
  
  // If forceLevel is specified, use that level
  if (forceLevel === 'regional_unit' && hasRegion && hasRegionalUnit && geographicData.regionalUnit) {
    return geographicData.regionalUnit.code;
  } else if (forceLevel === 'region' && hasRegion && geographicData.region) {
    return geographicData.region.code;
  } else if (forceLevel === 'municipality' && hasRegion && hasRegionalUnit && hasMunicipality && geographicData.municipality) {
    return geographicData.municipality.code;
  }
  
  // Default behavior - use the most specific level available
  if (hasRegion && hasRegionalUnit && hasMunicipality && geographicData.municipality) {
    return geographicData.municipality.code;
  } else if (hasRegion && hasRegionalUnit && geographicData.regionalUnit) {
    return geographicData.regionalUnit.code;
  } else if (hasRegion && geographicData.region) {
    return geographicData.region.code;
  }
  
  return null;
}

/**
 * Format geographic display based on level and kallikratis data (Legacy function for backward compatibility)
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
 * Format geographic display for normalized data structure
 */
export function formatGeographicDisplayNormalized(geographicData: NormalizedGeographicData, level: GeographicLevel): string {
  if (!geographicData) return '';
  
  switch (level) {
    case 'municipality':
      if (geographicData.municipality && geographicData.regionalUnit && geographicData.region) {
        return `${geographicData.region.name} > ${geographicData.regionalUnit.name} > ${geographicData.municipality.name}`;
      }
      break;
    case 'regional_unit':
      if (geographicData.regionalUnit && geographicData.region) {
        return `${geographicData.region.name} > ${geographicData.regionalUnit.name}`;
      }
      break;
    case 'region':
      if (geographicData.region) {
        return geographicData.region.name;
      }
      break;
  }
  
  return '';
}

/**
 * Helper functions for working with normalized geographic data
 */

/**
 * Find regional units for a given region code
 */
export function getRegionalUnitsForRegion(
  regionalUnits: Array<{code: string; name: string; region_code: string}>,
  regionCode: string
): Array<{code: string; name: string; region_code: string}> {
  return regionalUnits.filter(unit => unit.region_code === regionCode);
}

/**
 * Find municipalities for a given regional unit code
 */
export function getMunicipalitiesForRegionalUnit(
  municipalities: Array<{code: string; name: string; unit_code: string}>,
  regionalUnitCode: string
): Array<{code: string; name: string; unit_code: string}> {
  return municipalities.filter(municipality => municipality.unit_code === regionalUnitCode);
}

/**
 * Convert new geographic data structure to legacy kallikratis format for SmartGeographicMultiSelect
 */
export function convertGeographicDataToKallikratis(geographicData: {
  regions?: Array<{code: string; name: string}>;
  regionalUnits?: Array<{code: string; name: string; region_code: string}>;
  municipalities?: Array<{code: string; name: string; unit_code: string}>;
}): Array<{perifereia: string; perifereiaki_enotita: string; onoma_neou_ota: string}> {
  if (!geographicData?.regions || !geographicData?.regionalUnits || !geographicData?.municipalities) {
    return [];
  }

  const kallikratisEntries: Array<{perifereia: string; perifereiaki_enotita: string; onoma_neou_ota: string}> = [];

  // Create all possible combinations of region -> regional unit -> municipality
  geographicData.regions.forEach(region => {
    // Find all regional units for this region
    const regionalUnits = geographicData.regionalUnits!.filter(ru => ru.region_code === region.code);
    
    regionalUnits.forEach(regionalUnit => {
      // Find all municipalities for this regional unit
      const municipalities = geographicData.municipalities!.filter(m => m.unit_code === regionalUnit.code);
      
      municipalities.forEach(municipality => {
        kallikratisEntries.push({
          perifereia: region.name,
          perifereiaki_enotita: regionalUnit.name,
          onoma_neou_ota: municipality.name
        });
      });
    });
  });

  return kallikratisEntries;
}

/**
 * Build complete geographic data from separate tables based on location selection
 */
export function buildNormalizedGeographicData(
  location: {region?: string; regional_unit?: string; municipality?: string},
  regions: Array<{code: string; name: string}>,
  regionalUnits: Array<{code: string; name: string; region_code: string}>,
  municipalities: Array<{code: string; name: string; unit_code: string}>
): NormalizedGeographicData {
  const result: NormalizedGeographicData = {};
  
  // Find region by name
  if (location.region) {
    result.region = regions.find(r => r.name === location.region);
  }
  
  // Find regional unit by name and region
  if (location.regional_unit && result.region) {
    result.regionalUnit = regionalUnits.find(ru => 
      ru.name === location.regional_unit && ru.region_code === result.region?.code
    );
  }
  
  // Find municipality by name and regional unit
  if (location.municipality && result.regionalUnit) {
    result.municipality = municipalities.find(m => 
      m.name === location.municipality && m.unit_code === result.regionalUnit?.code
    );
  }
  
  return result;
}

/**
 * Get the appropriate geographic code for saving based on selected location data
 */
export function getGeographicCodeForSave(location: {
  region?: string;
  regional_unit?: string;
  municipality?: string;
  municipal_community?: string;
}, kallikratisEntry: any, forceLevel?: 'region' | 'regional_unit' | 'municipality'): string | null {
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
    municipality_value: location.municipality,
    forceLevel
  });
  
  // If forceLevel is specified, use that level based on available data
  if (forceLevel === 'regional_unit' && hasRegion && hasRegionalUnit) {
    console.log("FORCED regional unit code:", kallikratisEntry.kodikos_perifereiakis_enotitas);
    return kallikratisEntry.kodikos_perifereiakis_enotitas?.toString() || null;
  } else if (forceLevel === 'region' && hasRegion) {
    console.log("FORCED region code:", kallikratisEntry.kodikos_perifereias);
    return kallikratisEntry.kodikos_perifereias?.toString() || null;
  } else if (forceLevel === 'municipality' && hasRegion && hasRegionalUnit && hasMunicipality) {
    console.log("FORCED municipality code:", kallikratisEntry.kodikos_neou_ota);
    return kallikratisEntry.kodikos_neou_ota?.toString() || null;
  }
  
  // Default behavior - use the most specific level available
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