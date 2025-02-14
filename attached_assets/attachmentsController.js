
const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware.js');
const { supabase } = require('../config/db.js');
const router = express.Router();

router.get('/:type/:installment', authenticateToken, async (req, res) => {
  try {
    const { type, installment } = req.params;
    
    if (!type || !installment) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Expenditure type and installment are required' 
      });
    }

    const decodedType = decodeURIComponent(type).trim();
    const parsedInstallment = parseInt(installment);

    if (isNaN(parsedInstallment) || parsedInstallment < 1) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Invalid installment number' 
      });
    }

    const { data, error } = await supabase
      .from('attachments')
      .select('*')
      .eq('expediture_type', decodedType)
      .eq('installment', parsedInstallment)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Database error:', error);
      return res.status(500).json({ 
        status: 'error',
        message: 'Database error',
        error: error.message 
      });
    }

    // Get default attachments if no specific ones found
    if (!data?.attachments?.length) {
      const { data: defaultData } = await supabase
        .from('attachments')
        .select('*')
        .eq('expediture_type', 'default')
        .eq('installment', 1)
        .single();

      return res.json({
        status: 'success',
        attachments: defaultData?.attachments || ['Διαβιβαστικό', 'ΔΚΑ']
      });
    }

    res.json({
      status: 'success',
      attachments: data.attachments
    });

  } catch (error) {
    console.error('Error fetching attachments:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Failed to fetch attachments',
      error: error.message
    });
  }
});

module.exports = router;
