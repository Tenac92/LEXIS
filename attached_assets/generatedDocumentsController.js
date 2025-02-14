const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware.js');
const { supabase } = require('../config/db.js');
const DocumentGenerator = require('./documentGenerator');
const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, unit, dateFrom, dateTo } = req.query;
    let query = supabase.from('generated_documents').select('*');

    // Filter by user's assigned units unless they're admin
    if (req.user.role !== 'admin') {
      if (!req.user.units?.length) {
        return res.status(403).json({ message: 'No units assigned' });
      }
      query = query.in('unit', req.user.units);
    }

    if (status) {
      query = query.eq('status', status);
    }
    if (unit && unit !== 'all') {
      query = query.eq('unit', unit);
    }

    // Date filters
    if (dateFrom) {
      query = query.gte('protocol_date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('protocol_date', dateTo);
    }

    // Amount filters with validation
    if (req.query.amountFrom) {
      const amountFrom = parseFloat(req.query.amountFrom);
      if (!isNaN(amountFrom) && amountFrom >= 0 && amountFrom <= Number.MAX_SAFE_INTEGER) {
        query = query.gte('total_amount', amountFrom);
      }
    }
    if (req.query.amountTo) {
      const amountTo = parseFloat(req.query.amountTo);
      if (!isNaN(amountTo) && amountTo >= 0 && amountTo <= Number.MAX_SAFE_INTEGER) {
        query = query.lte('total_amount', amountTo);
      }
    }

    // User/Recipient filter with proper text search
    if (req.query.user) {
      const searchTerm = req.query.user.toLowerCase().trim();
      if (searchTerm) {
        query = query.or(`recipients.cs.[{"lastname":"${searchTerm}"}],recipients.cs.[{"afm":"${searchTerm}"}]`);
      }
    }

    query = query.order('created_at', { ascending: false }); // Added ordering

    const { data, error } = await query;

    if (error) throw error;

    res.json({
      status: 'success',
      data: data
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Failed to fetch documents' });
  }
});

router.get('/:id/export', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { data: document, error } = await supabase
      .from('generated_documents')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Generate document with recipients array
    const docBuffer = await DocumentGenerator.generateDocument(req, document.recipients || [], {
      department: document.department,
      unit: document.unit,
      project_na853: document.project_na853,
      total_amount: document.total_amount
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=document-${id}.docx`);
    res.send(docBuffer);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ 
      message: 'Failed to export document',
      details: error.message
    });
  }
});


router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('generated_documents')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: 'Document not found' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Failed to fetch document' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    let { department, status, recipients, total_amount, project_id, expenditure_type, unit } = req.body;

    if (!recipients?.length || !project_id || !unit || !expenditure_type) {
      return res.status(400).json({ 
        message: 'Missing required fields',
        details: {
          hasRecipients: !!recipients?.length,
          hasProjectId: !!project_id,
          hasUnit: !!unit,
          hasExpenditureType: !!expenditure_type
        }
      });
    }

    if (!req.user?.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { data: projectData, error: projectError } = await supabase
      .from('project_catalog')
      .select('na853')
      .eq('mis', project_id)
      .single();

    if (projectError || !projectData) {
      return res.status(404).json({ message: 'Project not found' });
    }


    const documentData = {
      department,
      status: status || 'pending',
      recipients,
      total_amount: parseFloat(total_amount) || 0,
      project_id,
      project_na853: projectData.na853,
      expenditure_type,
      unit,
      generated_by: req.user.id,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('generated_documents')
      .insert(documentData)
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Failed to create document' });
  }
});

router.patch('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  // First check if document exists
  const { data: existingDoc, error: docError } = await supabase
    .from('generated_documents')
    .select('*')
    .eq('id', id)
    .single();

  if (docError || !existingDoc) {
    return res.status(404).json({
      status: 'error', 
      message: 'Document not found'
    });
  }

  try {
    const { data, error } = await supabase
      .from('generated_documents')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({ message: 'Failed to update document' });
  }
});

module.exports = router;