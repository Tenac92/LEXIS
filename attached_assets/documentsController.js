const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/authMiddleware.js');
const { supabase } = require('../config/db.js');
const { ApiError } = require('../utils/apiErrorHandler.js');
const DocumentGenerator = require('../documents/DocumentManager.js');
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Get all documents with filters
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  const { unit, status, startDate, endDate } = req.query;

  let query = supabase.from('documents').select('*');

  if (unit) query = query.eq('unit', unit);
  if (status) query = query.eq('status', status);
  if (startDate) query = query.gte('created_at', startDate);
  if (endDate) query = query.lte('created_at', endDate);

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw new ApiError(500, "Failed to fetch documents");
  res.json(data || []);
}));

// Get single document
router.get('/:id', authenticateToken, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error) throw new ApiError(500, "Failed to fetch document");
  if (!data) throw new ApiError(404, "Document not found");

  res.json(data);
}));

// Create document
router.post('/', authenticateToken, asyncHandler(async (req, res) => {
  const { title, content, unit, recipients } = req.body;

  if (!title || !content || !unit || !recipients) {
    throw new ApiError(400, "Missing required fields");
  }

  const { data, error } = await supabase
    .from('documents')
    .insert({
      title,
      content,
      unit,
      recipients,
      status: 'pending',
      created_by: req.user.userId
    })
    .select()
    .single();

  if (error) throw new ApiError(500, "Failed to create document");

  res.status(201).json(data);
}));

// Update document
router.patch('/:id', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const { data, error } = await supabase
    .from('documents')
    .update({
      ...updates,
      updated_by: req.user.userId,
      updated_at: new Date()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new ApiError(500, "Failed to update document");
  if (!data) throw new ApiError(404, "Document not found");

  res.json(data);
}));

// Delete document
router.delete('/:id', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', req.params.id);

  if (error) throw new ApiError(500, "Failed to delete document");

  res.status(204).send();
}));

// Generate document
router.post('/generate', authenticateToken, asyncHandler(async (req, res) => {
  const { recipientIds, template, data } = req.body;

  if (!recipientIds?.length || !template) {
    throw new ApiError(400, "Missing required fields");
  }

  const document = await DocumentGenerator.generate(template, data, recipientIds);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', 'attachment; filename=generated-document.docx');
  res.send(document);
}));

// Get unique units
router.get('/units', authenticateToken, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('generated_documents')
    .select('unit')
    .not('unit', 'is', null);

  if (error) throw new ApiError(500, "Failed to load units");

  const units = [...new Set(data.map(doc => doc.unit))].filter(Boolean);
  res.json(units);
}));

// Add protocol
router.patch('/generated/:id/protocol', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { protocol_number, protocol_date } = req.body;

  if (!protocol_number?.trim() || !protocol_date?.trim()) {
    throw new ApiError(400, 'Protocol number and date are required');
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(protocol_date)) {
    throw new ApiError(400, 'Invalid date format. Use YYYY-MM-DD');
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

  if (error) throw new ApiError(500, "Failed to update protocol");

  res.json(updatedDoc);
}));

// Orthi epanalipsi
router.post('/generated/:id/orthi-epanalipsi', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { protocol_date, comments, status, unit, project_na853, total_amount } = req.body;

  if (!comments?.trim()) {
    throw new ApiError(400, 'Comments are required');
  }

  const { data: originalDoc, error: fetchError } = await supabase
    .from('generated_documents')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError) throw new ApiError(500, 'Database error occurred');
  if (!originalDoc) throw new ApiError(404, 'Original document not found');

  const updateData = {
    protocol_date: null,
    original_protocol_number: originalDoc.protocol_number_input,
    original_protocol_date: originalDoc.protocol_date,
    is_correction: true,
    comments: comments,
    status: 'pending',
    updated_by: req.user.id,
    protocol_number_input: null,
    unit: unit || originalDoc.unit,
    project_na853: project_na853 || originalDoc.project_na853,
    total_amount: total_amount || originalDoc.total_amount
  };

  const { data: updatedDoc, error: updateError } = await supabase
    .from('generated_documents')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (updateError) throw new ApiError(500, 'Failed to update document');

  const docBuffer = await DocumentGenerator.generateDocument(req, originalDoc.recipients, {
    isCorrection: true,
    correctionComments: comments,
    originalDoc: updatedDoc
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', 'attachment; filename=orthi-epanalipsi.docx');
  res.send(docBuffer);
}));

module.exports = router;