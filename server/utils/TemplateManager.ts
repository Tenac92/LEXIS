import { Document, Packer, IPropertiesOptions } from 'docx';
import { DocumentTemplate } from '@shared/schema';
import { supabase } from '../config/db';

interface TemplateData {
  sections: Array<{
    properties: IPropertiesOptions;
    children: any[];
  }>;
  metadata?: Record<string, any>;
}

interface PreviewOptions {
  sampleData?: boolean;
  watermark?: boolean;
}

export class TemplateManager {
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
      console.error('Error creating template:', error);
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
      const template = await this.getTemplate(templateId);
      const templateData = template.template_data as TemplateData;

      // Apply preview modifications if needed
      if (options.watermark) {
        // Add watermark to the template
        templateData.sections = templateData.sections.map(section => ({
          ...section,
          properties: {
            ...section.properties,
            watermark: {
              text: 'PREVIEW',
              color: '808080',
              opacity: 0.3
            }
          }
        }));
      }

      // Create document from template
      const doc = new Document({
        sections: templateData.sections.map(section => ({
          ...section,
          children: this.processTemplateChildren(section.children, previewData)
        }))
      });

      return await Packer.toBuffer(doc);
    } catch (error) {
      console.error('Error generating preview:', error);
      throw new Error('Failed to generate preview');
    }
  }

  private static processTemplateChildren(children: any[], data: any): any[] {
    // Process template placeholders with actual data
    return children.map(child => {
      if (typeof child === 'string') {
        return this.replacePlaceholders(child, data);
      }
      if (Array.isArray(child)) {
        return this.processTemplateChildren(child, data);
      }
      if (child.children) {
        return {
          ...child,
          children: this.processTemplateChildren(child.children, data)
        };
      }
      return child;
    });
  }

  private static replacePlaceholders(text: string, data: any): string {
    return text.replace(/\${(.*?)}/g, (match, key) => {
      const value = key.split('.').reduce((obj: any, k: string) => obj?.[k], data);
      return value?.toString() || match;
    });
  }

  static async listTemplates(category?: string) {
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
}
