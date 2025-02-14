const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/authMiddleware.js');
const { supabase } = require('../config/db.js');
const router = express.Router();

router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Users fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(data);
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
});

router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email: req.body.email,
      password: req.body.password,
      email_confirm: true
    });

    if (error) throw error;

    const userData = {
      id: data.user.id,
      email: req.body.email,
      full_name: req.body.full_name,
      role: req.body.role || 'user',
      unit: req.body.unit,
      active: true
    };

    const { error: userError } = await supabase
      .from('users')
      .insert([userData]);

    if (userError) throw userError;

    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error('User creation error:', error);
    res.status(500).json({ message: 'Failed to create user' });
  }
});

router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('users')
      .update({
        full_name: req.body.full_name,
        role: req.body.role,
        unit: req.body.unit,
        active: req.body.active,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('User update error:', error);
    res.status(500).json({ message: 'Failed to update user' });
  }
});

router.get('/units', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('unit_details')
      .select('*')
      .order('unit_name', { ascending: true });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Units fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch units' });
  }
});

module.exports = router;