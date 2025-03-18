import { supabase } from '../config/db';
import { DocumentValidator } from './DocumentValidator';
import { DocumentFormatter } from './DocumentFormatter';

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
      console.log('[DocumentManager] Loading documents with filters:', filters);

      let query = supabase.from('generated_documents')
                         .select('*')
                         .order('created_at', { ascending: false });

      // Apply basic filters
      if (filters.unit) {
        console.log('[DocumentManager] Applying unit filter:', filters.unit);
        query = query.eq('unit', filters.unit);
      }

      if (filters.status) {
        console.log('[DocumentManager] Applying status filter:', filters.status);
        if (filters.status === 'orthi_epanalipsi') {
          query = query.eq('is_correction', true);
        } else {
          query = query.eq('status', filters.status);
        }
      }

      // Apply date range filters
      if (filters.dateFrom) {
        console.log('[DocumentManager] Applying date from filter:', filters.dateFrom);
        query = query.gte('created_at', filters.dateFrom);
      }
      if (filters.dateTo) {
        console.log('[DocumentManager] Applying date to filter:', filters.dateTo);
        query = query.lte('created_at', filters.dateTo);
      }

      // Apply amount range filters
      if (filters.amountFrom !== undefined) {
        console.log('[DocumentManager] Applying amount from filter:', filters.amountFrom);
        query = query.gte('total_amount', filters.amountFrom);
      }
      if (filters.amountTo !== undefined) {
        console.log('[DocumentManager] Applying amount to filter:', filters.amountTo);
        query = query.lte('total_amount', filters.amountTo);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[DocumentManager] Error loading documents:', error);
        throw error;
      }

      // Apply recipient and AFM filters client-side since they're in JSON
      let filteredData = data || [];

      if (filters.recipient || filters.afm) {
        filteredData = filteredData.filter(doc => {
          return doc.recipients?.some((r: any) => {
            const matchesRecipient = !filters.recipient || 
              r.firstname?.toLowerCase().includes(filters.recipient.toLowerCase()) ||
              r.lastname?.toLowerCase().includes(filters.recipient.toLowerCase());

            const matchesAFM = !filters.afm || r.afm?.includes(filters.afm);

            return matchesRecipient && matchesAFM;
          });
        });
      }

      console.log('[DocumentManager] Documents loaded successfully:', {
        totalCount: filteredData.length,
        sample: filteredData[0] ? { id: filteredData[0].id, unit: filteredData[0].unit } : null
      });

      return filteredData;
    } catch (error) {
      console.error('[DocumentManager] Load documents error:', error);
      throw error;
    }
  }

  async loadRecipients(documentId: string) {
    try {
      const { data, error } = await supabase
        .from('recipients')
        .select('*')
        .eq('document_id', documentId);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Load recipients error:', error);
      throw error;
    }
  }

  async createDocument(documentData: any) {
    try {
      console.log('Creating document with data:', JSON.stringify(documentData, null, 2));
      
      // Validate recipients array
      if (documentData.recipients && Array.isArray(documentData.recipients)) {
        for (const recipient of documentData.recipients) {
          if (!recipient.afm || !recipient.firstname || !recipient.lastname || 
              typeof recipient.amount !== 'number' || typeof recipient.installment !== 'number') {
            console.error('Invalid recipient data:', recipient);
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
        console.error('Supabase insert error:', error);
        throw error;
      }

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Create document error:', error);
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
      console.error('Update document error:', error);
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
      console.error('Add attachments error:', error);
      throw error;
    }
  }

  async validateDocument(documentData: any) {
    const requiredFields = ['unit', 'project_id', 'expenditure_type'];
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
      console.log('[DocumentManager] Starting orthi epanalipsi update for document:', documentId);
      console.log('[DocumentManager] Update data:', JSON.stringify(documentData, null, 2));

      // Get the current document
      const { data: existingDoc, error: fetchError } = await supabase
        .from('generated_documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (fetchError || !existingDoc) {
        console.error('[DocumentManager] Error fetching document:', fetchError);
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
        project_id: String(documentData.project_id),
        total_amount: parseFloat(String(documentData.total_amount || 0)),
        recipients: documentData.recipients.map((r: any) => ({
          ...r,
          amount: parseFloat(String(r.amount)),
          installment: parseInt(String(r.installment))
        }))
      };

      // Remove correctionReason as it's stored in comments
      delete documentToUpdate.correctionReason;

      console.log('[DocumentManager] Updating document with:', 
        JSON.stringify(documentToUpdate, null, 2)
      );

      // Update the document
      const { data: updatedDoc, error: updateError } = await supabase
        .from('generated_documents')
        .update(documentToUpdate)
        .eq('id', documentId)
        .select()
        .single();

      if (updateError) {
        console.error('[DocumentManager] Error updating document:', updateError);
        throw new Error(`Failed to update document: ${updateError.message}`);
      }

      try {
        // Format document using DocumentFormatter
        const docxBuffer = await this.formatter.formatOrthiEpanalipsi({
          ...documentToUpdate,
          id: documentId,
          originalDocument: existingDoc
        });

        console.log('[DocumentManager] Document formatted successfully');
        return { document: updatedDoc, buffer: docxBuffer };
      } catch (formatError) {
        console.error('[DocumentManager] Error formatting document:', formatError);
        throw new Error(`Failed to format document: ${formatError.message}`);
      }
    } catch (error) {
      console.error('[DocumentManager] Generate orthi epanalipsi error:', error);
      throw error;
    }
  }

  async fetchDocumentFields(documentId: string) {
    try {
      const { data, error } = await supabase
        .from('generated_documents')
        .select(`
          *,
          recipients,
          project:project_id (
            na853,
            title
          )
        `)
        .eq('id', documentId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Fetch document fields error:', error);
      throw error;
    }
  }
}