/**
 * Region Validation Utility
 * 
 * Provides helpers for validating and normalizing region codes
 * to ensure data integrity when working with geographic data.
 */

import { supabase } from '../config/db';

/**
 * Validation result for region codes
 */
export interface RegionValidationResult {
  valid: number[];
  invalid: number[];
  details: Array<{
    code: number;
    isValid: boolean;
    name?: string;
  }>;
}

/**
 * Validate an array of region codes against the regions table
 * 
 * @param regionCodes - Array of region codes to validate
 * @returns Object containing valid and invalid codes with details
 * 
 * @example
 * const result = await validateRegionCodes([1, 2, 999]);
 * console.log(result.valid); // [1, 2]
 * console.log(result.invalid); // [999]
 */
export async function validateRegionCodes(
  regionCodes: number[]
): Promise<RegionValidationResult> {
  if (regionCodes.length === 0) {
    return { valid: [], invalid: [], details: [] };
  }

  try {
    const { data: regions, error } = await supabase
      .from('regions')
      .select('code, name')
      .in('code', regionCodes);

    if (error) {
      console.error('[RegionValidation] Error fetching regions:', error);
      throw error;
    }

    const validCodes = new Set(regions?.map((r) => r.code) || []);
    const regionMap = new Map(regions?.map((r) => [r.code, r.name]) || []);

    const valid: number[] = [];
    const invalid: number[] = [];
    const details: Array<{ code: number; isValid: boolean; name?: string }> = [];

    for (const code of regionCodes) {
      const isValid = validCodes.has(code);
      if (isValid) {
        valid.push(code);
        details.push({ code, isValid: true, name: regionMap.get(code) });
      } else {
        invalid.push(code);
        details.push({ code, isValid: false });
      }
    }

    return { valid, invalid, details };
  } catch (error) {
    console.error('[RegionValidation] Unexpected error:', error);
    throw error;
  }
}

/**
 * Validate regional unit codes
 */
export async function validateRegionalUnitCodes(
  unitCodes: number[]
): Promise<RegionValidationResult> {
  if (unitCodes.length === 0) {
    return { valid: [], invalid: [], details: [] };
  }

  try {
    const { data: units, error } = await supabase
      .from('regional_units')
      .select('code, name')
      .in('code', unitCodes);

    if (error) {
      console.error('[RegionValidation] Error fetching regional units:', error);
      throw error;
    }

    const validCodes = new Set(units?.map((u) => u.code) || []);
    const unitMap = new Map(units?.map((u) => [u.code, u.name]) || []);

    const valid: number[] = [];
    const invalid: number[] = [];
    const details: Array<{ code: number; isValid: boolean; name?: string }> = [];

    for (const code of unitCodes) {
      const isValid = validCodes.has(code);
      if (isValid) {
        valid.push(code);
        details.push({ code, isValid: true, name: unitMap.get(code) });
      } else {
        invalid.push(code);
        details.push({ code, isValid: false });
      }
    }

    return { valid, invalid, details };
  } catch (error) {
    console.error('[RegionValidation] Unexpected error:', error);
    throw error;
  }
}

/**
 * Validate municipality codes
 */
export async function validateMunicipalityCodes(
  muniCodes: number[]
): Promise<RegionValidationResult> {
  if (muniCodes.length === 0) {
    return { valid: [], invalid: [], details: [] };
  }

  try {
    const { data: munis, error } = await supabase
      .from('municipalities')
      .select('code, name')
      .in('code', muniCodes);

    if (error) {
      console.error('[RegionValidation] Error fetching municipalities:', error);
      throw error;
    }

    const validCodes = new Set(munis?.map((m) => m.code) || []);
    const muniMap = new Map(munis?.map((m) => [m.code, m.name]) || []);

    const valid: number[] = [];
    const invalid: number[] = [];
    const details: Array<{ code: number; isValid: boolean; name?: string }> = [];

    for (const code of muniCodes) {
      const isValid = validCodes.has(code);
      if (isValid) {
        valid.push(code);
        details.push({ code, isValid: true, name: muniMap.get(code) });
      } else {
        invalid.push(code);
        details.push({ code, isValid: false });
      }
    }

    return { valid, invalid, details };
  } catch (error) {
    console.error('[RegionValidation] Unexpected error:', error);
    throw error;
  }
}

/**
 * Check if a region code is valid
 * 
 * @param regionCode - Region code to check
 * @returns true if valid, false otherwise
 */
export async function isValidRegionCode(regionCode: number): Promise<boolean> {
  const result = await validateRegionCodes([regionCode]);
  return result.valid.length > 0;
}

/**
 * Get region name from code
 * 
 * @param regionCode - Region code
 * @returns Region name or null if not found
 */
export async function getRegionName(regionCode: number): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('regions')
      .select('name')
      .eq('code', regionCode)
      .single();

    if (error || !data) {
      return null;
    }

    return data.name;
  } catch (error) {
    console.error('[RegionValidation] Error fetching region name:', error);
    return null;
  }
}

/**
 * Find region code by name (case-insensitive)
 * 
 * @param regionName - Region name to search for
 * @returns Region code or null if not found
 */
export async function findRegionCodeByName(regionName: string): Promise<number | null> {
  try {
    const { data, error } = await supabase
      .from('regions')
      .select('code, name')
      .ilike('name', regionName);

    if (error || !data || data.length === 0) {
      return null;
    }

    // Return exact match if found, otherwise first result
    const exactMatch = data.find((r) => r.name.toLowerCase() === regionName.toLowerCase());
    return exactMatch?.code || data[0].code;
  } catch (error) {
    console.error('[RegionValidation] Error finding region code:', error);
    return null;
  }
}

/**
 * Validate Kallikratis hierarchy consistency
 * Ensures that regional units belong to their parent region
 * and municipalities belong to their parent unit
 * 
 * @param regionCode - Region code
 * @param unitCode - Regional unit code (optional)
 * @param muniCode - Municipality code (optional)
 * @returns true if hierarchy is valid, false otherwise
 */
export async function validateGeographicHierarchy(
  regionCode: number,
  unitCode?: number,
  muniCode?: number
): Promise<{ valid: boolean; error?: string }> {
  try {
    // If unit code provided, verify it belongs to the region
    if (unitCode) {
      const { data: unit, error } = await supabase
        .from('regional_units')
        .select('code, name, region_code')
        .eq('code', unitCode)
        .single();

      if (error || !unit) {
        return { valid: false, error: `Regional unit ${unitCode} not found` };
      }

      if (unit.region_code !== regionCode) {
        return {
          valid: false,
          error: `Regional unit ${unit.name} (${unitCode}) does not belong to region ${regionCode}`,
        };
      }
    }

    // If municipality code provided, verify it belongs to the unit
    if (muniCode) {
      if (!unitCode) {
        return {
          valid: false,
          error: 'Cannot validate municipality without regional unit code',
        };
      }

      const { data: muni, error } = await supabase
        .from('municipalities')
        .select('code, name, unit_code')
        .eq('code', muniCode)
        .single();

      if (error || !muni) {
        return { valid: false, error: `Municipality ${muniCode} not found` };
      }

      if (muni.unit_code !== unitCode) {
        return {
          valid: false,
          error: `Municipality ${muni.name} (${muniCode}) does not belong to unit ${unitCode}`,
        };
      }
    }

    return { valid: true };
  } catch (error) {
    console.error('[RegionValidation] Error validating hierarchy:', error);
    return { valid: false, error: 'Database error during validation' };
  }
}
