const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware.js');
const { supabase } = require('../config/db.js');
const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { unit, status = 'pending', project_id } = req.query;
    let query = supabase
      .from('recipients')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (unit) {
      query = query.eq('unit', unit);
    }

    if (project_id) {
      query = query.eq('project_id', project_id);
    }

    const { data, error } = await query;

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Failed to fetch recipients' });
  }
});

router.get('/project/:mis', authenticateToken, async (req, res) => {
  try {
    const { mis } = req.params;
    const { data, error } = await supabase
      .from('recipients')
      .select('*')
      .eq('project_mis', mis)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Project recipients fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch project recipients' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { firstname, lastname, afm, amount, project_id, unit, installment } = req.body;

    if (!firstname || !lastname || !afm || !amount || !project_id || !unit) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const { data, error } = await supabase
      .from('recipients')
      .insert([{
        firstname,
        lastname,
        afm,
        amount: parseFloat(amount),
        project_id,
        unit,
        installment: installment || 1,
        status: 'pending',
        created_at: new Date().toISOString(),
        created_by: req.user.id
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Failed to create recipient' });
  }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('recipients')
      .update({
        ...req.body,
        updated_by: req.user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Recipient update error:', error);
    res.status(500).json({ message: 'Failed to update recipient' });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { error } = await supabase
      .from('recipients')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ message: 'Recipient deleted successfully' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Failed to delete recipient' });
  }
});

module.exports = router;