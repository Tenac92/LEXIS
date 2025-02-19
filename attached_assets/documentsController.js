const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware.js');
const { supabase } = require('../config/db.js');
const AuditLogger = require('../utils/auditLogger');
const DocumentGenerator = require('./documentGenerator');
const generatedDocumentsRouter = require('./generatedDocumentsController');
const recipientsRouter = require('./recipientsController');
const attachmentsRouter = require('./attachmentsController');
const router = express.Router();

// Mount sub-routers
router.use('/generated', generatedDocumentsRouter);
router.use('/recipients', recipientsRouter);
router.use('/attachments', attachmentsRouter);

// Get pending documents
router.get('/pending', authenticateToken, async (req, res) => {
  try {
    const { units } = req.query;
    const query = supabase
      .from('generated_documents')
      .select('id, protocol_number_input, protocol_date, status, created_at, unit, total_amount, project_na853')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (units) {
      query.in('unit', units.split(','));
    }

    const { data, error } = await query.limit(5);

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ message: 'Database operation failed', error: error.message });
    }

    res.json(data || []);
  } catch (error) {
    console.error('Error fetching pending documents:', error);
    res.status(500).json({ 
      message: 'Failed to fetch pending documents',
      error: error.message 
    });
  }
});

// Add protocol endpoint
router.patch('/generated/:id/protocol', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { protocol_number, protocol_date } = req.body;

    if (!protocol_number?.trim() || !protocol_date?.trim()) {
      return res.status(400).json({ message: 'Protocol number and date are required' });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(protocol_date)) {
      return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD' });
    }

    const { data: updatedDoc, error } = await supabase
      .from('generated_documents')
      .update({
        protocol_number_input: protocol_number,
        protocol_date: protocol_date,
        status: 'completed',
        updated_by: req.user.id
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json(updatedDoc);
  } catch (error) {
    console.error('Protocol update error:', error);
    res.status(500).json({ message: 'Failed to update protocol' });
  }
});

// Get unique units
router.get('/units', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('generated_documents')
      .select('unit')
      .not('unit', 'is', null);

    if (error) throw error;

    const units = [...new Set(data.map(doc => doc.unit))].filter(Boolean);
    res.json(units);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Failed to load units' });
  }
});

router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const { documentIds } = req.body;
    if (!Array.isArray(documentIds) || !documentIds.length) {
      return res.status(400).json({ message: 'No valid documents selected' });
    }

    if (!documentIds.every(id => Number.isInteger(Number(id)))) {
      return res.status(400).json({ message: 'Invalid document ID format' });
    }

    const { data: documents, error: fetchError } = await supabase
      .from('recipients')
      .select('*')
      .in('id', documentIds);

    if (fetchError) throw fetchError;

    const docBuffer = await DocumentGenerator.generateDocument(req, documents);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename=generated-document.docx');
    return res.send(docBuffer);
  } catch (error) {
    console.error('Generate error:', error);
    return res.status(500).json({ message: error.message || 'Failed to generate document' });
  }
});

router.post('/generated/:id/orthi-epanalipsi', authenticateToken, async (req, res) => {
  console.log('Received orthi-epanalipsi request for document:', req.params.id);
  try {
    const { id } = req.params;
    const { protocol_date, comments, status } = req.body;

    if (!comments?.trim()) {
      return res.status(400).json({ message: 'Comments are required' });
    }

    const { data: originalDoc, error: fetchError } = await supabase
      .from('generated_documents')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('Database error:', fetchError);
      return res.status(500).json({ message: 'Database error occurred' });
    }

    if (!originalDoc) {
      console.error('Document not found:', id);
      return res.status(404).json({ message: 'Original document not found' });
    }

    const updateData = {
      protocol_date: null,
      original_protocol_number: originalDoc.protocol_number_input,
      original_protocol_date: originalDoc.protocol_date,
      is_correction: true,
      comments: comments,
      status: 'pending',
      updated_by: req.user.id,
      protocol_number_input: null,
      unit: req.body.unit || originalDoc.unit,
      project_na853: req.body.project_na853 || originalDoc.project_na853,
      total_amount: req.body.total_amount || originalDoc.total_amount
    };

    const { data: updatedDoc, error: updateError } = await supabase
      .from('generated_documents')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      throw new Error('Failed to update document');
    }

    const docBuffer = await DocumentGenerator.generateDocument(req, originalDoc.recipients, {
      isCorrection: true,
      correctionComments: comments,
      originalDoc: updatedDoc
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename=orthi-epanalipsi.docx');
    res.send(docBuffer);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Failed to process document correction' });
  }
});

module.exports = router;