import { Router, Request, Response } from "express";
import { supabase } from "../db";
import { z } from "zod";
import { Document, Paragraph, Packer, TextRun } from "docx";
import { insertGeneratedDocumentSchema } from "@shared/schema";
import type { Database } from "@shared/schema";
import type { User } from "@shared/schema";
import { validateBudget, updateBudget } from "./budgetController";

interface Recipient {
  lastname: string;
  firstname: string;
  fathername: string;
  amount: number;
  installment: number;
  afm: string;
}

interface AuthRequest extends Request {
  user?: User;
}

// Document formatting utilities
class DocumentFormatter {
  static getDefaultMargins() {
    return {
      top: 1440,
      right: 1440,
      bottom: 1440,
      left: 1440
    };
  }

  static createDocumentHeader(req: Request, unitDetails?: any) {
    return new Paragraph({
      children: [
        new TextRun({
          text: unitDetails?.title || "ΥΠΟΥΡΓΕΙΟ ΕΘΝΙΚΗΣ ΑΜΥΝΑΣ",
          bold: true
        })
      ],
      spacing: { before: 240, after: 240 },
      alignment: "center"
    });
  }

  static createHeader(text: string) {
    return new Paragraph({
      children: [new TextRun({ text, bold: true })],
      spacing: { before: 240, after: 240 },
      alignment: "center"
    });
  }

  static createPaymentTable(recipients: Recipient[]) {
    return new Paragraph({
      children: recipients.map(recipient =>
        new TextRun({
          text: `${recipient.lastname} ${recipient.firstname} ${recipient.amount}€\n`,
          size: 24
        })
      ),
      spacing: { before: 240, after: 240 }
    });
  }

  static createDocumentFooter() {
    return new Paragraph({
      children: [
        new TextRun({
          text: "Ο ΔΙΕΥΘΥΝΤΗΣ",
          bold: true
        })
      ],
      spacing: { before: 720 },
      alignment: "right"
    });
  }
}

const router = Router();

// Authentication middleware
const authenticateToken = (req: AuthRequest, res: Response, next: Function) => {
  if (!req.user?.id) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
};

// List documents with filters
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { status, unit, dateFrom, dateTo, amountFrom, amountTo, user } = req.query;
    let query = supabase
      .from('generated_documents')
      .select('*');

    // Filter by user's role and ID
    if (req.user?.role !== 'admin' && req.user?.id) {
      query = query.eq('generated_by', req.user.id);
    }

    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (unit && unit !== 'all') {
      query = query.eq('unit', unit);
    }
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }
    if (amountFrom && !isNaN(Number(amountFrom))) {
      query = query.gte('total_amount', Number(amountFrom));
    }
    if (amountTo && !isNaN(Number(amountTo))) {
      query = query.lte('total_amount', Number(amountTo));
    }

    // User/Recipient filter
    if (user) {
      const searchTerm = user.toString().toLowerCase().trim();
      if (searchTerm) {
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

router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { data: document, error } = await supabase
      .from('generated_documents')
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

router.patch('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { data: document, error } = await supabase
      .from('generated_documents')
      .update({
        ...req.body,
        updated_at: new Date()
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

// Document generation routes
router.get('/generated/:id/export', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

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

    // Create document
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
          DocumentFormatter.createPaymentTable(recipients),
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

router.post('/generated/:id/export', async (req: Request, res) => {
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


router.get('/templates', async (req:Request, res) => {
  try {
    const templates = await TemplateManager.listTemplates(req.query.category as string);
    res.json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ message: 'Failed to fetch templates' });
  }
});

router.post('/templates', async (req:Request, res) => {
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

router.get('/templates/:id/preview', async (req:Request, res) => {
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

router.get('/versions/:documentId', async (req:Request, res) => {
  try {
    const versions = await VersionController.getVersionHistory(parseInt(req.params.documentId));
    res.json(versions);
  } catch (error) {
    console.error('Error fetching versions:', error);
    res.status(500).json({ message: 'Failed to fetch versions' });
  }
});

router.post('/versions/:documentId', async (req:Request, res) => {
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

router.post('/versions/:documentId/revert/:versionId', async (req:Request, res) => {
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