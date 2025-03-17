import { supabase } from '../config/db';
import { DocumentValidator } from './DocumentValidator';
import { DocumentFormatter } from './DocumentFormatter';

interface DocumentFilters {
  unit?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
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
      let query = supabase.from('generated_documents')
                         .select('*');

      if (filters.unit) query = query.eq('unit', filters.unit);
      if (filters.status) query = query.eq('status', filters.status);
      if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
      if (filters.dateTo) query = query.lte('created_at', filters.dateTo);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Load documents error:', error);
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

  async generateOrthiEpanalipsi(documentData: any) {
    try {
      console.log('Generating orthi epanalipsi document with data:', JSON.stringify(documentData, null, 2));

      // Validate document data
      await this.validateDocument(documentData);

      // Get the original document to reference
      const { data: originalDoc, error: fetchError } = await supabase
        .from('generated_documents')
        .select('*')
        .eq('id', documentData.original_document_id)
        .single();

      if (fetchError) {
        console.error('Error fetching original document:', fetchError);
        throw new Error('Failed to fetch original document');
      }

      // Store original protocol details and clear current ones
      const documentToCreate = {
        ...documentData,
        original_protocol_number: originalDoc.protocol_number_input,
        original_protocol_date: originalDoc.protocol_date,
        protocol_number_input: null,
        protocol_date: null,
        status: 'draft',
        is_correction: true
      };

      // Create the new document
      const { data: newDoc, error: createError } = await supabase
        .from('generated_documents')
        .insert([documentToCreate])
        .select()
        .single();

      if (createError) {
        console.error('Error creating orthi epanalipsi document:', createError);
        throw new Error('Failed to create orthi epanalipsi document');
      }

      // Format document using DocumentFormatter
      const docxBuffer = await this.formatter.formatOrthiEpanalipsi({
        ...documentToCreate,
        originalDocument: originalDoc
      });

      return { document: newDoc, buffer: docxBuffer };
    } catch (error) {
      console.error('Generate orthi epanalipsi error:', error);
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