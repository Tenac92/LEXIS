import { Router } from 'express';
import { supabase } from '../db';
import { insertDocumentSchema } from '@shared/schema';
import type { Database } from '@shared/schema';

interface Recipient {
  lastname: string;
  firstname: string;
  fathername?: string;
  amount: number;
  installment: number;
  afm: string;
}

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { status, unit, dateFrom, dateTo, amountFrom, amountTo, user } = req.query;
    let query = supabase.from('documents').select('*');

    // Filter by user's role and ID
    if (req.user?.role !== 'admin' && req.user?.id) {
      query = query.eq('created_by', req.user.id);
    }

    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('status', status as string);
    }
    if (unit && unit !== 'all') {
      query = query.eq('unit', unit as string);
    }
    if (dateFrom) {
      query = query.gte('created_at', dateFrom as string);
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo as string);
    }
    if (amountFrom && !isNaN(Number(amountFrom))) {
      query = query.gte('total_amount', Number(amountFrom));
    }
    if (amountTo && !isNaN(Number(amountTo))) {
      query = query.lte('total_amount', Number(amountTo));
    }

    // User/Recipient filter
    if (user) {
      const searchTerm = (user as string).toLowerCase().trim();
      if (searchTerm) {
        // Use Supabase text search for recipients JSON array
        query = query.textSearch('recipients', searchTerm);
      }
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ message: 'Failed to fetch documents' });
  }
});

router.post('/', async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const validatedData = insertDocumentSchema.parse({
      ...req.body,
      created_by: req.user.id,
      created_at: new Date().toISOString()
    });

    const { data: document, error } = await supabase
      .from('documents')
      .insert([validatedData])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(document);
  } catch (error) {
    console.error('Error creating document:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({
        message: 'Validation error',
        errors: error.errors
      });
    }
    res.status(500).json({ message: 'Failed to create document' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { data: document, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', parseInt(req.params.id))
      .single();

    if (error) throw error;
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    res.json(document);
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ message: 'Failed to fetch document' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { data: document, error } = await supabase
      .from('documents')
      .update({
        ...req.body,
        updated_at: new Date().toISOString()
      })
      .eq('id', parseInt(req.params.id))
      .select()
      .single();

    if (error) throw error;
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    res.json(document);
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({ message: 'Failed to update document' });
  }
});

router.get('/generated/:id/export', async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.user?.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { data } = await supabase
      .from('documents')
      .select('*, recipients')
      .eq('id', parseInt(id))
      .single();

    if (!data) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Format recipients data
    const recipients = Array.isArray(data.recipients)
      ? data.recipients.map((recipient: Recipient) => ({
          lastname: String(recipient.lastname || ''),
          firstname: String(recipient.firstname || ''),
          fathername: String(recipient.fathername || ''),
          amount: Number(recipient.amount) || 0,
          installment: Number(recipient.installment) || 1,
          afm: String(recipient.afm || '')
        }))
      : [];

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
          DocumentFormatter.createDocumentHeader(req),
          DocumentFormatter.createHeader('ΠΙΝΑΚΑΣ ΔΙΚΑΙΟΥΧΩΝ ΣΤΕΓΑΣΤΙΚΗΣ ΣΥΝΔΡΟΜΗΣ'),
          new Paragraph({
            text: '',
            spacing: { before: 240, after: 240 }
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Μονάδα: ${data.unit || 'N/A'}`, bold: true }),
              new TextRun({ text: `    NA853: ${data.project_na853 || 'N/A'}`, bold: true })
            ],
            spacing: { before: 240, after: 240 }
          }),
          DocumentFormatter.createPaymentTable(recipients),
          new Paragraph({
            text: '',
            spacing: { before: 300 }
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'ΣΥΝΟΛΟ: ', bold: true }),
              new TextRun({ text: `${data.total_amount?.toFixed(2) || '0.00'}€` })
            ]
          }),
          DocumentFormatter.createDocumentFooter()
        ]
      }]
    });

    const buffer = await Packer.toBuffer(doc);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=document-${data.document_number || id}.docx`);
    res.send(buffer);

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      message: 'Failed to export document',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST route for custom document export
router.post('/generated/:id/export', async (req, res) => {
  try {
    const { id } = req.params;
    const { unit_details, margins } = req.body;

    if (!req.user?.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { data: document } = await supabase
      .from('documents')
      .select('*, recipients')
      .eq('id', parseInt(id))
      .single();

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Format recipients data
    const recipients = Array.isArray(document.recipients)
      ? document.recipients.map((recipient: Recipient) => ({
          lastname: String(recipient.lastname || ''),
          firstname: String(recipient.firstname || ''),
          fathername: String(recipient.fathername || ''),
          amount: Number(recipient.amount) || 0,
          installment: Number(recipient.installment) || 1,
          afm: String(recipient.afm || '')
        }))
      : [];

    // Create document using DocumentFormatter
    const doc = new Document({
      sections: [{
        properties: {
          page: {
            ...(margins || DocumentFormatter.getDefaultMargins())
          }
        },
        children: [
          DocumentFormatter.createDocumentHeader(req, unit_details),
          DocumentFormatter.createHeader('ΠΙΝΑΚΑΣ ΔΙΚΑΙΟΥΧΩΝ ΣΤΕΓΑΣΤΙΚΗΣ ΣΥΝΔΡΟΜΗΣ'),
          DocumentFormatter.createPaymentTable(recipients),
          DocumentFormatter.createDocumentFooter()
        ]
      }]
    });

    const buffer = await Packer.toBuffer(doc);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=document-${document.document_number || id}.docx`);
    res.send(buffer);

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      message: 'Failed to export document',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// New Template Management Routes
router.get('/templates', async (req, res) => {
  try {
    const templates = await TemplateManager.listTemplates(req.query.category as string);
    res.json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ message: 'Failed to fetch templates' });
  }
});

router.post('/templates', async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { name, description, category, templateData } = req.body;
    const template = await TemplateManager.createTemplate(
      name,
      description,
      category,
      templateData,
      req.user.id
    );

    res.status(201).json(template);
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ message: 'Failed to create template' });
  }
});

router.get('/templates/:id/preview', async (req, res) => {
  try {
    const { id } = req.params;
    const { previewData } = req.query;

    const buffer = await TemplateManager.generatePreview(
      parseInt(id),
      JSON.parse(previewData as string),
      { watermark: true }
    );

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=template-preview-${id}.docx`);
    res.send(buffer);
  } catch (error) {
    console.error('Error generating preview:', error);
    res.status(500).json({ message: 'Failed to generate preview' });
  }
});

// Document Version Management Routes
router.get('/versions/:documentId', async (req, res) => {
  try {
    const versions = await VersionController.getVersionHistory(parseInt(req.params.documentId));
    res.json(versions);
  } catch (error) {
    console.error('Error fetching versions:', error);
    res.status(500).json({ message: 'Failed to fetch versions' });
  }
});

router.post('/versions/:documentId', async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { documentId } = req.params;
    const { recipients, metadata } = req.body;

    const version = await VersionController.createVersion(
      parseInt(documentId),
      recipients,
      req.user.id,
      metadata
    );

    res.status(201).json(version);
  } catch (error) {
    console.error('Error creating version:', error);
    res.status(500).json({ message: 'Failed to create version' });
  }
});

router.post('/versions/:documentId/revert/:versionId', async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const version = await VersionController.revertToVersion(
      parseInt(req.params.documentId),
      parseInt(req.params.versionId),
      req.user.id
    );

    res.json(version);
  } catch (error) {
    console.error('Error reverting version:', error);
    res.status(500).json({ message: 'Failed to revert version' });
  }
});

export default router;