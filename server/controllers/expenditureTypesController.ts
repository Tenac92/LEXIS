/**
 * Expenditure Types Controller
 * Handles expenditure type reference data operations
 */

import { Request, Response } from 'express';
import { supabase } from '../config/db';
import { asyncHandler } from '../middleware/errorHandler';

/**
 * Get all expenditure types
 */
export const getExpenditureTypes = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { data: expenditureTypes, error } = await supabase
      .from('expediture_types')
      .select('*')
      .order('id');

    if (error) {
      console.error('[ExpenditureTypes] Error fetching expenditure types:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to fetch expenditure types',
        error: error.message
      });
    }

    // If no data, return empty array with proper structure
    if (!expenditureTypes || expenditureTypes.length === 0) {
      return res.status(200).json({
        status: 'success',
        data: [],
        message: 'No expenditure types found'
      });
    }

    return res.status(200).json({
      status: 'success',
      data: expenditureTypes,
      count: expenditureTypes.length
    });

  } catch (error) {
    console.error('[ExpenditureTypes] Unexpected error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

/**
 * Get expenditure type by ID
 */
export const getExpenditureTypeById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const { data: expenditureType, error } = await supabase
      .from('expediture_types')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          status: 'error',
          message: 'Expenditure type not found'
        });
      }
      
      console.error('[ExpenditureTypes] Error fetching expenditure type:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to fetch expenditure type',
        error: error.message
      });
    }

    return res.status(200).json({
      status: 'success',
      data: expenditureType
    });

  } catch (error) {
    console.error('[ExpenditureTypes] Unexpected error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

/**
 * Create expenditure type
 */
export const createExpenditureType = asyncHandler(async (req: Request, res: Response) => {
  const { name, description, category } = req.body;

  try {
    const { data: newExpenditureType, error } = await supabase
      .from('expediture_types')
      .insert([{
        name,
        description,
        category,
        is_active: true
      }])
      .select()
      .single();

    if (error) {
      console.error('[ExpenditureTypes] Error creating expenditure type:', error);
      
      if (error.code === '23505') {
        return res.status(409).json({
          status: 'error',
          message: 'Expenditure type already exists'
        });
      }
      
      return res.status(500).json({
        status: 'error',
        message: 'Failed to create expenditure type',
        error: error.message
      });
    }

    return res.status(201).json({
      status: 'success',
      data: newExpenditureType,
      message: 'Expenditure type created successfully'
    });

  } catch (error) {
    console.error('[ExpenditureTypes] Unexpected error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

/**
 * Update expenditure type
 */
export const updateExpenditureType = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, category, is_active } = req.body;

  try {
    const { data: updatedExpenditureType, error } = await supabase
      .from('expediture_types')
      .update({
        name,
        description,
        category,
        is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          status: 'error',
          message: 'Expenditure type not found'
        });
      }
      
      console.error('[ExpenditureTypes] Error updating expenditure type:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to update expenditure type',
        error: error.message
      });
    }

    return res.status(200).json({
      status: 'success',
      data: updatedExpenditureType,
      message: 'Expenditure type updated successfully'
    });

  } catch (error) {
    console.error('[ExpenditureTypes] Unexpected error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

/**
 * Delete expenditure type
 */
export const deleteExpenditureType = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from('expediture_types')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[ExpenditureTypes] Error deleting expenditure type:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to delete expenditure type',
        error: error.message
      });
    }

    return res.status(200).json({
      status: 'success',
      message: 'Expenditure type deleted successfully'
    });

  } catch (error) {
    console.error('[ExpenditureTypes] Unexpected error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

/**
 * Get expenditure types for project filtering
 */
export const getExpenditureTypesForFilter = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { data: expenditureTypes, error } = await supabase
      .from('expediture_types')
      .select('id, expediture_types as name')
      .eq('is_active', true)
      .order('id');

    if (error) {
      console.error('[ExpenditureTypes] Error fetching expenditure types for filter:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to fetch expenditure types'
      });
    }

    return res.status(200).json({
      status: 'success',
      data: expenditureTypes || [],
      count: expenditureTypes?.length || 0
    });

  } catch (error) {
    console.error('[ExpenditureTypes] Unexpected error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

export default {
  getExpenditureTypes,
  getExpenditureTypeById,
  createExpenditureType,
  updateExpenditureType,
  deleteExpenditureType,
  getExpenditureTypesForFilter
};