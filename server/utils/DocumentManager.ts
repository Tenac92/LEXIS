import { supabase } from '../config/db';
import { DocumentValidator } from './DocumentValidator';
import { DocumentFormatter } from './DocumentFormatter';

import { createLogger } from './logger';

const logger = createLogger('DocumentManager');

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

export class DocumentManager {
  private cache: Map<string, any>;
  private formatter: DocumentFormatter;

  constructor() {
    this.cache = new Map();
    this.formatter = new DocumentFormatter();
  }

  async loadDocuments(filters: DocumentFilters = {}) {
    try {
      // Loading documents with the specified filters
      logger.debug('[DocumentManager] Loading documents with filters:', JSON.stringify(filters));

      // Get the supabase client from the unified data layer
      const { supabase } = await import('../data');

      // Define a maximum retry count for resilience
      const MAX_RETRIES = 3;
      let retryCount = 0;
      let result = null;
      
      // Implement retry logic for database operations
      while (retryCount < MAX_RETRIES) {
        try {
          let query = supabase.from('generated_documents')
                             .select('*')
                             .order('created_at', { ascending: false });
    
          // Apply basic filters
          if (filters.unit) {
            // Applying unit filter
            if (Array.isArray(filters.unit)) {
              // If unit is an array, use 'in' query
              query = query.in('unit', filters.unit);
            } else {
              // Otherwise use exact match
              query = query.eq('unit', filters.unit);
            }
          }
    
          if (filters.status) {
            // Applying status filter with special handling for corrections
            if (filters.status === 'orthi_epanalipsi') {
              query = query.eq('is_correction', true);
            } else {
              query = query.eq('status', filters.status);
            }
          }
    
          // Apply date range filters
          if (filters.dateFrom) {
            // Applying date from filter for created_at
            query = query.gte('created_at', filters.dateFrom);
          }
          if (filters.dateTo) {
            // Applying date to filter for created_at
            query = query.lte('created_at', filters.dateTo);
          }
    
          // Apply amount range filters
          if (filters.amountFrom !== undefined) {
            // Applying amount from filter for total_amount
            query = query.gte('total_amount', filters.amountFrom);
          }
          if (filters.amountTo !== undefined) {
            // Applying amount to filter for total_amount
            query = query.lte('total_amount', filters.amountTo);
          }
    
          // Use a timeout for the query
          const QUERY_TIMEOUT = 5000; // 5 seconds
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Query timeout')), QUERY_TIMEOUT);
          });
          
          // Race the query against a timeout
          result = await Promise.race([
            query,
            timeoutPromise
          ]) as any;
          
          // If we reach here without error, break the retry loop
          break;
        } catch (retryError) {
          retryCount++;
          logger.warn(`[DocumentManager] Query attempt ${retryCount} failed:`, retryError);
          
          if (retryCount >= MAX_RETRIES) {
            // If we've exhausted all retries, throw the error
            throw retryError;
          }
          
          // Add exponential backoff between retries
          const backoffTime = Math.pow(2, retryCount) * 100; // 200ms, 400ms, 800ms
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        }
      }

      // Check for errors in the result
      const { data, error } = result || { data: [], error: null };

      if (error) {
        logger.error('[DocumentManager] Error loading documents:', error);
        
        // Handle specific database error codes
        if (error.code === '57P01') { // terminating connection due to administrator command
          logger.warn('[DocumentManager] Database connection terminated by administrator, returning empty results');
          return [];
        }
        
        // For connection errors, return empty results instead of failing
        if (error.code === '08006' || error.code === '08001' || error.code === '08004') {
          logger.warn('[DocumentManager] Database connection error, returning empty results');
          return [];
        }
        
        throw error;
      }

      // Apply recipient and AFM filters client-side since they're in JSON
      let filteredData = data || [];

      if (filters.recipient || filters.afm) {
        filteredData = filteredData.filter((doc: any) => {
          // Add null checks for recipients to prevent errors
          if (!doc.recipients || !Array.isArray(doc.recipients)) {
            return false;
          }
          
          return doc.recipients.some((r: any) => {
            const matchesRecipient = !filters.recipient || 
              r.firstname?.toLowerCase().includes(filters.recipient.toLowerCase()) ||
              r.lastname?.toLowerCase().includes(filters.recipient.toLowerCase());

            const matchesAFM = !filters.afm || r.afm?.includes(filters.afm);

            return matchesRecipient && matchesAFM;
          });
        });
      }

      // Documents loaded successfully with filtering applied
      logger.debug(`[DocumentManager] Successfully loaded ${filteredData.length} documents`);
      return filteredData;
    } catch (error) {
      logger.error('[DocumentManager] Load documents error:', error);
      // Return empty data instead of failing the request
      logger.warn('[DocumentManager] Returning empty results due to error');
      return [];
    }
  }

  async loadRecipients(documentId: string) {
    try {
      // Get the supabase client from the unified data layer
      const { supabase } = await import('../data');
      
      const { data, error } = await supabase
        .from('recipients')
        .select('*')
        .eq('document_id', documentId);

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('[DocumentManager] Load recipients error:', error);
      throw error;
    }
  }

  async createDocument(documentData: any) {
    try {
      // Document creation initiated with validated data
      logger.debug('[DocumentManager] Creating document with data:', JSON.stringify(documentData));
      
      // Get the supabase client from the unified data layer
      const { supabase } = await import('../data');
      
      // Validate recipients array
      if (documentData.recipients && Array.isArray(documentData.recipients)) {
        for (const recipient of documentData.recipients) {
          if (!recipient.afm || !recipient.firstname || !recipient.lastname || 
              typeof recipient.amount !== 'number' || typeof recipient.installment !== 'number') {
            logger.error('[DocumentManager] Invalid recipient data:', recipient);
            throw new Error('Invalid recipient data. Please check all required fields are provided.');
          }
        }
      }

      const { data, error } = await supabase
        .from('generated_documents')
        .insert([documentData])
        .select()
        .single();
      
      if (error) {
        logger.error('[DocumentManager] Supabase insert error:', error);
        throw error;
      }

      logger.debug('[DocumentManager] Document created successfully, ID:', data?.id);
      return data;
    } catch (error) {
      logger.error('[DocumentManager] Create document error:', error);
      throw error;
    }
  }

  async updateDocument(documentId: string, updates: any) {
    try {
      const { data, error } = await supabase
        .from('generated_documents')
        .update(updates)
        .eq('id', documentId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Update document error:', error);
      throw error;
    }
  }

  async addAttachments(documentId: string, attachments: Array<{path: string; type: string}>) {
    try {
      const { data, error } = await supabase
        .from('attachments')
        .insert(attachments.map(att => ({
          document_id: documentId,
          file_path: att.path,
          type: att.type
        })));

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Add attachments error:', error);
      throw error;
    }
  }

  async validateDocument(documentData: any) {
    const requiredFields = ['unit', 'mis', 'expenditure_type'];
    const missingFields = requiredFields.filter(field => !documentData[field]);
    
    if (missingFields.length) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    if (!documentData.recipients?.length) {
      throw new Error('At least one recipient is required');
    }

    return true;
  }

  clearCache() {
    this.cache.clear();
  }

  async generateOrthiEpanalipsi(documentId: number, documentData: any) {
    try {
      // Starting orthi epanalipsi (correction document) update procedure

      // Get the current document
      const { data: existingDoc, error: fetchError } = await supabase
        .from('generated_documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (fetchError || !existingDoc) {
        logger.error('[DocumentManager] Error fetching document:', fetchError);
        throw new Error('Failed to fetch document');
      }

      // Store original protocol details and update document
      const documentToUpdate = {
        ...documentData,
        original_protocol_number: existingDoc.protocol_number_input,
        original_protocol_date: existingDoc.protocol_date,
        protocol_number_input: null,
        protocol_date: null,
        status: 'orthi_epanalipsi', // Set status to orthi_epanalipsi
        is_correction: true,
        comments: documentData.correctionReason,
        // Ensure these fields are numbers/strings
        mis: String(documentData.project_id || documentData.mis),
        total_amount: parseFloat(String(documentData.total_amount || 0)),
        recipients: documentData.recipients.map((r: any) => ({
          ...r,
          amount: parseFloat(String(r.amount)),
          installment: parseInt(String(r.installment))
        }))
      };

      // Remove correctionReason as it's stored in comments
      delete documentToUpdate.correctionReason;

      // Updating document with correction data

      // Update the document
      const { data: updatedDoc, error: updateError } = await supabase
        .from('generated_documents')
        .update(documentToUpdate)
        .eq('id', documentId)
        .select()
        .single();

      if (updateError) {
        logger.error('[DocumentManager] Error updating document:', updateError);
        throw new Error(`Failed to update document: ${updateError.message}`);
      }

      try {
        // Format document using DocumentFormatter
        const docxBuffer = await this.formatter.formatOrthiEpanalipsi({
          ...documentToUpdate,
          id: documentId,
          originalDocument: existingDoc
        });

        // Document formatting completed successfully
        return { document: updatedDoc, buffer: docxBuffer };
      } catch (formatError: any) {
        logger.error('[DocumentManager] Error formatting document:', formatError);
        const errorMessage = formatError?.message || 'Unknown formatting error';
        throw new Error(`Failed to format document: ${errorMessage}`);
      }
    } catch (error) {
      logger.error('[DocumentManager] Generate orthi epanalipsi error:', error);
      throw error;
    }
  }

  async fetchDocumentFields(documentId: string) {
    try {
      // Ensure documentId is a valid number before querying
      const numericId = parseInt(documentId);
      if (isNaN(numericId)) {
        throw new Error(`Invalid document ID: ${documentId}`);
      }
      
      const { data, error } = await supabase
        .from('generated_documents')
        .select(`
          *,
          recipients,
          project:mis (
            na853,
            title
          )
        `)
        .eq('id', numericId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Fetch document fields error:', error);
      throw error;
    }
  }
}