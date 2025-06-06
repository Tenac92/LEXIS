import { Request, Response, Router } from 'express';
import { storage } from '../storage';
import { authenticateSession, AuthenticatedRequest } from '../authentication';
import { insertBeneficiarySchema, type Beneficiary, type InsertBeneficiary } from '@shared/schema';
import { z } from 'zod';
import { supabase } from '../config/db';

export const router = Router();

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

    console.log(`[Beneficiaries] SECURITY: User ${req.user.id} (${req.user.role}) requesting beneficiaries for units: ${req.user.units?.join(', ') || 'NONE'}`);

    // SECURITY: Get user's units for filtering - NO EXCEPTION FOR ANY ROLE
    const userUnits = req.user.units || [];
    if (userUnits.length === 0) {
      console.log('[Beneficiaries] SECURITY: User has no assigned units - blocking access');
      return res.status(403).json({
        message: 'Δεν έχετε εκχωρημένες μονάδες'
      });
    }
    
    // SECURITY: Get beneficiaries ONLY for user's assigned units
    const allBeneficiaries = [];
    for (const fullUnitName of userUnits) {
      const userUnit = await getUnitAbbreviation(fullUnitName);
      console.log(`[Beneficiaries] SECURITY: Fetching beneficiaries ONLY for authorized unit: ${userUnit} (mapped from: ${fullUnitName})`);
      const unitBeneficiaries = await storage.getBeneficiariesByUnit(userUnit);
      allBeneficiaries.push(...unitBeneficiaries);
    }
    
    console.log(`[Beneficiaries] SECURITY: Returning ${allBeneficiaries.length} beneficiaries from ${userUnits.length} authorized units only`);
    
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

// Get beneficiaries by unit
router.get('/by-unit/:unit', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { unit } = req.params;
    console.log(`[Beneficiaries] Fetching beneficiaries for unit: ${unit}`);
    
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

    // Get user's unit for filtering
    const userFullUnitName = req.user?.units?.[0]; // Get first unit from user's units array
    if (!userFullUnitName) {
      return res.status(403).json({
        success: false,
        message: 'Δεν βρέθηκε μονάδα για τον χρήστη'
      });
    }
    
    // Get the abbreviated unit code using the helper function
    const userUnit = await getUnitAbbreviation(userFullUnitName);
    
    console.log(`[Beneficiaries] User full unit name: "${userFullUnitName}"`);
    console.log(`[Beneficiaries] Mapped to abbreviated unit: "${userUnit}"`);
    
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
    console.log(`[Beneficiaries] Sample beneficiary monada values:`, beneficiaries.slice(0, 3).map(b => ({ id: b.id, monada: b.monada })));
    
    // Include financial data (oikonomika) if requested for smart autocomplete
    if (includeFinancial) {
      console.log(`[Beneficiaries] Including financial data for smart autocomplete`);
      
      // Fetch financial data for each beneficiary from beneficiary_payments table
      for (let i = 0; i < beneficiaries.length; i++) {
        const beneficiary = beneficiaries[i] as any;
        try {
          const payments = await storage.getBeneficiaryPayments(beneficiary.id);
          console.log(`[Beneficiaries] Found ${payments.length} payments for beneficiary ${beneficiary.id}`);
          
          // Group payments by expenditure_type to create oikonomika structure
          const oikonomika: Record<string, any[]> = {};
          payments.forEach(payment => {
            const expType = payment.expenditure_type || 'UNKNOWN';
            if (!oikonomika[expType]) {
              oikonomika[expType] = [];
            }
            oikonomika[expType].push({
              amount: payment.amount,
              installment: payment.installment ? [payment.installment] : ['ΕΦΑΠΑΞ'],
              status: payment.status,
              expenditure_type: payment.expenditure_type,
              unit_code: payment.unit_code,
              na853_code: payment.na853_code,
              protocol_number: payment.protocol_number,
              created_at: payment.created_at
            });
          });
          
          beneficiary.oikonomika = oikonomika;
          console.log(`[Beneficiaries] Added oikonomika for beneficiary ${beneficiary.id}:`, Object.keys(oikonomika));
        } catch (error) {
          console.error(`[Beneficiaries] Error fetching payments for beneficiary ${beneficiary.id}:`, error);
          beneficiary.oikonomika = {};
        }
      }
      
      // When including financial data (for document creation), allow cross-unit access
      console.log(`[Beneficiaries] Cross-unit AFM search enabled - showing all matching beneficiaries`);
      beneficiaries.forEach((beneficiary: any) => {
        if (beneficiary.monada !== userUnit) {
          console.log(`[Beneficiaries] Cross-unit access: beneficiary ${beneficiary.id} (${beneficiary.monada}) visible to user in ${userUnit}`);
        }
      });
    } else {
      // For regular searches, maintain unit filtering
      beneficiaries = beneficiaries.filter((beneficiary: any) => {
        const matches = beneficiary.monada === userUnit;
        if (!matches) {
          console.log(`[Beneficiaries] Filtering out beneficiary ${beneficiary.id}: monada "${beneficiary.monada}" != user unit "${userUnit}"`);
        }
        return matches;
      });
    }
    
    // Note: Removed expenditure type filtering to allow beneficiaries to be used across different expenditure types
    // The same beneficiary can now be selected for any expenditure type, regardless of their previous payment history
    
    console.log(`[Beneficiaries] Found ${beneficiaries.length} beneficiaries matching criteria for unit ${userUnit}`);
    
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

// Legacy endpoint for AFM search (backwards compatibility)
router.get('/search/afm/:afm', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { afm } = req.params;
    console.log(`[Beneficiaries] Searching beneficiaries by AFM: ${afm}`);
    
    const beneficiaries = await storage.searchBeneficiariesByAFM(afm);
    res.json(beneficiaries);
  } catch (error) {
    console.error('[Beneficiaries] Error searching beneficiaries by AFM:', error);
    res.status(500).json({ 
      message: 'Failed to search beneficiaries by AFM',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get single beneficiary by ID
router.get('/:id', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid beneficiary ID' });
    }

    console.log(`[Beneficiaries] Fetching beneficiary by ID: ${id}`);
    const beneficiary = await storage.getBeneficiaryById(id);
    
    if (!beneficiary) {
      return res.status(404).json({ message: 'Beneficiary not found' });
    }
    
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
    
    // Transform data for proper validation
    const transformedData = {
      ...req.body,
      // Convert AFM from string to integer for database storage
      afm: req.body.afm ? parseInt(req.body.afm) : undefined,
      // Handle adeia field - convert to integer if provided
      adeia: req.body.adeia && req.body.adeia !== '' ? parseInt(req.body.adeia) : undefined,
      // Set unit from user's authenticated units
      monada: req.user?.units?.[0] || req.body.monada
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
    
    // Transform data for proper validation (same as create)
    const transformedData = {
      ...req.body,
      // Convert AFM from string to integer for database storage
      afm: req.body.afm ? parseInt(req.body.afm) : undefined,
      // Handle adeia field - convert to integer if provided
      adeia: req.body.adeia && req.body.adeia !== '' ? parseInt(req.body.adeia) : undefined,
      // Set unit from user's authenticated units
      monada: req.user?.units?.[0] || req.body.monada
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

      // Get existing oikonomika data and merge with new data
      const existingBeneficiary = await storage.getBeneficiaryById(id);
      let existingOikonomika = {};
      
      if (existingBeneficiary?.oikonomika) {
        try {
          existingOikonomika = typeof existingBeneficiary.oikonomika === 'string'
            ? JSON.parse(existingBeneficiary.oikonomika)
            : existingBeneficiary.oikonomika;
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