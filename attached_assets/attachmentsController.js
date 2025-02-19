
const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware.js');
const { supabase } = require('../config/db.js');
const router = express.Router();

router.get('/:type/:installment', authenticateToken, async (req, res) => {
  try {
    const { type, installment } = req.params;
    
    if (!type || !installment) {
      return res.status(400).json({ 
        message: 'Expenditure type and installment are required' 
      });
    }

    const decodedType = decodeURIComponent(type).trim();
    const parsedInstallment = parseInt(installment);

    if (isNaN(parsedInstallment) || parsedInstallment < 1) {
      return res.status(400).json({ 
        message: 'Invalid installment number' 
      });
    }

    console.log('Fetching attachments for:', { decodedType, parsedInstallment });

    const { data, error } = await supabase
      .from('attachments')
      .select('*')
      .eq('expenditure_type', decodedType)
      .eq('installment', parsedInstallment)
      .maybeSingle();

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ 
        message: 'Database error',
        error: error.message 
      });
    }

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ 
        message: 'Failed to fetch attachments',
        error: error.message 
      });
    }

    // Return first matching record or default empty attachments
    const attachments = data?.[0]?.attachments || [];

    res.json({
      status: 'success',
      attachments
    });

  } catch (error) {
    console.error('Error fetching attachments:', error);
    res.status(500).json({ 
      message: 'Failed to fetch attachments',
      error: error.message
    });
  }
});

module.exports = router;
