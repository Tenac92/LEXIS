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

// Get beneficiaries filtered by user's unit
router.get('/', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Enforce unit access control
    if (!req.user) {
      return res.status(401).json({
        message: 'Μη εξουσιοδοτημένη πρόσβαση'
      });
    }

    // Admins can see all beneficiaries, regular users only from their units
    if (req.user.role === 'admin') {
      const beneficiaries = await storage.getAllBeneficiaries();
      return res.json(beneficiaries);
    }

    // Get user's units for filtering
    const userUnits = req.user.units || [];
    if (userUnits.length === 0) {
      return res.status(403).json({
        message: 'Δεν έχετε εκχωρημένες μονάδες'
      });
    }
    
    // Get beneficiaries for all user's units
    const allBeneficiaries = [];
    for (const fullUnitName of userUnits) {
      const userUnit = await getUnitAbbreviation(fullUnitName);
      console.log(`[Beneficiaries] Fetching beneficiaries for unit: ${userUnit} (mapped from: ${fullUnitName})`);
      const unitBeneficiaries = await storage.getBeneficiariesByUnit(userUnit);
      allBeneficiaries.push(...unitBeneficiaries);
    }
    
    console.log(`[Beneficiaries] Found ${allBeneficiaries.length} beneficiaries across ${userUnits.length} units`);
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
    
    let beneficiaries = await storage.searchBeneficiariesByAFM(afm);
    
    console.log(`[Beneficiaries] Raw search returned ${beneficiaries.length} beneficiaries`);
    console.log(`[Beneficiaries] Sample beneficiary monada values:`, beneficiaries.slice(0, 3).map(b => ({ id: b.id, monada: b.monada })));
    
    // Filter by user's unit (monada field must match user's unit)
    beneficiaries = beneficiaries.filter((beneficiary: any) => {
      const matches = beneficiary.monada === userUnit;
      if (!matches) {
        console.log(`[Beneficiaries] Filtering out beneficiary ${beneficiary.id}: monada "${beneficiary.monada}" != user unit "${userUnit}"`);
      }
      return matches;
    });
    
    // Filter by type if specified
    if (type && typeof type === 'string') {
      beneficiaries = beneficiaries.filter((beneficiary: any) => 
        beneficiary.type === type
      );
    }
    
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
    
    // Validate request body
    const validationResult = insertBeneficiarySchema.safeParse(req.body);
    if (!validationResult.success) {
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
    
    // Validate request body (partial update)
    const partialSchema = insertBeneficiarySchema.partial();
    const validationResult = partialSchema.safeParse(req.body);
    if (!validationResult.success) {
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