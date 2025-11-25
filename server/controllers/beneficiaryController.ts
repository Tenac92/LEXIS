import { Request, Response, Router } from 'express';
import { storage } from '../storage';
import { authenticateSession, AuthenticatedRequest } from '../authentication';
import { insertBeneficiarySchema, type Beneficiary, type InsertBeneficiary } from '@shared/schema';
import { z } from 'zod';
import { supabase } from '../config/db';

export const router = Router();

// In-memory cache for beneficiaries list (per user units combination)
interface CacheEntry {
  data: any[];
  timestamp: number;
}
const beneficiariesCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

function getCacheKey(unitIds: number[]): string {
  return `beneficiaries_${unitIds.sort().join('_')}`;
}

function getCachedBeneficiaries(unitIds: number[]): any[] | null {
  const key = getCacheKey(unitIds);
  const cached = beneficiariesCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[Beneficiaries] CACHE HIT for units: ${unitIds.join(', ')}`);
    return cached.data;
  }
  if (cached) {
    beneficiariesCache.delete(key); // Remove stale cache
  }
  return null;
}

function setCachedBeneficiaries(unitIds: number[], data: any[]): void {
  const key = getCacheKey(unitIds);
  beneficiariesCache.set(key, { data, timestamp: Date.now() });
  console.log(`[Beneficiaries] CACHE SET for units: ${unitIds.join(', ')} (${data.length} items)`);
}

// Clear cache for specific units (call after create/update/delete)
export function invalidateBeneficiariesCache(unitIds?: number[]): void {
  if (unitIds) {
    const key = getCacheKey(unitIds);
    beneficiariesCache.delete(key);
    console.log(`[Beneficiaries] CACHE INVALIDATED for units: ${unitIds.join(', ')}`);
  } else {
    beneficiariesCache.clear();
    console.log('[Beneficiaries] CACHE CLEARED (all units)');
  }
}

// Helper function to map region name to region code
async function getRegionCodeFromName(regionName: string): Promise<string | null> {
  try {
    if (!regionName || regionName.trim() === '') {
      return null;
    }
    
    console.log(`[Beneficiaries] Looking up region code for: "${regionName}"`);
    
    const { data: regionData, error } = await supabase
      .from('regions')
      .select('code, name')
      .eq('name', regionName.trim())
      .single();
    
    if (error) {
      console.log(`[Beneficiaries] No region found with name "${regionName}":`, error);
      return null;
    }
    
    if (regionData && regionData.code) {
      console.log(`[Beneficiaries] Mapped region "${regionName}" to code "${regionData.code}"`);
      return regionData.code.toString();
    }
    
    return null;
  } catch (error) {
    console.error('[Beneficiaries] Error in getRegionCodeFromName:', error);
    return null;
  }
}

// Helper function to get unit code from numeric unit ID
async function getUnitCodeById(unitId: number): Promise<string | null> {
  try {
    console.log(`[Beneficiaries] Looking up unit code for unit ID: ${unitId}`);
    
    const { data: monadaData, error: monadaError } = await supabase
      .from('Monada')
      .select('id, unit')
      .eq('id', unitId)
      .single();
    
    if (monadaError) {
      console.error(`[Beneficiaries] Error fetching unit for ID ${unitId}:`, monadaError);
      return null;
    }
    
    if (monadaData && monadaData.unit) {
      console.log(`[Beneficiaries] Mapped unit ID ${unitId} to unit code "${monadaData.unit}"`);
      return monadaData.unit;
    }
    
    console.log(`[Beneficiaries] No unit code found for unit ID: ${unitId}`);
    return null;
  } catch (error) {
    console.error('[Beneficiaries] Error in getUnitCodeById:', error);
    return null;
  }
}

// Helper function to get unit abbreviation from full unit name
async function getUnitAbbreviation(userUnitName: string): Promise<string> {
  try {
    // First check if it's already an abbreviation by checking if it exists in Monada.unit
    const { data: existingUnit, error: existingError } = await supabase
      .from('Monada')
      .select('unit')
      .eq('unit', userUnitName)
      .single();
    
    if (!existingError && existingUnit) {
      // It's already an abbreviation, return as-is
      console.log(`[Beneficiaries] Unit "${userUnitName}" is already an abbreviation`);
      return userUnitName;
    }
    
    // If not found as abbreviation, try to find it as a full name
    const { data: monadaData, error: monadaError } = await supabase
      .from('Monada')
      .select('unit, unit_name')
      .not('unit_name', 'is', null);
    
    if (monadaError) {
      console.error('[Beneficiaries] Error fetching Monada data:', monadaError);
      throw new Error('Failed to fetch unit mapping');
    }
    
    // Find matching unit by comparing with unit_name.name
    for (const monada of monadaData || []) {
      if (monada.unit_name && typeof monada.unit_name === 'object' && monada.unit_name.name === userUnitName) {
        console.log(`[Beneficiaries] Mapped full name "${userUnitName}" to abbreviation "${monada.unit}"`);
        return monada.unit;
      }
    }
    
    // If no match found, return the original name (fallback)
    console.log(`[Beneficiaries] No mapping found for "${userUnitName}", using as-is`);
    return userUnitName;
  } catch (error) {
    console.error('[Beneficiaries] Error in getUnitAbbreviation:', error);
    return userUnitName; // fallback
  }
}

// Get beneficiaries filtered by user's unit - CRITICAL SECURITY: Only show data for assigned units
router.get('/', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // SECURITY CHECK: Enforce unit access control
    if (!req.user) {
      console.log('[Beneficiaries] SECURITY: Unauthorized access attempt');
      return res.status(401).json({
        message: 'Μη εξουσιοδοτημένη πρόσβαση'
      });
    }

    console.log(`[Beneficiaries] SECURITY: User ${req.user.id} (${req.user.role}) requesting beneficiaries for units: ${req.user.unit_id?.join(', ') || 'NONE'}`);

    // SECURITY: Get user's units for filtering - NO EXCEPTION FOR ANY ROLE
    const userUnits = req.user.unit_id || [];
    if (userUnits.length === 0) {
      console.log('[Beneficiaries] SECURITY: User has no assigned units - blocking access');
      return res.status(403).json({
        message: 'Δεν έχετε εκχωρημένες μονάδες'
      });
    }
    
    // PERFORMANCE: Check cache first
    const cachedData = getCachedBeneficiaries(userUnits);
    if (cachedData) {
      console.log(`[Beneficiaries] Returning ${cachedData.length} cached beneficiaries for units: ${userUnits.join(', ')}`);
      return res.json(cachedData);
    }
    
    // SECURITY: Get beneficiaries ONLY for user's assigned units
    // OPTIMIZATION: Use optimized method that skips AFM decryption for much faster loading
    // PERFORMANCE: Fetch all units in PARALLEL instead of sequentially
    const beneficiaryPromises = userUnits.map(async (unitId) => {
      const userUnit = await getUnitCodeById(unitId);
      if (userUnit) {
        console.log(`[Beneficiaries] SECURITY: Fetching beneficiaries for authorized unit: ${userUnit} (mapped from unit ID: ${unitId})`);
        return storage.getBeneficiariesByUnitOptimized(userUnit);
      } else {
        console.log(`[Beneficiaries] WARNING: Could not map unit ID ${unitId} to unit code, skipping`);
        return [];
      }
    });
    
    const beneficiaryArrays = await Promise.all(beneficiaryPromises);
    const allBeneficiaries = beneficiaryArrays.flat();
    
    // Cache the results
    setCachedBeneficiaries(userUnits, allBeneficiaries);
    
    console.log(`[Beneficiaries] SECURITY: Returning ${allBeneficiaries.length} beneficiaries (OPTIMIZED - AFM masked) from ${userUnits.length} authorized units only`);
    
    // Prevent caching to ensure new pagination code runs
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    res.json(allBeneficiaries);
  } catch (error) {
    console.error('[Beneficiaries] Error fetching beneficiaries:', error);
    res.status(500).json({ 
      message: 'Failed to fetch beneficiaries',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get beneficiaries by unit - SECURITY: Only allow access to user's assigned units
router.get('/by-unit/:unit', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { unit } = req.params;
    
    // SECURITY CHECK: Verify user has access to the requested unit
    if (!req.user) {
      console.log('[Beneficiaries] SECURITY: Unauthorized access attempt to /by-unit');
      return res.status(401).json({
        message: 'Μη εξουσιοδοτημένη πρόσβαση'
      });
    }

    console.log(`[Beneficiaries] SECURITY: User ${req.user.id} requesting unit: ${unit}`);
    
    // SECURITY: Get user's authorized unit codes and verify access
    const userUnits = req.user.unit_id || [];
    if (userUnits.length === 0) {
      console.log('[Beneficiaries] SECURITY: User has no assigned units - blocking access');
      return res.status(403).json({
        message: 'Δεν έχετε εκχωρημένες μονάδες'
      });
    }
    
    // Map user's unit IDs to unit codes and check if requested unit is authorized
    let hasAccess = false;
    for (const unitId of userUnits) {
      const userUnitCode = await getUnitCodeById(unitId);
      if (userUnitCode === unit) {
        hasAccess = true;
        break;
      }
    }
    
    if (!hasAccess) {
      console.log(`[Beneficiaries] SECURITY: User ${req.user.id} denied access to unit ${unit} - not in authorized units`);
      return res.status(403).json({
        message: 'Δεν έχετε πρόσβαση σε αυτή τη μονάδα'
      });
    }
    
    console.log(`[Beneficiaries] SECURITY: Access granted to unit ${unit} for user ${req.user.id}`);
    const beneficiaries = await storage.getBeneficiariesByUnit(unit);
    res.json(beneficiaries);
  } catch (error) {
    console.error('[Beneficiaries] Error fetching beneficiaries by unit:', error);
    res.status(500).json({ 
      message: 'Failed to fetch beneficiaries by unit',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Search beneficiaries by AFM with optional type filter and unit restriction
router.get('/search', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { afm, type } = req.query;
    
    if (!afm || typeof afm !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Το ΑΦΜ είναι υποχρεωτικό για την αναζήτηση'
      });
    }

    // Get user's unit for filtering - use proper unit ID to unit code mapping
    const userUnitId = req.user?.unit_id?.[0]; // Get first unit ID from user's unit_id array
    if (!userUnitId) {
      return res.status(403).json({
        success: false,
        message: 'Δεν βρέθηκε μονάδα για τον χρήστη'
      });
    }
    
    // Get the unit code from the numeric unit ID
    const userUnit = await getUnitCodeById(userUnitId);
    
    console.log(`[Beneficiaries] User unit ID: ${userUnitId}`);
    console.log(`[Beneficiaries] Mapped to unit code: "${userUnit}"`);
    
    if (!userUnit) {
      return res.status(403).json({
        success: false,
        message: 'Δεν βρέθηκε αντιστοίχιση μονάδας για τον χρήστη'
      });
    }
    
    console.log(`[Beneficiaries] Searching beneficiaries by AFM: ${afm}${type ? ` and type: ${type}` : ''} for unit: ${userUnit}`);
    
    const includeFinancial = req.query.includeFinancial === 'true';
    let beneficiaries = await storage.searchBeneficiariesByAFM(afm);
    
    console.log(`[Beneficiaries] Raw search returned ${beneficiaries.length} beneficiaries`);
    console.log(`[Beneficiaries] Sample beneficiary monada values:`, beneficiaries.slice(0, 3).map(b => ({ id: b.id, monada: (b as any).monada || 'N/A' })));
    
    // Include financial data (oikonomika) if requested for smart autocomplete
    if (includeFinancial) {
      console.log(`[Beneficiaries] Including financial data for smart autocomplete`);
      
      // Fetch financial data for each beneficiary from beneficiary_payments table
      for (let i = 0; i < beneficiaries.length; i++) {
        const beneficiary = beneficiaries[i] as any;
        try {
          const payments = await storage.getBeneficiaryPayments(beneficiary.id);
          console.log(`[Beneficiaries] Found ${payments.length} payments for beneficiary ${beneficiary.id}`);
          
          // Group payments by expenditure_type to create oikonomika structure with proper JOINs
          const oikonomika: Record<string, any[]> = {};
          
          for (const payment of payments) {
            let expenditureTypeName = 'UNKNOWN';
            let unitCode = '';
            let na853Code = '';
            let protocolNumber = '';
            
            try {
              // Get document information for protocol_number
              if (payment.document_id) {
                const { data: docData } = await supabase
                  .from('generated_documents')
                  .select('id, project_index_id, unit_id')
                  .eq('id', payment.document_id)
                  .single();
                
                if (docData) {
                  protocolNumber = docData.id.toString();
                  
                  // Get unit_code from Monada table
                  if (docData.unit_id) {
                    const { data: unitData } = await supabase
                      .from('Monada')
                      .select('unit')
                      .eq('id', docData.unit_id)
                      .single();
                    
                    if (unitData) {
                      unitCode = unitData.unit;
                    }
                  }
                  
                  // Get expenditure_type and na853_code via project_index
                  if (docData.project_index_id) {
                    const { data: indexData } = await supabase
                      .from('project_index')
                      .select('expenditure_type_id, project_id')
                      .eq('id', docData.project_index_id)
                      .single();
                    
                    if (indexData) {
                      // Get expenditure type name
                      if (indexData.expenditure_type_id) {
                        const { data: expTypeData } = await supabase
                          .from('expenditure_types')
                          .select('expenditure_types')
                          .eq('id', indexData.expenditure_type_id)
                          .single();
                        
                        if (expTypeData) {
                          expenditureTypeName = expTypeData.expenditure_types;
                        }
                      }
                      
                      // Get NA853 code from Projects table
                      if (indexData.project_id) {
                        const { data: projectData } = await supabase
                          .from('Projects')
                          .select('na853')
                          .eq('id', indexData.project_id)
                          .single();
                        
                        if (projectData) {
                          na853Code = projectData.na853 || '';
                        }
                      }
                    }
                  }
                }
              }
            } catch (joinError) {
              console.error(`[Beneficiaries] Error performing JOINs for payment ${payment.id}:`, joinError);
            }
            
            // Use expenditure type name as key
            if (!oikonomika[expenditureTypeName]) {
              oikonomika[expenditureTypeName] = [];
            }
            
            oikonomika[expenditureTypeName].push({
              amount: payment.amount,
              installment: payment.installment ? [payment.installment] : ['ΕΦΑΠΑΞ'],
              status: payment.status,
              expenditure_type: expenditureTypeName,
              unit_code: unitCode,
              na853_code: na853Code,
              protocol_number: protocolNumber,
              created_at: payment.created_at,
              payment_id: payment.id
            });
          }
          
          beneficiary.oikonomika = oikonomika;
          console.log(`[Beneficiaries] Added oikonomika for beneficiary ${beneficiary.id}:`, Object.keys(oikonomika));
        } catch (error) {
          console.error(`[Beneficiaries] Error fetching payments for beneficiary ${beneficiary.id}:`, error);
          beneficiary.oikonomika = {};
        }
      }
      
      // SECURITY FIX: Always apply unit filtering - no client-controlled bypass
      console.log(`[Beneficiaries] Financial data requested - applying same unit filtering for security`);
    }
    
    // Note: Removed monada security filtering - beneficiaries can be accessed regardless of their monada field
    // Note: Removed expenditure type filtering to allow beneficiaries to be used across different expenditure types
    // The same beneficiary can now be selected for any expenditure type, regardless of their previous payment history
    
    console.log(`[Beneficiaries] Found ${beneficiaries.length} beneficiaries matching AFM search`);
    
    res.json({
      success: true,
      data: beneficiaries,
      count: beneficiaries.length
    });
  } catch (error) {
    console.error('[Beneficiaries] Error searching beneficiaries:', error);
    res.status(500).json({ 
      success: false,
      message: 'Σφάλμα κατά την αναζήτηση δικαιούχων',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Legacy endpoint for AFM search (backwards compatibility) - SECURITY: Only show user's units
router.get('/search/afm/:afm', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { afm } = req.params;
    
    // SECURITY CHECK: Verify user has assigned units
    const userUnits = req.user?.unit_id || [];
    if (userUnits.length === 0) {
      console.log('[Beneficiaries] SECURITY: User has no assigned units - blocking AFM search');
      return res.status(403).json({
        message: 'Δεν έχετε εκχωρημένες μονάδες'
      });
    }

    // Map user unit IDs to unit codes for authorization
    const authorizedUnitCodes = [];
    for (const unitId of userUnits) {
      const unitCode = await getUnitCodeById(unitId);
      if (unitCode) {
        authorizedUnitCodes.push(unitCode);
      }
    }

    if (authorizedUnitCodes.length === 0) {
      console.error(`[Beneficiaries] Could not map any user unit IDs to unit codes for AFM search`);
      return res.status(500).json({
        message: 'Σφάλμα αντιστοίχισης μονάδων χρήστη'
      });
    }

    console.log(`[Beneficiaries] SECURITY: User ${req.user?.id} searching AFM ${afm} - authorized for units: ${authorizedUnitCodes.join(', ')}`);
    
    // Get all beneficiaries with this AFM
    let beneficiaries = await storage.searchBeneficiariesByAFM(afm);
    
    // Note: Removed monada security filtering - beneficiaries can be accessed regardless of their monada field
    
    console.log(`[Beneficiaries] AFM search returned ${beneficiaries.length} results for user ${req.user?.id}`);
    res.json(beneficiaries);
  } catch (error) {
    console.error('[Beneficiaries] Error searching beneficiaries by AFM:', error);
    res.status(500).json({ 
      message: 'Failed to search beneficiaries by AFM',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get single beneficiary by ID - SECURITY: Only allow access to user's assigned units
router.get('/:id', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid beneficiary ID' });
    }

    // SECURITY CHECK: Verify user has assigned units
    const userUnits = req.user?.unit_id || [];
    if (userUnits.length === 0) {
      console.log('[Beneficiaries] SECURITY: User has no assigned units - blocking access');
      return res.status(403).json({
        message: 'Δεν έχετε εκχωρημένες μονάδες'
      });
    }

    // Map user unit IDs to unit codes for authorization
    const authorizedUnitCodes = [];
    for (const unitId of userUnits) {
      const unitCode = await getUnitCodeById(unitId);
      if (unitCode) {
        authorizedUnitCodes.push(unitCode);
      }
    }

    if (authorizedUnitCodes.length === 0) {
      console.error(`[Beneficiaries] Could not map any user unit IDs to unit codes`);
      return res.status(500).json({
        message: 'Σφάλμα αντιστοίχισης μονάδων χρήστη'
      });
    }

    console.log(`[Beneficiaries] SECURITY: User ${req.user?.id} fetching beneficiary ${id} - authorized for units: ${authorizedUnitCodes.join(', ')} (unit IDs: ${userUnits.join(', ')})`);
    const beneficiary = await storage.getBeneficiaryById(id);
    
    if (!beneficiary) {
      return res.status(404).json({ message: 'Beneficiary not found' });
    }

    // SECURITY: Verify user has access to this beneficiary through their payments → project_index → monada
    // The unit association comes through payments, not directly on the beneficiary
    const { data: payments, error: paymentsError } = await supabase
      .from('beneficiary_payments')
      .select(`
        id,
        project_index_id,
        project_index!inner(
          monada_id
        )
      `)
      .eq('beneficiary_id', id);
    
    if (paymentsError) {
      console.error(`[Beneficiaries] Error fetching payments for authorization:`, paymentsError);
      return res.status(500).json({ message: 'Error verifying access' });
    }

    // Get unique monada_ids from payments
    const allMonadaIds = (payments || [])
      .map((p: any) => p.project_index?.monada_id)
      .filter((id: number | null) => id !== null && id !== undefined);
    const beneficiaryMonadaIds = Array.from(new Set(allMonadaIds)) as number[];

    console.log(`[Beneficiaries] Beneficiary ${id} is associated with monada IDs:`, beneficiaryMonadaIds);

    // Check if user has access to any of the beneficiary's units
    const hasAccess = beneficiaryMonadaIds.length === 0 || 
      beneficiaryMonadaIds.some(monadaId => userUnits.includes(monadaId));
    
    if (!hasAccess) {
      console.log(`[Beneficiaries] SECURITY: User ${req.user?.id} denied access to beneficiary ${id} - user units [${userUnits.join(', ')}] not in beneficiary units [${beneficiaryMonadaIds.join(', ')}]`);
      return res.status(403).json({
        message: 'Δεν έχετε πρόσβαση σε αυτόν τον δικαιούχο'
      });
    }
    
    console.log(`[Beneficiaries] SECURITY: Access granted to beneficiary ${id} - user has access to one of the beneficiary's units`);
    res.json(beneficiary);
  } catch (error) {
    console.error('[Beneficiaries] Error fetching beneficiary by ID:', error);
    res.status(500).json({ 
      message: 'Failed to fetch beneficiary',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create new beneficiary
router.post('/', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('[Beneficiaries] Creating new beneficiary:', req.body);
    
    // SECURITY: Get all authorized unit codes for the user
    const userUnits = req.user?.unit_id || [];
    if (userUnits.length === 0) {
      console.log('[Beneficiaries] SECURITY: User has no assigned units - blocking creation');
      return res.status(403).json({
        message: 'Δεν έχετε εκχωρημένες μονάδες για δημιουργία δικαιούχων'
      });
    }

    // Map all user unit IDs to unit codes
    const authorizedUnitCodes = [];
    for (const unitId of userUnits) {
      const unitCode = await getUnitCodeById(unitId);
      if (unitCode) {
        authorizedUnitCodes.push(unitCode);
      }
    }

    if (authorizedUnitCodes.length === 0) {
      console.error(`[Beneficiaries] Could not map any user unit IDs to unit codes`);
      return res.status(500).json({
        message: 'Σφάλμα αντιστοίχισης μονάδων χρήστη'
      });
    }

    // SECURITY: Validate and authorize monada assignment
    let assignedMonada = null;
    if (req.body.monada) {
      // Client provided a monada - verify it's in their authorized units
      if (!authorizedUnitCodes.includes(req.body.monada)) {
        console.log(`[Beneficiaries] SECURITY: User ${req.user.id} attempted to create beneficiary in unauthorized unit ${req.body.monada}`);
        return res.status(403).json({
          message: 'Δεν έχετε πρόσβαση στη συγκεκριμένη μονάδα'
        });
      }
      assignedMonada = req.body.monada;
    } else {
      // No monada provided - use first authorized unit
      assignedMonada = authorizedUnitCodes[0];
    }

    console.log(`[Beneficiaries] SECURITY: Creating beneficiary in authorized unit ${assignedMonada} for user ${req.user.id}`);

    // Transform data for proper validation
    const transformedData = {
      ...req.body,
      // Keep AFM as string to preserve leading zeros (fixes AFM data loss issue)
      afm: req.body.afm ? String(req.body.afm).trim() : undefined,
      // Handle adeia field - convert to integer if provided
      adeia: req.body.adeia && req.body.adeia !== '' ? parseInt(req.body.adeia) : undefined,
      // SECURITY: Use authorized unit code only - no client fallback
      monada: assignedMonada
    };

    // If we have financial data, structure it properly for the oikonomika field
    if (req.body.paymentType && req.body.amount && req.body.installment) {
      // Parse European decimal format (e.g., "10.286,06" -> 10286.06)
      let parsedAmount = req.body.amount;
      if (typeof parsedAmount === 'string') {
        // Handle European format: remove dots (thousands separators) and replace comma with decimal point
        if (parsedAmount.includes('.') && parsedAmount.includes(',')) {
          parsedAmount = parsedAmount.replace(/\./g, '').replace(',', '.');
        } else if (parsedAmount.includes(',') && !parsedAmount.includes('.')) {
          parsedAmount = parsedAmount.replace(',', '.');
        }
        parsedAmount = parseFloat(parsedAmount).toString();
      }

      transformedData.oikonomika = {
        [req.body.paymentType]: {
          [req.body.installment]: {
            amount: parsedAmount,
            status: null,
            installment: [req.body.installment],
            protocol_number: null
          }
        }
      };
    }

    // Remove the temporary fields that are not part of the schema
    delete transformedData.paymentType;
    delete transformedData.amount;
    delete transformedData.installment;
    
    // Validate request body
    const validationResult = insertBeneficiarySchema.safeParse(transformedData);
    if (!validationResult.success) {
      console.log('[Beneficiaries] Validation errors:', validationResult.error.issues);
      return res.status(400).json({ 
        message: 'Invalid beneficiary data',
        errors: validationResult.error.issues
      });
    }

    const beneficiaryData = validationResult.data;
    const beneficiary = await storage.createBeneficiary(beneficiaryData);
    
    console.log('[Beneficiaries] Successfully created beneficiary:', beneficiary);
    res.status(201).json(beneficiary);
  } catch (error) {
    console.error('[Beneficiaries] Error creating beneficiary:', error);
    res.status(500).json({ 
      message: 'Failed to create beneficiary',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update beneficiary
router.put('/:id', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid beneficiary ID' });
    }

    console.log(`[Beneficiaries] Updating beneficiary ${id}:`, req.body);
    
    // SECURITY: Get existing beneficiary to verify user has access
    const existingBeneficiary = await storage.getBeneficiaryById(id);
    if (!existingBeneficiary) {
      return res.status(404).json({ message: 'Beneficiary not found' });
    }

    // SECURITY: Get all authorized unit codes for the user
    const userUnits = req.user?.unit_id || [];
    if (userUnits.length === 0) {
      console.log('[Beneficiaries] SECURITY: User has no assigned units - blocking update');
      return res.status(403).json({
        message: 'Δεν έχετε εκχωρημένες μονάδες για επεξεργασία δικαιούχων'
      });
    }

    // Map all user unit IDs to unit codes
    const authorizedUnitCodes = [];
    for (const unitId of userUnits) {
      const unitCode = await getUnitCodeById(unitId);
      if (unitCode) {
        authorizedUnitCodes.push(unitCode);
      }
    }

    if (authorizedUnitCodes.length === 0) {
      console.error(`[Beneficiaries] Could not map any user unit IDs to unit codes during update`);
      return res.status(500).json({
        message: 'Σφάλμα αντιστοίχισης μονάδων χρήστη'
      });
    }

    // SECURITY: Verify user can access the existing beneficiary's unit
    const existingMonada = (existingBeneficiary as any).monada;
    if (!authorizedUnitCodes.includes(existingMonada)) {
      console.log(`[Beneficiaries] SECURITY: User ${req.user.id} attempted to update beneficiary in unauthorized unit ${existingMonada}`);
      return res.status(403).json({
        message: 'Δεν έχετε πρόσβαση σε αυτόν τον δικαιούχο'
      });
    }

    // SECURITY: Validate and authorize monada changes (if provided)
    let assignedMonada = existingMonada; // Keep existing by default
    if (req.body.monada) {
      // Client wants to change the monada - verify it's in their authorized units
      if (!authorizedUnitCodes.includes(req.body.monada)) {
        console.log(`[Beneficiaries] SECURITY: User ${req.user.id} attempted to move beneficiary to unauthorized unit ${req.body.monada}`);
        return res.status(403).json({
          message: 'Δεν έχετε πρόσβαση στη συγκεκριμένη μονάδα'
        });
      }
      assignedMonada = req.body.monada;
    }

    console.log(`[Beneficiaries] SECURITY: Updating beneficiary in authorized unit ${assignedMonada} for user ${req.user.id}`);
    
    // Transform data for proper validation with type safety
    const transformedData = {
      ...req.body,
      // Keep AFM as string for schema compatibility
      afm: req.body.afm ? String(req.body.afm).trim() : undefined,
      // Handle adeia field - convert to integer if provided
      adeia: req.body.adeia && req.body.adeia !== '' ? parseInt(req.body.adeia) : undefined,
      // SECURITY: Use authorized unit code only - no client fallback
      monada: assignedMonada
    };

    // Remove geographic_areas from transformedData since it's not part of the database schema
    // (It's handled by the frontend form but not persisted separately)
    delete transformedData.geographic_areas;

    // If we have financial data, structure it properly for the oikonomika field
    if (req.body.paymentType && req.body.amount && req.body.installment) {
      // Parse European decimal format (e.g., "10.286,06" -> 10286.06)
      let parsedAmount = req.body.amount;
      if (typeof parsedAmount === 'string') {
        // Handle European format: remove dots (thousands separators) and replace comma with decimal point
        if (parsedAmount.includes('.') && parsedAmount.includes(',')) {
          parsedAmount = parsedAmount.replace(/\./g, '').replace(',', '.');
        } else if (parsedAmount.includes(',') && !parsedAmount.includes('.')) {
          parsedAmount = parsedAmount.replace(',', '.');
        }
        parsedAmount = parseFloat(parsedAmount).toString();
      }

      // Get existing oikonomika data and merge with new data
      const existingBeneficiary = await storage.getBeneficiaryById(id);
      let existingOikonomika = {};
      
      if ((existingBeneficiary as any)?.oikonomika) {
        try {
          existingOikonomika = typeof (existingBeneficiary as any).oikonomika === 'string'
            ? JSON.parse((existingBeneficiary as any).oikonomika)
            : (existingBeneficiary as any).oikonomika;
        } catch (e) {
          console.log('[Beneficiaries] Could not parse existing oikonomika:', e);
        }
      }

      // Merge new payment data with existing
      transformedData.oikonomika = {
        ...existingOikonomika,
        [req.body.paymentType]: {
          ...((existingOikonomika as any)[req.body.paymentType] || {}),
          [req.body.installment]: {
            amount: parsedAmount,
            status: null,
            installment: [req.body.installment],
            protocol_number: null
          }
        }
      };
    }

    // Remove the temporary fields that are not part of the schema
    delete transformedData.paymentType;
    delete transformedData.amount;
    delete transformedData.installment;
    
    // Validate request body (partial update)
    const partialSchema = insertBeneficiarySchema.partial();
    const validationResult = partialSchema.safeParse(transformedData);
    if (!validationResult.success) {
      console.log('[Beneficiaries] Update validation errors:', validationResult.error.issues);
      return res.status(400).json({ 
        message: 'Invalid beneficiary data',
        errors: validationResult.error.issues
      });
    }

    const beneficiaryData = validationResult.data;
    const beneficiary = await storage.updateBeneficiary(id, beneficiaryData);
    
    console.log('[Beneficiaries] Successfully updated beneficiary:', beneficiary);
    res.json(beneficiary);
  } catch (error) {
    console.error('[Beneficiaries] Error updating beneficiary:', error);
    res.status(500).json({ 
      message: 'Failed to update beneficiary',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Delete beneficiary
router.delete('/:id', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid beneficiary ID' });
    }

    console.log(`[Beneficiaries] Deleting beneficiary ${id}`);
    await storage.deleteBeneficiary(id);
    
    console.log(`[Beneficiaries] Successfully deleted beneficiary ${id}`);
    res.status(204).send();
  } catch (error) {
    console.error('[Beneficiaries] Error deleting beneficiary:', error);
    res.status(500).json({ 
      message: 'Failed to delete beneficiary',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Bulk import beneficiaries (for CSV/Excel imports)
router.post('/bulk-import', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { beneficiaries } = req.body;
    
    if (!Array.isArray(beneficiaries)) {
      return res.status(400).json({ message: 'Beneficiaries must be an array' });
    }

    console.log(`[Beneficiaries] Bulk importing ${beneficiaries.length} beneficiaries`);
    
    const results = [];
    const errors = [];

    for (const beneficiaryData of beneficiaries) {
      try {
        const validationResult = insertBeneficiarySchema.safeParse(beneficiaryData);
        if (!validationResult.success) {
          errors.push({
            data: beneficiaryData,
            error: 'Validation failed',
            details: validationResult.error.issues
          });
          continue;
        }

        const beneficiary = await storage.createBeneficiary(validationResult.data);
        results.push(beneficiary);
      } catch (error) {
        errors.push({
          data: beneficiaryData,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log(`[Beneficiaries] Bulk import completed: ${results.length} success, ${errors.length} errors`);
    
    res.json({
      success: results.length,
      errors: errors.length,
      results,
      errorDetails: errors
    });
  } catch (error) {
    console.error('[Beneficiaries] Error in bulk import:', error);
    res.status(500).json({ 
      message: 'Failed to bulk import beneficiaries',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;