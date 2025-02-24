import { Request, Response } from 'express';
import { Document, Packer } from 'docx';
import { supabase } from '../config/db';
import { DocumentFormatter } from '../utils/DocumentFormatter';

export async function exportDocument(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { format = 'docx', include_attachments = true } = req.body;

    const { data: document, error } = await supabase
      .from('generated_documents')
      .select('*, recipients, attachments')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Database query error:', error);
      throw error;
    }

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Create document using DocumentFormatter
    const doc = new Document({
      sections: [{
        properties: {
          page: {
            ...DocumentFormatter.getDefaultMargins(),
            size: { width: 11906, height: 16838 }
          }
        },
        children: [
          ...DocumentFormatter.createDocumentHeader(req, {
            unit_name: document.unit,
            email: document.contact_email,
            parts: document.unit_parts || []
          }),
          ...DocumentFormatter.createMetadataSection({
            protocol_number: document.protocol_number,
            protocol_date: document.protocol_date,
            document_number: document.id
          }),
          DocumentFormatter.createPaymentTable(document.recipients || []),
          DocumentFormatter.createTotalSection((document.recipients || []).reduce(
            (sum: number, recipient: any) => sum + (parseFloat(recipient.amount) || 0),
            0
          )),
          ...(include_attachments && document.attachments?.length 
            ? DocumentFormatter.createAttachmentSection(document.attachments)
            : []),
          ...DocumentFormatter.createDocumentFooter({
            signatory: document.signatory,
            department: document.department,
            contact_person: document.contact_person
          })
        ]
      }]
    });

    const buffer = await Packer.toBuffer(doc);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=document-${document.id}.docx`);
    res.send(buffer);

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ 
      message: 'Failed to export document',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}