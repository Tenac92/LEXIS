import { Router, Request, Response, NextFunction } from "express";
import { supabase } from "../config/db";
import { z } from "zod";
import { Document, Packer } from "docx";
import { insertGeneratedDocumentSchema } from "@shared/schema";
import type { Database, User } from "@shared/schema";
import { validateBudget, updateBudget } from "./budgetController";
import { DocumentFormatter } from "../utils/DocumentFormatter";

const router = Router();

// Define interfaces
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

// Authentication middleware
const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  // For now, we'll allow all requests through since auth is handled by Supabase
  next();
};

// Document creation route
router.post('/', async (req: Request, res: Response) => {
  try {
    const { unit, project_id, expenditure_type, status, recipients, total_amount, attachments } = req.body;

    console.log('Received document creation request:', {
      unit,
      project_id,
      expenditure_type,
      recipients: recipients?.length,
      total_amount
    });

    if (!recipients?.length || !project_id || !unit || !expenditure_type) {
      return res.status(400).json({
        message: 'Missing required fields: recipients, project_id, unit, and expenditure_type are required'
      });
    }

    // Get project NA853
    const { data: projectData, error: projectError } = await supabase
      .from('project_catalog')
      .select('na853')
      .eq('mis', project_id)
      .single();

    if (projectError || !projectData) {
      console.error('Project fetch error:', projectError);
      return res.status(404).json({ message: 'Project not found' });
    }

    // Create document record
    const { data, error } = await supabase
      .from('generated_documents')
      .insert([{
        unit,
        project_id,
        project_na853: projectData.na853,
        expenditure_type,
        status: status || 'draft',
        recipients: recipients.map(r => ({
          firstname: String(r.firstname).trim(),
          lastname: String(r.lastname).trim(),
          afm: String(r.afm).trim(),
          amount: parseFloat(String(r.amount)),
          installment: parseInt(String(r.installment))
        })),
        total_amount: parseFloat(String(total_amount)) || 0,
        attachments: attachments || [],
        created_at: new Date().toISOString(),
        department: 'ΤΜΗΜΑ ΠΡΟΓΡΑΜΜΑΤΙΣΜΟΥ ΑΠΟΚΑΤΑΣΤΑΣΗΣ & ΕΚΠΑΙΔΕΥΣΗΣ (Π.Α.Ε.)',
        is_correction: false
      }])
      .select()
      .single();

    if (error) {
      console.error('Document creation error:', error);
      return res.status(500).json({
        message: 'Failed to create document',
        error: error.message
      });
    }

    console.log('Document created successfully:', data);
    return res.status(201).json(data);
  } catch (error) {
    console.error('Error creating document:', error);
    return res.status(500).json({
      message: 'Failed to create document',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// List documents with filters
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { status, unit, dateFrom, dateTo, amountFrom, amountTo, user } = req.query;

    console.log('Document List Request:', {
      userRole: req.user?.role,
      userUnit: req.user?.unit,
      requestedUnit: unit,
      filters: { status, dateFrom, dateTo, amountFrom, amountTo, user }
    });

    let query = supabase
      .from('generated_documents')
      .select('*');

    // Filter by unit based on user role
    if (req.user?.role === 'user' && req.user?.unit) {
      console.log('Applying user unit filter:', req.user.unit);
      query = query.eq('unit', req.user.unit);
    } else if (unit && unit !== 'all') {
      console.log('Applying requested unit filter:', unit);
      query = query.eq('unit', unit);
    }

    // Apply other filters
    if (status && status !== 'all') {
      query = query.eq('status', status);
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

    if (user && user !== 'all') {
      query = query.textSearch('recipients', user.toString().toLowerCase().trim());
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('Database query error:', error);
      throw error;
    }

    console.log('Documents found:', data?.length || 0);

    res.json(data || []);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ message: 'Failed to fetch documents' });
  }
});

// Get single document
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

// Update document
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

// Update the document export route
router.get('/generated/:id/export', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { format = 'docx', include_attachments = true } = req.query;

    const { data: document, error } = await supabase
      .from('generated_documents')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Document fetch error:', error);
      throw error;
    }

    if (!document) {
      return res.status(404).json({
        status: 'error',
        message: 'Document not found'
      });
    }

    // Format recipients data
    const recipients = Array.isArray(document.recipients)
      ? document.recipients.map((recipient: any) => ({
          lastname: String(recipient.lastname || '').trim(),
          firstname: String(recipient.firstname || '').trim(),
          fathername: String(recipient.fathername || '').trim(),
          amount: parseFloat(recipient.amount) || 0,
          installment: parseInt(recipient.installment) || 1,
          afm: String(recipient.afm || '').trim()
        }))
      : [];

    // Calculate total amount
    const totalAmount = recipients.reduce((sum: number, recipient: any) => sum + recipient.amount, 0);

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
          DocumentFormatter.createHeader("ΕΛΛΗΝΙΚΗ ΔΗΜΟΚΡΑΤΙΑ"),
          DocumentFormatter.createHeader("ΥΠΟΥΡΓΕΙΟ ΚΛΙΜΑΤΙΚΗΣ ΚΡΙΣΗΣ & ΠΟΛΙΤΙΚΗΣ ΠΡΟΣΤΑΣΙΑΣ"),
          DocumentFormatter.createHeader("ΓΕΝΙΚΗ ΓΡΑΜΜΑΤΕΙΑ ΑΠΟΚ/ΣΗΣ ΦΥΣΙΚΩΝ ΚΑΤΑΣΤΡΟΦΩΝ"),
          DocumentFormatter.createHeader("ΚΑΙ ΚΡΑΤΙΚΗΣ ΑΡΩΓΗΣ"),
          ...DocumentFormatter.createMetadataSection({
            protocol_number: document.protocol_number,
            protocol_date: document.protocol_date,
            document_number: document.id
          }),
          DocumentFormatter.createHeader("ΠΙΝΑΚΑΣ ΔΙΚΑΙΟΥΧΩΝ"),
          DocumentFormatter.createPaymentTable(recipients),
          DocumentFormatter.createTotalSection(totalAmount),
          ...(include_attachments ? DocumentFormatter.createAttachmentSection(document.attachments || []) : []),
          ...DocumentFormatter.createDocumentFooter({
            department: "ΤΜΗΜΑ ΠΡΟΓΡΑΜΜΑΤΙΣΜΟΥ ΑΠΟΚΑΤΑΣΤΑΣΗΣ & ΕΚΠΑΙΔΕΥΣΗΣ (Π.Α.Ε.)",
            signatory: "ΓΕΩΡΓΙΟΣ ΛΑΖΑΡΟΥ",
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
    console.error('Document generation error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate document',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;