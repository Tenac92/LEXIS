import { Response, Router } from 'express';
import { storage } from '../storage';
import { authenticateSession, AuthenticatedRequest } from '../authentication';
import { insertBeneficiarySchema } from '@shared/schema';
import { supabase } from '../config/db';
import { decryptAFM } from '../utils/crypto';
import { 
  getCachedAFMData, 
  setCachedAFMData, 
  setLoadingState, 
  isLoading as isCacheLoading,
  getCacheStats,
  invalidateAFMCache
} from '../utils/afm-cache';

export const router = Router();

// In-memory cache for beneficiaries list (per user units combination)
interface CacheEntry {
  data: any[];
  timestamp: number;
}
const beneficiariesCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
let beneficiariesCacheVersion = 0;

function getBeneficiariesCacheVersion(): number {
  return beneficiariesCacheVersion;
}

function bumpBeneficiariesCacheVersion(): number {
  beneficiariesCacheVersion += 1;
  return beneficiariesCacheVersion;
}

function getCacheKey(unitIds: readonly (number | string | bigint)[]): string {
  const normalizedUnitIds = unitIds
    .map((unitId) => String(unitId))
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  return `beneficiaries_${normalizedUnitIds.join("_")}`;
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
// Clears BOTH the beneficiaries list cache AND the AFM autocomplete cache
export function invalidateBeneficiariesCache(unitIds?: number[]): void {
  const nextVersion = bumpBeneficiariesCacheVersion();
  if (unitIds) {
    const key = getCacheKey(unitIds);
    beneficiariesCache.delete(key);
    invalidateAFMCache(unitIds); // Also clear AFM cache
    console.log(`[Beneficiaries] BOTH CACHES INVALIDATED for units: ${unitIds.join(', ')} (cache version ${nextVersion})`);
  } else {
    beneficiariesCache.clear();
    invalidateAFMCache(); // Clear all AFM cache
    console.log(`[Beneficiaries] BOTH CACHES CLEARED (all units, cache version ${nextVersion})`);
  }
}

// Helper function to map region name to region code
// Helper function to get unit abbreviation from full unit name

// Helper function to map unit ID to unit code
async function getUnitCodeById(unitId: number): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('Monada')
      .select('unit')
      .eq('id', unitId)
      .single();
    
    if (error) {
      console.error(`[Beneficiaries] Error mapping unit ID ${unitId} to code:`, error);
      return null;
    }
    
    return data?.unit || null;
  } catch (error) {
    console.error(`[Beneficiaries] Exception mapping unit ID ${unitId}:`, error);
    return null;
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
    
    // PAGINATION: Parse limit and offset from query parameters
    const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const offsetParam = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
    const limit =
      typeof limitParam === "number" && Number.isFinite(limitParam) && limitParam > 0
        ? Math.min(limitParam, 500) // Cap at 500 per request for performance
        : undefined;
    const offset =
      typeof offsetParam === "number" && Number.isFinite(offsetParam) && offsetParam >= 0
        ? offsetParam
        : 0;
    
    // PERFORMANCE: Check cache first (only full list, not paginated)
    const cachedData = getCachedBeneficiaries(userUnits);
    if (cachedData) {
      console.log(`[Beneficiaries] Cache hit for units: ${userUnits.join(', ')}`);
      
      // Apply pagination to cached data
      let paginatedData = cachedData;
      let total = cachedData.length;
      
      if (limit) {
        paginatedData = cachedData.slice(offset, offset + limit);
        console.log(`[Beneficiaries] Returning paginated cached data: offset=${offset}, limit=${limit}, total=${total}, returned=${paginatedData.length}`);
      } else {
        console.log(`[Beneficiaries] Returning all ${total} cached beneficiaries`);
      }
      
      // Set pagination headers
      res.set('X-Total-Count', total.toString());
      if (limit) {
        res.set('X-Returned-Count', paginatedData.length.toString());
        res.set('X-Offset', offset.toString());
        res.set('X-Limit', limit.toString());
      }
      
      return res.json(paginatedData);
    }
    
    const cacheVersionSnapshot = getBeneficiariesCacheVersion();

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
    
    // Cache the results only if cache wasn't invalidated while this request was in flight.
    if (cacheVersionSnapshot === getBeneficiariesCacheVersion()) {
      setCachedBeneficiaries(userUnits, allBeneficiaries);
    } else {
      console.log(
        `[Beneficiaries] Skipping stale cache set for units: ${userUnits.join(', ')} (started on version ${cacheVersionSnapshot}, current ${getBeneficiariesCacheVersion()})`,
      );
    }
    
    // Apply pagination
    let paginatedData = allBeneficiaries;
    let total = allBeneficiaries.length;
    
    if (limit) {
      paginatedData = allBeneficiaries.slice(offset, offset + limit);
      console.log(`[Beneficiaries] SECURITY: Returning ${paginatedData.length} beneficiaries (paginated) from ${userUnits.length} authorized units (total=${total})`);
    } else {
      console.log(`[Beneficiaries] SECURITY: Returning ${allBeneficiaries.length} beneficiaries (OPTIMIZED - AFM masked) from ${userUnits.length} authorized units only`);
    }
    
    // Set pagination headers
    res.set('X-Total-Count', total.toString());
    if (limit) {
      res.set('X-Returned-Count', paginatedData.length.toString());
      res.set('X-Offset', offset.toString());
      res.set('X-Limit', limit.toString());
    }
    
    res.json(paginatedData);
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
    const beneficiaries = await storage.searchBeneficiariesByAFM(afm);
    
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
    const beneficiaries = await storage.searchBeneficiariesByAFM(afm);
    
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

// BACKGROUND PREFETCH: Prefetch and cache all beneficiaries with decrypted AFMs for instant autocomplete
// NOTE: This route MUST be before /:id to avoid Express matching "prefetch" as an ID
router.get('/prefetch', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const userUnits = req.user.unit_id || [];
    if (userUnits.length === 0) {
      return res.status(403).json({ success: false, message: 'No assigned units' });
    }

    // Check if already cached
    const cached = getCachedAFMData(userUnits);
    if (cached) {
      console.log(`[Prefetch] Cache HIT - returning cached data for units: ${userUnits.join(', ')}`);
      return res.json({
        success: true,
        source: 'cache',
        beneficiaryCount: cached.beneficiaries.length,
        employeeCount: cached.employees.length
      });
    }

    // Check if already loading
    if (isCacheLoading(userUnits)) {
      console.log(`[Prefetch] Already loading for units: ${userUnits.join(', ')}`);
      return res.json({
        success: true,
        source: 'loading',
        message: 'Prefetch already in progress'
      });
    }

    const prefetchCacheVersion = getBeneficiariesCacheVersion();

    // Start background prefetch
    setLoadingState(userUnits, true);
    console.log(`[Prefetch] Starting background prefetch for units: ${userUnits.join(', ')}`);

    // Get unit codes for the user's units
    const unitCodes: string[] = [];
    for (const unitId of userUnits) {
      const unitCode = await getUnitCodeById(unitId);
      if (unitCode) {
        unitCodes.push(unitCode);
      }
    }

    if (unitCodes.length === 0) {
      setLoadingState(userUnits, false);
      return res.status(500).json({ success: false, message: 'Could not map unit IDs' });
    }

    // Respond immediately to not block the client
    res.json({
      success: true,
      source: 'started',
      message: 'Background prefetch started',
      units: unitCodes
    });

    // Continue prefetching in background
    (async () => {
      try {
        const startTime = Date.now();
        const beneficiaryCache: any[] = [];
        const employeeCache: any[] = [];
        const beneficiariesListCache: any[] = []; // For beneficiaries page list

        // Fetch beneficiaries using the same logic as getBeneficiariesByUnitOptimized:
        // 1. Beneficiaries with payments for THIS unit
        // 2. Beneficiaries without ANY payments (new/unassigned - visible to all units)
        for (const unitCode of unitCodes) {
          console.log(`[Prefetch] Fetching beneficiaries for unit: ${unitCode}`);
          
          // Get unit ID for this unit code
          const { data: monadaData, error: monadaError } = await supabase
            .from('Monada')
            .select('id')
            .eq('unit', unitCode)
            .single();

          if (monadaError || !monadaData) {
            console.error(`[Prefetch] Could not find unit ID for unit code: ${unitCode}`, monadaError);
            continue;
          }
          
          const unitId = monadaData.id;

          // STEP 1: Get beneficiary IDs that have payments for this specific unit
          const { data: paymentsBeneficiaryIds, error: paymentsError } = await supabase
            .from('beneficiary_payments')
            .select('beneficiary_id')
            .eq('unit_id', unitId);
            
          if (paymentsError) {
            console.error('[Prefetch] Error fetching beneficiary IDs from payments:', paymentsError);
          }
          
          const beneficiaryIdsWithPayments = new Set(paymentsBeneficiaryIds?.map(p => p.beneficiary_id) || []);
          console.log(`[Prefetch] Found ${beneficiaryIdsWithPayments.size} beneficiaries with payments for unit ${unitCode}`);
          
          // STEP 2: Get ALL beneficiary IDs that have ANY payment (to exclude from "new" beneficiaries)
          const { data: allPaymentsBeneficiaryIds, error: allPaymentsError } = await supabase
            .from('beneficiary_payments')
            .select('beneficiary_id');
            
          if (allPaymentsError) {
            console.error('[Prefetch] Error fetching all beneficiary IDs from payments:', allPaymentsError);
          }
          
          const allBeneficiaryIdsWithPayments = new Set(allPaymentsBeneficiaryIds?.map(p => p.beneficiary_id) || []);
          console.log(`[Prefetch] Total beneficiaries with any payments: ${allBeneficiaryIdsWithPayments.size}`);
          
          // STEP 3: Get beneficiaries that have NO payments yet (new beneficiaries visible to all units)
          const { data: allBeneficiaryIds, error: allBeneficiariesError } = await supabase
            .from('beneficiaries')
            .select('id');
            
          if (allBeneficiariesError) {
            console.error('[Prefetch] Error fetching all beneficiary IDs:', allBeneficiariesError);
          }
          
          // Find beneficiaries with NO payments (new/unassigned)
          const beneficiaryIdsWithoutPayments = (allBeneficiaryIds || [])
            .filter(b => !allBeneficiaryIdsWithPayments.has(b.id))
            .map(b => b.id);
          console.log(`[Prefetch] Found ${beneficiaryIdsWithoutPayments.length} beneficiaries without any payments (new/unassigned)`);
          
          // STEP 4: Combine: beneficiaries with payments for this unit + new beneficiaries without any payments
          const uniqueBeneficiaryIds = Array.from(new Set([
            ...Array.from(beneficiaryIdsWithPayments),
            ...beneficiaryIdsWithoutPayments
          ]));
          console.log(`[Prefetch] Total beneficiaries to fetch: ${uniqueBeneficiaryIds.length} (${beneficiaryIdsWithPayments.size} with payments + ${beneficiaryIdsWithoutPayments.length} new)`);

          if (uniqueBeneficiaryIds.length === 0) continue;

          // Fetch beneficiaries in batches
          const batchSize = 500;
          for (let i = 0; i < uniqueBeneficiaryIds.length; i += batchSize) {
            const idBatch = uniqueBeneficiaryIds.slice(i, i + batchSize);
            
            const { data } = await supabase
              .from('beneficiaries')
              .select('id, afm, surname, name, fathername, ceng1, ceng2, regiondet, freetext, date, created_at, updated_at, afm_hash, adeia, onlinefoldernumber')
              .in('id', idBatch);

            if (data) {
              for (const b of data) {
                const decryptedAFM = decryptAFM(b.afm);
                
                if (decryptedAFM) {
                  beneficiaryCache.push({
                    decryptedAFM,
                    beneficiaryId: b.id,
                    surname: b.surname,
                    name: b.name,
                    fathername: b.fathername,
                    timestamp: Date.now()
                  });
                }
                
                beneficiariesListCache.push({
                  ...b,
                  afm: decryptedAFM || '***ERROR***',
                  monada: unitCode
                });
              }
            }
          }
          
          console.log(`[Prefetch] Fetched ${uniqueBeneficiaryIds.length} beneficiaries (${beneficiaryIdsWithPayments.size} with payments + ${beneficiaryIdsWithoutPayments.length} new) for unit: ${unitCode}`);
        }

        // Fetch employees for ΕΚΤΟΣ ΕΔΡΑΣ (they are unit-independent but still needed)
        console.log(`[Prefetch] Fetching employees for all units`);
        const { data: employeesData } = await supabase
          .from('Employees')
          .select('id, afm, surname, name, fathername, monada')
          .in('monada', unitCodes)
          .limit(2000);

        if (employeesData) {
          for (const e of employeesData) {
            const decryptedAFM = decryptAFM(e.afm);
            if (decryptedAFM) {
              employeeCache.push({
                decryptedAFM,
                beneficiaryId: e.id,
                surname: e.surname,
                name: e.name,
                fathername: e.fathername,
                timestamp: Date.now()
              });
            }
          }
        }

        const currentCacheVersion = getBeneficiariesCacheVersion();
        if (prefetchCacheVersion !== currentCacheVersion) {
          console.log(
            `[Prefetch] Skipping stale cache write for units: ${userUnits.join(', ')} (started on version ${prefetchCacheVersion}, current ${currentCacheVersion})`,
          );
          setLoadingState(userUnits, false);
          return;
        }

        // Store in AFM autocomplete cache
        setCachedAFMData(userUnits, beneficiaryCache, employeeCache);
        
        // Store in beneficiaries list cache (for faster page loading)
        setCachedBeneficiaries(userUnits, beneficiariesListCache);
        
        setLoadingState(userUnits, false);

        const elapsed = Date.now() - startTime;
        console.log(`[Prefetch] COMPLETED in ${elapsed}ms - ${beneficiaryCache.length} AFM entries, ${beneficiariesListCache.length} list entries, ${employeeCache.length} employees cached for units: ${userUnits.join(', ')}`);
      } catch (error) {
        console.error('[Prefetch] Background prefetch error:', error);
        setLoadingState(userUnits, false);
      }
    })();

  } catch (error) {
    console.error('[Prefetch] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start prefetch',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get cache stats (for debugging)
router.get('/prefetch/stats', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  const stats = getCacheStats();
  res.json({ success: true, stats });
});

// FAST SEARCH: Optimized endpoint that handles both exact 9-digit AFM (hash lookup) and prefix search (cache)
// This is the preferred endpoint for autocomplete - combines both strategies
router.get('/search-fast', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { afm, type } = req.query;
    const startTime = Date.now();
    
    if (!afm || typeof afm !== 'string' || afm.length < 4) {
      return res.status(400).json({
        success: false,
        message: 'AFM must be at least 4 characters'
      });
    }

    const userUnits = req.user?.unit_id || [];
    if (userUnits.length === 0) {
      return res.status(403).json({ success: false, message: 'No assigned units' });
    }

    const isEmployeeSearch = type === 'employee';
    const isExactAFM = afm.length === 9 && /^\d{9}$/.test(afm);

    // STRATEGY 1: For exact 9-digit AFM, use hash lookup (instant O(1) database query)
    if (isExactAFM) {
      console.log(`[SearchFast] Exact AFM search using hash: ${afm}`);
      
      if (isEmployeeSearch) {
        // Employee search by hash - SECURITY: Filter by user's authorized units
        const { hashAFM, decryptAFM } = await import('../utils/crypto');
        const afmHash = hashAFM(afm);
        
        // Get unit codes for the user's units (required for security filtering)
        const unitCodes: string[] = [];
        for (const unitId of userUnits) {
          const unitCode = await getUnitCodeById(unitId);
          if (unitCode) {
            unitCodes.push(unitCode);
          }
        }

        if (unitCodes.length === 0) {
          console.log('[SearchFast] SECURITY: Could not resolve user unit codes');
          return res.status(403).json({ success: false, message: 'No authorized units' });
        }

        const { data, error } = await supabase
          .from('Employees')
          .select('id, afm, surname, name, fathername, monada')
          .eq('afm_hash', afmHash)
          .in('monada', unitCodes) // SECURITY: Only return employees from user's units
          .limit(20);
          
        if (error) {
          console.error('[SearchFast] Employee hash lookup error:', error);
          throw error;
        }

        const results = (data || []).map(e => ({
          id: e.id,
          afm: decryptAFM(e.afm) || afm, // Use input AFM if decryption fails (we know it matches)
          surname: e.surname,
          name: e.name,
          fathername: e.fathername
        }));

        const elapsed = Date.now() - startTime;
        console.log(`[SearchFast] Employee hash lookup returned ${results.length} results in ${elapsed}ms (filtered by ${unitCodes.length} units)`);

        return res.json({
          success: true,
          source: 'hash',
          data: results,
          count: results.length,
          elapsed
        });
      } else {
        // Beneficiary search by hash
        const { hashAFM } = await import('../utils/crypto');
        const afmHash = hashAFM(afm);
        
        const { data, error } = await supabase
          .from('beneficiaries')
          .select('id, afm, surname, name, fathername')
          .eq('afm_hash', afmHash)
          .limit(20);
          
        if (error) {
          console.error('[SearchFast] Beneficiary hash lookup error:', error);
          throw error;
        }

        const { decryptAFM } = await import('../utils/crypto');
        const results = (data || []).map(b => ({
          id: b.id,
          afm: decryptAFM(b.afm) || afm, // Use input AFM if decryption fails
          surname: b.surname,
          name: b.name,
          fathername: b.fathername
        }));

        const elapsed = Date.now() - startTime;
        console.log(`[SearchFast] Beneficiary hash lookup returned ${results.length} results in ${elapsed}ms`);

        return res.json({
          success: true,
          source: 'hash',
          data: results,
          count: results.length,
          elapsed
        });
      }
    }

    // STRATEGY 2: For partial AFM, use cache (instant in-memory search)
    const cached = getCachedAFMData(userUnits);
    if (cached) {
      const searchData = isEmployeeSearch ? cached.employees : cached.beneficiaries;
      
      const results = searchData
        .filter(item => item.decryptedAFM.startsWith(afm))
        .slice(0, 20)
        .map(item => ({
          id: item.beneficiaryId,
          afm: item.decryptedAFM,
          surname: item.surname,
          name: item.name,
          fathername: item.fathername
        }));

      const elapsed = Date.now() - startTime;
      console.log(`[SearchFast] Cache search returned ${results.length} results in ${elapsed}ms for prefix: ${afm}`);

      return res.json({
        success: true,
        source: 'cache',
        data: results,
        count: results.length,
        elapsed
      });
    }

    // STRATEGY 3: Cache miss - return empty and signal fallback needed
    console.log(`[SearchFast] Cache MISS for prefix: ${afm}, units: ${userUnits.join(', ')}`);
    res.json({
      success: true,
      source: 'fallback',
      data: [],
      count: 0,
      message: 'Cache not available'
    });

  } catch (error) {
    console.error('[SearchFast] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Search failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Search from prefetched cache (fast path)
router.get('/search-cached', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { afm, type } = req.query;
    
    if (!afm || typeof afm !== 'string' || afm.length < 4) {
      return res.status(400).json({
        success: false,
        message: 'AFM must be at least 4 characters'
      });
    }

    const userUnits = req.user?.unit_id || [];
    if (userUnits.length === 0) {
      return res.status(403).json({ success: false, message: 'No assigned units' });
    }

    // Try to get from cache
    const cached = getCachedAFMData(userUnits);
    if (!cached) {
      // Cache miss - fallback to regular search
      console.log(`[SearchCached] Cache MISS for units: ${userUnits.join(', ')} - falling back to regular search`);
      return res.json({
        success: true,
        source: 'fallback',
        data: [],
        message: 'Cache not available, use /search endpoint'
      });
    }

    // Search in cached data
    const isEmployeeSearch = type === 'employee';
    const searchData = isEmployeeSearch ? cached.employees : cached.beneficiaries;
    
    const results = searchData
      .filter(item => item.decryptedAFM.startsWith(afm))
      .slice(0, 20)
      .map(item => ({
        id: item.beneficiaryId,
        afm: item.decryptedAFM,
        surname: item.surname,
        name: item.name,
        fathername: item.fathername
      }));

    console.log(`[SearchCached] Found ${results.length} ${isEmployeeSearch ? 'employees' : 'beneficiaries'} for AFM prefix: ${afm}`);

    res.json({
      success: true,
      source: 'cache',
      data: results,
      count: results.length
    });
  } catch (error) {
    console.error('[SearchCached] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Search failed',
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
        console.log(`[Beneficiaries] SECURITY: User ${req.user?.id} attempted to create beneficiary in unauthorized unit ${req.body.monada}`);
        return res.status(403).json({
          message: 'Δεν έχετε πρόσβαση στη συγκεκριμένη μονάδα'
        });
      }
      assignedMonada = req.body.monada;
    } else {
      // No monada provided - use first authorized unit
      assignedMonada = authorizedUnitCodes[0];
    }

    console.log(`[Beneficiaries] SECURITY: Creating beneficiary in authorized unit ${assignedMonada} for user ${req.user?.id}`);

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
    
    // Validate request body (afm_hash is computed server-side)
    const createBeneficiarySchema = insertBeneficiarySchema.omit({ afm_hash: true });
    const validationResult = createBeneficiarySchema.safeParse(transformedData);
    if (!validationResult.success) {
      console.log('[Beneficiaries] Validation errors:', validationResult.error.issues);
      return res.status(400).json({ 
        message: 'Invalid beneficiary data',
        errors: validationResult.error.issues
      });
    }

    const beneficiaryData = validationResult.data;
    const beneficiary = await storage.createBeneficiary(beneficiaryData);
    
    // Invalidate cache after creating beneficiary
    invalidateBeneficiariesCache(userUnits);
    
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

    // SECURITY: Check if user has access to this beneficiary
    // Beneficiaries are linked to units via beneficiary_payments table, NOT via a direct monada column
    // A user can update a beneficiary if:
    // 1. The beneficiary has payments for the user's unit, OR
    // 2. The beneficiary has NO payments yet (new/unassigned beneficiary visible to all)
    const { data: beneficiaryPayments } = await supabase
      .from('beneficiary_payments')
      .select('unit_id')
      .eq('beneficiary_id', id);
    
    const beneficiaryUnitIds = beneficiaryPayments?.map(p => p.unit_id) || [];
    const hasPaymentsForUserUnit = userUnits.some(unitId => beneficiaryUnitIds.includes(unitId));
    const hasNoPayments = beneficiaryUnitIds.length === 0;
    
    if (!hasPaymentsForUserUnit && !hasNoPayments) {
      console.log(`[Beneficiaries] SECURITY: User ${req.user?.id} attempted to update beneficiary ${id} which belongs to other units: ${beneficiaryUnitIds.join(', ')}`);
      return res.status(403).json({
        message: 'Δεν έχετε πρόσβαση σε αυτόν τον δικαιούχο'
      });
    }

    console.log(`[Beneficiaries] SECURITY: User ${req.user?.id} authorized to update beneficiary ${id} (payments for user unit: ${hasPaymentsForUserUnit}, no payments: ${hasNoPayments})`);
    
    // Transform data for proper validation with type safety
    // Note: beneficiaries table does NOT have a 'monada' column - unit association is via beneficiary_payments
    const transformedData = {
      ...req.body,
      // Keep AFM as string for schema compatibility
      afm: req.body.afm ? String(req.body.afm).trim() : undefined,
      // Handle adeia field - convert to integer if provided
      adeia: req.body.adeia && req.body.adeia !== '' ? parseInt(req.body.adeia) : undefined
    };
    
    // Remove monada from request if present since beneficiaries table doesn't have this column
    delete transformedData.monada;

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
    
    // Invalidate cache after updating beneficiary
    invalidateBeneficiariesCache(userUnits);
    
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

    const deletionStatus = await storage.getBeneficiaryDeletionStatus(id);
    if (deletionStatus.hasPayments || deletionStatus.hasDocumentLinkedPayments) {
      return res.status(409).json({
        code: 'BENEFICIARY_HAS_LINKED_PAYMENTS',
        message: 'Cannot delete beneficiary because it has linked payments/documents.',
        details: {
          paymentCount: deletionStatus.paymentCount,
          hasDocumentLinkedPayments: deletionStatus.hasDocumentLinkedPayments,
        },
      });
    }

    console.log(`[Beneficiaries] Deleting beneficiary ${id}`);
    await storage.deleteBeneficiary(id);
    
    // Invalidate all caches after deleting beneficiary (affects all units)
    invalidateBeneficiariesCache();
    
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
    
    // Invalidate all caches after bulk import
    if (results.length > 0) {
      invalidateBeneficiariesCache();
    }
    
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
