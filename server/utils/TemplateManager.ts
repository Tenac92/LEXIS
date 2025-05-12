import { Document, Packer, Paragraph, TextRun, ISectionOptions, PageOrientation } from 'docx';
import { type DocumentTemplate } from '@shared/schema';
import { supabase } from '../config/db';

import { createLogger } from './logger';

const logger = createLogger('TemplateManager');

interface TemplateData {
  sections: Array<{
    properties: {
      page: {
        size: { width: number; height: number };
        margins: { top: number; right: number; bottom: number; left: number };
        orientation?: typeof PageOrientation[keyof typeof PageOrientation];
      };
    };
    children: any[];
  }>;
  metadata?: Record<string, any>;
}

interface PreviewOptions {
  sampleData?: boolean;
  watermark?: boolean;
}

export class TemplateManager {
  static async getTemplateForExpenditure(expenditureType: string): Promise<DocumentTemplate | null> {
    try {
      logger.debug(`[TemplateManager] Fetching template for expenditure type: ${expenditureType}`);
      
      // First try to find a specific template for this expenditure type
      let { data: specificTemplate, error: specificError } = await supabase
        .from('document_templates')
        .select('*')
        .eq('expenditure_type', expenditureType)
        .eq('is_active', true)
        .single();

      if (specificError) {
        logger.error('[TemplateManager] Error fetching specific template:', specificError);
        
        // Only throw if it's not a "not found" error
        if (specificError.code !== 'PGRST116') {
          throw new Error(`Failed to fetch specific template: ${specificError.message}`);
        }
      }

      if (specificTemplate) {
        logger.debug(`[TemplateManager] Found specific template for: ${expenditureType}`);
        return specificTemplate;
      }

      logger.debug(`[TemplateManager] No specific template found for: ${expenditureType}, fetching default template`);
      
      // If no specific template found, get the default template
      const { data: defaultTemplate, error: defaultError } = await supabase
        .from('document_templates')
        .select('*')
        .eq('is_default', true)
        .eq('is_active', true)
        .single();

      if (defaultError) {
        logger.error('[TemplateManager] Error fetching default template:', defaultError);
        throw new Error(`Failed to fetch default template: ${defaultError.message}`);
      }

      if (!defaultTemplate) {
        logger.error('[TemplateManager] No default template found');
        throw new Error('No template found: neither specific nor default template exists');
      }

      logger.debug('[TemplateManager] Using default template');
      return defaultTemplate;
    } catch (error) {
      logger.error('[TemplateManager] Error in getTemplateForExpenditure:', error);
      throw error; // Propagate the error so it can be handled by the calling function
    }
  }

  static async createTemplate(
    name: string,
    description: string,
    category: string,
    templateData: TemplateData,
    userId: string
  ): Promise<DocumentTemplate> {
    try {
      const { data, error } = await supabase
        .from('document_templates')
        .insert({
          name,
          description,
          category,
          template_data: templateData,
          created_by: userId,
          structure_version: '1.0',
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error creating template:', error);
      throw new Error('Failed to create template');
    }
  }

  static async getTemplate(id: number): Promise<DocumentTemplate> {
    const { data, error } = await supabase
      .from('document_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) throw new Error('Template not found');

    return data;
  }

  static async generatePreview(
    templateId: number,
    previewData: any,
    options: PreviewOptions = {}
  ): Promise<Buffer> {
    try {
      logger.debug(`[TemplateManager] Generating preview for template ID: ${templateId}`);
      
      const template = await this.getTemplate(templateId);
      if (!template.content) {
        throw new Error(`Template with ID ${templateId} has no content data`);
      }

      const templateData = template.content as TemplateData;

      if (!templateData.sections || !Array.isArray(templateData.sections) || templateData.sections.length === 0) {
        throw new Error(`Template ${templateId} has invalid or empty sections`);
      }

      // Transform template sections to match docx library format
      const sections = templateData.sections.map((section, index) => {
        if (!section.properties || !section.properties.page) {
          throw new Error(`Section ${index} has invalid properties`);
        }
        
        return {
          properties: {
            page: {
              ...section.properties.page,
              orientation: section.properties.page.orientation || PageOrientation.PORTRAIT
            }
          },
          children: this.processTemplateChildren(section.children, previewData)
        };
      });

      // Create document from template
      logger.debug('[TemplateManager] Creating document from template sections');
      const doc = new Document({
        sections: sections
      });

      logger.debug('[TemplateManager] Packing document to buffer');
      return await Packer.toBuffer(doc);
    } catch (error) {
      logger.error('[TemplateManager] Error generating preview:', error);
      throw new Error(`Failed to generate preview: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private static processTemplateChildren(children: any[], data: any): any[] {
    if (!children || !Array.isArray(children)) {
      logger.warn('[TemplateManager] Invalid children in template:', children);
      return [];
    }
    
    try {
      return children.map((child, index) => {
        try {
          if (typeof child === 'string') {
            return new TextRun(this.replacePlaceholders(child, data));
          }
          if (Array.isArray(child)) {
            return new Paragraph({
              children: this.processTemplateChildren(child, data)
            });
          }
          if (child && typeof child === 'object' && child.children) {
            return {
              ...child,
              children: this.processTemplateChildren(child.children, data)
            };
          }
          return child;
        } catch (error) {
          logger.error(`[TemplateManager] Error processing child at index ${index}:`, error);
          logger.error(`[TemplateManager] Problematic child:`, JSON.stringify(child));
          // Return an empty text run instead of failing the entire document generation
          return new TextRun('');
        }
      });
    } catch (error) {
      logger.error('[TemplateManager] Error in processTemplateChildren:', error);
      return [new TextRun('[Template processing error]')];
    }
  }

  private static replacePlaceholders(text: string, data: any): string {
    if (!text || typeof text !== 'string') {
      logger.warn('[TemplateManager] Invalid text for placeholder replacement:', text);
      return '';
    }
    
    try {
      return text.replace(/\${(.*?)}/g, (match, key) => {
        try {
          const value = key.split('.').reduce((obj: any, k: string) => obj?.[k], data);
          return value !== undefined && value !== null ? String(value) : match;
        } catch (error) {
          logger.warn(`[TemplateManager] Error processing placeholder ${match}:`, error);
          return match;
        }
      });
    } catch (error) {
      logger.error('[TemplateManager] Error in replacePlaceholders:', error);
      return text; // Return original text on error
    }
  }

  static async listTemplates(category?: string): Promise<DocumentTemplate[]> {
    let query = supabase
      .from('document_templates')
      .select('*')
      .eq('is_active', true);

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error) throw error;

    return data;
  }

  static async updateTemplate(
    id: number,
    updates: Partial<DocumentTemplate>,
    userId: string
  ): Promise<DocumentTemplate> {
    const { data, error } = await supabase
      .from('document_templates')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
        updated_by: userId
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('Template not found');

    return data;
  }

  static async deleteTemplate(id: number): Promise<void> {
    const { error } = await supabase
      .from('document_templates')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
  }

  static async createDefaultTemplate(userId: string): Promise<DocumentTemplate> {
    const defaultTemplate = {
      name: 'Default Document Template',
      description: 'Default template for all expenditure types except ΕΚΤΟΣ ΕΔΡΑΣ',
      category: 'default',
      template_data: {
        sections: [{
          properties: {
            page: {
              size: { width: 11906, height: 16838 },
              margins: { top: 850, right: 1000, bottom: 850, left: 1000 },
              orientation: PageOrientation.PORTRAIT
            }
          },
          children: [
            new Paragraph({
              children: [
                new TextRun('Default Template Content')
              ]
            })
          ]
        }]
      },
      is_default: true,
      structure_version: '1.0',
      is_active: true,
      created_by: userId,
      expenditure_type: null
    };

    const { data, error } = await supabase
      .from('document_templates')
      .insert(defaultTemplate)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}