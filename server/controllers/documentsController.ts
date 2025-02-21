import { Router, Request, Response } from "express";
import { supabase } from "../db";
import { z } from "zod";
import { Document, Paragraph, Packer, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle } from "docx";
import { insertGeneratedDocumentSchema } from "@shared/schema";
import type { Database, User } from "@shared/schema";
import { validateBudget, updateBudget } from "./budgetController";

// Initialize router at the top level
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

interface BudgetValidationResponse {
  canCreate: boolean;
  message?: string;
  requiresNotification?: boolean;
  notificationType?: string;
}

// Authentication middleware
const authenticateToken = (req: AuthRequest, res: Response, next: Function) => {
  if (!req.user?.id) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
};

// Enhanced document formatting utilities
class DocumentFormatter {
  static getDefaultMargins() {
    return {
      top: 1440,
      right: 1440,
      bottom: 1440,
      left: 1440
    };
  }

  static createDocumentHeader(unitDetails?: any) {
    return [
      new Paragraph({
        children: [
          new TextRun({
            text: unitDetails?.title || "ΥΠΟΥΡΓΕΙΟ ΕΘΝΙΚΗΣ ΑΜΥΝΑΣ",
            bold: true,
            size: 28
          })
        ],
        spacing: { before: 240, after: 120 },
        alignment: AlignmentType.CENTER
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: unitDetails?.subtitle || "",
            size: 24
          })
        ],
        spacing: { before: 120, after: 240 },
        alignment: AlignmentType.CENTER
      })
    ];
  }

  static createMetadataSection(data: any) {
    return [
      new Paragraph({
        children: [
          new TextRun({ text: `Αριθμός Πρωτοκόλλου: `, bold: true }),
          new TextRun({ text: data.protocol_number || "N/A" }),
        ],
        spacing: { before: 240, after: 120 }
      }),
      new Paragraph({
        children: [
          new TextRun({ text: `Ημερομηνία: `, bold: true }),
          new TextRun({ text: new Date().toLocaleDateString('el-GR') }),
        ],
        spacing: { before: 120, after: 240 }
      })
    ];
  }

  static createPaymentTable(recipients: Recipient[]) {
    const tableRows = [
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ text: "Επώνυμο", alignment: AlignmentType.CENTER })],
            width: { size: 20, type: WidthType.PERCENTAGE }
          }),
          new TableCell({
            children: [new Paragraph({ text: "Όνομα", alignment: AlignmentType.CENTER })],
            width: { size: 20, type: WidthType.PERCENTAGE }
          }),
          new TableCell({
            children: [new Paragraph({ text: "Πατρώνυμο", alignment: AlignmentType.CENTER })],
            width: { size: 20, type: WidthType.PERCENTAGE }
          }),
          new TableCell({
            children: [new Paragraph({ text: "ΑΦΜ", alignment: AlignmentType.CENTER })],
            width: { size: 20, type: WidthType.PERCENTAGE }
          }),
          new TableCell({
            children: [new Paragraph({ text: "Ποσό (€)", alignment: AlignmentType.CENTER })],
            width: { size: 20, type: WidthType.PERCENTAGE }
          })
        ]
      }),
      ...recipients.map(recipient =>
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ text: recipient.lastname })],
              width: { size: 20, type: WidthType.PERCENTAGE }
            }),
            new TableCell({
              children: [new Paragraph({ text: recipient.firstname })],
              width: { size: 20, type: WidthType.PERCENTAGE }
            }),
            new TableCell({
              children: [new Paragraph({ text: recipient.fathername })],
              width: { size: 20, type: WidthType.PERCENTAGE }
            }),
            new TableCell({
              children: [new Paragraph({ text: recipient.afm })],
              width: { size: 20, type: WidthType.PERCENTAGE }
            }),
            new TableCell({
              children: [new Paragraph({
                text: recipient.amount.toFixed(2),
                alignment: AlignmentType.RIGHT
              })],
              width: { size: 20, type: WidthType.PERCENTAGE }
            })
          ]
        })
      )
    ];

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: tableRows,
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1 },
        bottom: { style: BorderStyle.SINGLE, size: 1 },
        left: { style: BorderStyle.SINGLE, size: 1 },
        right: { style: BorderStyle.SINGLE, size: 1 },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
        insideVertical: { style: BorderStyle.SINGLE, size: 1 }
      }
    });
  }

  static createTotalSection(total: number) {
    return new Paragraph({
      children: [
        new TextRun({ text: "Σύνολο: ", bold: true }),
        new TextRun({ text: `${total.toFixed(2)}€` })
      ],
      spacing: { before: 360, after: 360 },
      alignment: AlignmentType.RIGHT
    });
  }

  static createDocumentFooter(signatory?: string) {
    return [
      new Paragraph({
        children: [
          new TextRun({
            text: "Ο ΔΙΕΥΘΥΝΤΗΣ",
            bold: true
          })
        ],
        spacing: { before: 720, after: 720 },
        alignment: AlignmentType.RIGHT
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: signatory || "",
            bold: true
          })
        ],
        spacing: { before: 360 },
        alignment: AlignmentType.RIGHT
      })
    ];
  }
}

// Document generation routes
router.get('/generated/:id/export', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

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
          amount: parseFloat(recipient.amount) || 0,
          installment: parseInt(recipient.installment) || 1,
          afm: String(recipient.afm || '').trim()
        }))
      : [];

    // Calculate total amount
    const totalAmount = recipients.reduce((sum, recipient) => sum + recipient.amount, 0);

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
          ...DocumentFormatter.createDocumentHeader(document.unit_details),
          ...DocumentFormatter.createMetadataSection(document),
          new Paragraph({
            text: 'ΠΙΝΑΚΑΣ ΔΙΚΑΙΟΥΧΩΝ',
            spacing: { before: 240, after: 240 },
            alignment: AlignmentType.CENTER
          }),
          DocumentFormatter.createPaymentTable(recipients),
          DocumentFormatter.createTotalSection(totalAmount),
          ...DocumentFormatter.createDocumentFooter(document.signatory)
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

// List documents with filters
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { status, unit, dateFrom, dateTo, amountFrom, amountTo, user } = req.query;
    let query = supabase
      .from('generated_documents')
      .select('*');

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

// Update the document creation route
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const validatedData = insertGeneratedDocumentSchema.parse({
      ...req.body,
      generated_by: req.user.id,
      created_at: new Date().toISOString()
    });

    // Create document
    const { data: document, error: documentError } = await supabase
      .from('generated_documents')
      .insert({
        unit: validatedData.unit,
        project_id: validatedData.project_id,
        expenditure_type: validatedData.expenditure_type,
        recipients: validatedData.recipients,
        total_amount: validatedData.total_amount,
        status: validatedData.status || 'draft',
        generated_by: validatedData.generated_by,
        created_at: validatedData.created_at,
        attachments: validatedData.attachments
      })
      .select()
      .single();

    if (documentError) {
      console.error('Document creation error:', documentError);
      throw documentError;
    }

    res.status(201).json(document);

  } catch (error) {
    console.error('Error creating document:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: 'Validation error',
        errors: error.errors
      });
    }
    res.status(500).json({
      message: 'Failed to create document',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;