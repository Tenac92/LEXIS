import { Request, Response, Router } from 'express';
import { storage } from '../storage';
import { authenticateSession, AuthenticatedRequest } from '../authentication';
import { insertBeneficiarySchema, type Beneficiary, type InsertBeneficiary } from '@shared/schema';
import { z } from 'zod';

export const router = Router();

// Get all beneficiaries
router.get('/', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('[Beneficiaries] Fetching all beneficiaries');
    const beneficiaries = await storage.getAllBeneficiaries();
    res.json(beneficiaries);
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

// Search beneficiaries by AFM
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