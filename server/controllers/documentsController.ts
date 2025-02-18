import { Router } from 'express';
import { supabase } from '../config/db';
import { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, BorderStyle } from 'docx';
import type { Database } from '@shared/schema';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { status, unit, dateFrom, dateTo, amountFrom, amountTo, user } = req.query;
    let query = supabase.from('generated_documents').select('*');

    // Filter by user's role and ID - fixed the undefined user ID issue
    if (req.user?.role !== 'admin' && req.user?.id) {
      query = query.eq('generated_by', req.user.id);
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

    // User/Recipient filter with proper text search
    if (user) {
      const searchTerm = (user as string).toLowerCase().trim();
      if (searchTerm) {
        query = query.or(`recipients.cs.[{"lastname":"${searchTerm}"}],recipients.cs.[{"afm":"${searchTerm}"}]`);
      }
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('Supabase query error:', error);
      throw error;
    }
    res.json(data || []);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ message: 'Failed to fetch documents' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('generated_documents')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: 'Document not found' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ message: 'Failed to fetch document' });
  }
});

router.post('/', async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { data, error } = await supabase
      .from('generated_documents')
      .insert({
        ...req.body,
        generated_by: req.user.id,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('Error creating document:', error);
    res.status(500).json({ message: 'Failed to create document' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('generated_documents')
      .update({
        ...req.body,
        updated_by: req.user?.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: 'Document not found' });
    }

    res.json(data);
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

    // Modified query to use explicit join
    const { data, error } = await supabase
      .from('generated_documents')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Database query error:', error);
      throw error;
    }

    if (!data) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Create document sections with proper table structure
    const headerRow = new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text: 'Document Export', bold: true })],
            alignment: AlignmentType.LEFT
          })]
        })
      ]
    });

    const headerTable = new Table({
      width: {
        size: 100,
        type: 'pct',
      },
      rows: [headerRow]
    });

    // Create content table with headers
    const contentHeaderRow = new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Name', bold: true })] })]
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'AFM', bold: true })] })]
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Amount', bold: true })] })]
        })
      ]
    });

    const contentRows = (data.recipients || []).map((recipient: any) => 
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ 
              children: [new TextRun({ text: `${recipient.lastname} ${recipient.firstname}` })]
            })]
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: recipient.afm })] })]
          }),
          new TableCell({
            children: [new Paragraph({ 
              children: [new TextRun({ text: `${recipient.amount}€` })]
            })]
          })
        ]
      })
    );

    const contentTable = new Table({
      width: {
        size: 100,
        type: 'pct',
      },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1 },
        bottom: { style: BorderStyle.SINGLE, size: 1 },
        left: { style: BorderStyle.SINGLE, size: 1 },
        right: { style: BorderStyle.SINGLE, size: 1 },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
        insideVertical: { style: BorderStyle.SINGLE, size: 1 }
      },
      rows: [contentHeaderRow, ...contentRows]
    });

    // Create document
    const docx = new Document({
      sections: [{
        properties: { 
          page: { 
            margin: { 
              top: 1000, 
              bottom: 1000, 
              left: 1000, 
              right: 1000 
            } 
          } 
        },
        children: [
          headerTable,
          new Paragraph({ text: '' }), // Spacing
          contentTable,
          new Paragraph({ text: '' }), // Spacing
        ]
      }]
    });

    // Pack document
    const buffer = await Packer.toBuffer(docx);

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=document-${data.document_number || data.id}.docx`);

    // Send document
    res.send(buffer);

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ 
      message: 'Failed to export document',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/generated/:id/export', async (req, res) => {
  try {
    const { id } = req.params;
    const { format, unit_details, contact_info, margins, include_attachments, include_signatures } = req.body;

    if (!req.user?.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Fetch document data from database
    const { data: document, error } = await supabase
      .from('generated_documents')
      .select('*, recipients(*)')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Create document sections
    const headerTable = new Table({
      rows: [{
        children: [{
          children: [
            new Paragraph({
              children: [new TextRun({ text: unit_details?.unit_name || '', bold: true })],
              alignment: AlignmentType.LEFT
            })
          ]
        }]
      }]
    });

    const contentTable = new Table({
      rows: (document.recipients || []).map((recipient: any) => ({
        children: [{
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: `${recipient.lastname} ${recipient.firstname}` }),
                new TextRun({ text: ` - ${recipient.afm}` }),
                new TextRun({ text: ` - ${recipient.amount}€` })
              ]
            })
          ]
        }]
      }))
    });

    const footerTable = new Table({
      rows: [{
        children: [{
          children: [
            new Paragraph({
              children: [new TextRun({ text: contact_info?.contact_person || '' })],
              alignment: AlignmentType.CENTER
            })
          ]
        }]
      }]
    });

    // Create document
    const docx = new Document({
      sections: [{
        properties: { page: { margin: margins } },
        children: [
          headerTable,
          new Paragraph({ text: '' }), // Spacing
          contentTable,
          new Paragraph({ text: '' }), // Spacing
          footerTable
        ]
      }]
    });

    // Pack document
    const buffer = await Packer.toBuffer(docx);

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=document-${document.document_number || document.id}.docx`);

    // Send document
    res.send(buffer);

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ 
      message: 'Failed to export document',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;