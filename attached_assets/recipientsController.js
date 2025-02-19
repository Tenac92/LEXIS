
const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware.js');
const { supabase } = require('../config/db.js');
const router = express.Router();

router.post('/delete', authenticateToken, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ message: 'Invalid document IDs' });
    }

    const { error } = await supabase
      .from('recipients')
      .delete()
      .in('id', ids);

    if (error) throw error;
    res.json({ message: 'Recipients deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ message: 'Failed to delete recipients' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { ids, project_id } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ message: 'Invalid document IDs' });
    }
    if (!project_id) {
      return res.status(400).json({ message: 'Project ID is required' });
    }

    const { data, error } = await supabase
      .from('recipients')
      .select('*')
      .in('id', ids);

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Failed to fetch recipients' });
  }
});

module.exports = router;
