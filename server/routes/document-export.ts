import { Request, Response } from 'express';
import { Document, Packer } from 'docx';
import { supabase } from '../config/db';
import { DocumentFormatter } from '../utils/DocumentFormatter';
import { TemplateManager } from '../utils/TemplateManager';
import { VersionController } from '../utils/VersionController';

export async function exportDocument(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { data: document, error } = await supabase
      .from('generated_documents')
      .select('*, template_id, expenditure_type')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Database query error:', error);
      throw error;
    }

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Create a new version if it's modified
    if (req.user?.id && document.recipients) {
      await VersionController.createVersion(
        document.id,
        document.recipients,
        req.user.id,
        { reason: 'Document export' }
      );
    }

    let template = null;
    if (document.template_id) {
      // Use specifically assigned template if it exists
      template = await TemplateManager.getTemplate(document.template_id);
    } else {
      // Get template based on expenditure type
      template = await TemplateManager.getTemplateForExpenditure(document.expenditure_type);
    }

    if (template) {
      // Use template if available
      const buffer = await TemplateManager.generatePreview(
        template.id,
        { recipients: document.recipients }
      );
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename=document-${document.id}.docx`);
      return res.send(buffer);
    } else {
      // Fallback to default formatting
      const recipients = Array.isArray(document.recipients) 
        ? document.recipients.map(recipient => ({
            firstname: recipient.firstname || '',
            lastname: recipient.lastname || '',
            afm: recipient.afm || '',
            amount: Number(recipient.amount) || 0,
            installment: Number(recipient.installment) || 1
          }))
        : [];

      const doc = new Document({
        sections: [{
          properties: { 
            page: { 
              ...DocumentFormatter.getDefaultMargins(),
              size: { width: 11906, height: 16838 }
            }
          },
          children: [
            DocumentFormatter.createDocumentHeader(),
            DocumentFormatter.createHeader('ΠΙΝΑΚΑΣ ΔΙΚΑΙΟΥΧΩΝ ΣΤΕΓΑΣΤΙΚΗΣ ΣΥΝΔΡΟΜΗΣ'),
            DocumentFormatter.createPaymentTable(recipients),
            DocumentFormatter.createDocumentFooter()
          ]
        }]
      });

      const buffer = await Packer.toBuffer(doc);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename=document-${document.id}.docx`);
      res.send(buffer);
    }
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ 
      message: 'Failed to export document',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}