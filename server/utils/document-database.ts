/**
 * Document Database Operations - Handles all document-related database queries
 * 
 * This module is responsible for:
 * - Loading and filtering documents from the database
 * - Managing document metadata and status
 * - Handling document relationships and associations
 */

import { supabase } from '../config/db';
import { createLogger } from './logger';

const logger = createLogger('DocumentDatabase');

interface DocumentFilters {
  unit?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  amountFrom?: number;
  amountTo?: number;
  recipient?: string;
  afm?: string;
}

export class DocumentDatabase {
  private cache: Map<string, any>;

  constructor() {
    this.cache = new Map();
  }

  /**
   * Load documents with specified filters
   */
  async loadDocuments(filters: DocumentFilters = {}) {
    try {
      logger.debug('Loading documents with filters:', JSON.stringify(filters));

      const { supabase } = await import('../data');
      const MAX_RETRIES = 3;
      let retryCount = 0;
      let result = null;
      
      while (retryCount < MAX_RETRIES) {
        try {
          let query = supabase.from('generated_documents')
                             .select('*')
                             .order('created_at', { ascending: false });
    
          // Apply unit filter
          if (filters.unit) {
            if (Array.isArray(filters.unit)) {
              query = query.in('unit', filters.unit);
            } else {
              query = query.eq('unit', filters.unit);
            }
          }

          // Apply status filter
          if (filters.status) {
            query = query.eq('status', filters.status);
          }

          // Apply date range filters
          if (filters.dateFrom) {
            query = query.gte('created_at', filters.dateFrom);
          }
          if (filters.dateTo) {
            query = query.lte('created_at', filters.dateTo);
          }

          // Apply amount range filters
          if (filters.amountFrom !== undefined) {
            query = query.gte('total_amount', filters.amountFrom);
          }
          if (filters.amountTo !== undefined) {
            query = query.lte('total_amount', filters.amountTo);
          }

          result = await query;
          break;
        } catch (retryError: any) {
          retryCount++;
          logger.warn(`Database query attempt ${retryCount} failed:`, retryError.message);
          
          if (retryCount >= MAX_RETRIES) {
            throw retryError;
          }
          
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
        }
      }

      if (result?.error) {
        logger.error('Database query failed:', result.error);
        throw new Error(`Database error: ${result.error.message}`);
      }

      if (!result?.data) {
        logger.warn('No data returned from query');
        return [];
      }

      logger.debug(`Successfully loaded ${result.data.length} documents`);
      return result.data;

    } catch (error: any) {
      logger.error('Failed to load documents:', error);
      throw new Error(`Failed to load documents: ${error.message}`);
    }
  }

  /**
   * Get a single document by ID
   */
  async getDocumentById(id: number) {
    try {
      logger.debug(`Loading document with ID: ${id}`);

      const { supabase } = await import('../data');
      const { data, error } = await supabase
        .from('generated_documents')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        logger.error('Failed to load document:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      return data;
    } catch (error: any) {
      logger.error(`Failed to load document ${id}:`, error);
      throw error;
    }
  }

  /**
   * Update document status
   */
  async updateDocumentStatus(id: number, status: string) {
    try {
      logger.debug(`Updating document ${id} status to: ${status}`);

      const { supabase } = await import('../data');
      const { data, error } = await supabase
        .from('generated_documents')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        logger.error('Failed to update document status:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      logger.debug(`Successfully updated document ${id} status`);
      return data;
    } catch (error: any) {
      logger.error(`Failed to update document ${id} status:`, error);
      throw error;
    }
  }

  /**
   * Delete a document by ID
   */
  async deleteDocument(id: number) {
    try {
      logger.debug(`Deleting document with ID: ${id}`);

      const { supabase } = await import('../data');
      const { error } = await supabase
        .from('generated_documents')
        .delete()
        .eq('id', id);

      if (error) {
        logger.error('Failed to delete document:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      logger.debug(`Successfully deleted document ${id}`);
    } catch (error: any) {
      logger.error(`Failed to delete document ${id}:`, error);
      throw error;
    }
  }

  /**
   * Search documents by recipient name or AFM
   */
  async searchDocuments(searchTerm: string) {
    try {
      logger.debug(`Searching documents for term: ${searchTerm}`);

      const { supabase } = await import('../data');
      
      // Search in recipients field (JSON column) for name or AFM
      const { data, error } = await supabase
        .from('generated_documents')
        .select('*')
        .or(`recipients.cs.{"firstname":"${searchTerm}"},recipients.cs.{"lastname":"${searchTerm}"},recipients.cs.{"afm":"${searchTerm}"}`)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to search documents:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      logger.debug(`Found ${data?.length || 0} documents matching search`);
      return data || [];
    } catch (error: any) {
      logger.error(`Failed to search documents:`, error);
      throw error;
    }
  }

  /**
   * Get document statistics for a unit
   */
  async getDocumentStats(unit?: string) {
    try {
      logger.debug(`Getting document statistics for unit: ${unit || 'all'}`);

      const { supabase } = await import('../data');
      let query = supabase.from('generated_documents').select('status, total_amount');

      if (unit) {
        query = query.eq('unit', unit);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Failed to get document stats:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      // Calculate statistics
      const stats = {
        total: data?.length || 0,
        pending: data?.filter(d => d.status === 'pending').length || 0,
        approved: data?.filter(d => d.status === 'approved').length || 0,
        rejected: data?.filter(d => d.status === 'rejected').length || 0,
        totalAmount: data?.reduce((sum, d) => sum + (parseFloat(d.total_amount) || 0), 0) || 0
      };

      logger.debug('Document statistics calculated:', stats);
      return stats;
    } catch (error: any) {
      logger.error('Failed to get document stats:', error);
      throw error;
    }
  }

  /**
   * Clear the internal cache
   */
  clearCache() {
    this.cache.clear();
    logger.debug('Document cache cleared');
  }
}