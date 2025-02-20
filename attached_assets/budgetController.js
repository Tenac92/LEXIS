const express = require('express');
const router = express.Router();
const { supabase } = require('../config/db.js');
const { authenticateToken } = require('../middleware/authMiddleware.js');

// Helper functions
const sanitizeMIS = (mis) => mis?.toString().trim() || '';
const validateAmount = (amount) => {
  const parsed = parseFloat(amount);
  return !isNaN(parsed) && parsed >= 0 && parsed <= Number.MAX_SAFE_INTEGER ? parsed : 0;
};

// Get all budget data with pagination
router.get("/all", authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('budget_na853_split')
      .select('*')
      .order('na853', { ascending: true });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Budget fetch error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Get budget by MIS
router.get('/:mis', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('budget_na853_split')
      .select('*')
      .eq('mis', sanitizeMIS(req.params.mis))
      .single();

    if (error) throw error;

    res.json(data || {
      user_view: 0,
      total_budget: 0,
      katanomes_etous: 0,
      ethsia_pistosi: 0,
      quarterly: { q1: 0, q2: 0, q3: 0, q4: 0 }
    });
  } catch (error) {
    console.error('Budget fetch error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Validate amount before document creation
router.post('/:mis/validate-amount', authenticateToken, async (req, res) => {
  try {
    const { mis } = req.params;
    const { amount } = req.body;

    if (!mis || !amount) {
      return res.status(400).json({
        status: 'error',
        message: 'MIS and amount are required'
      });
    }

    const requestedAmount = parseFloat(amount);
    if (isNaN(requestedAmount) || requestedAmount <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid amount'
      });
    }

    // Get current budget data
    const { data: budgetData, error: fetchError } = await supabase
      .from('budget_na853_split')
      .select('*')
      .eq('mis', mis)
      .single();

    if (fetchError || !budgetData) {
      console.error('Budget fetch error:', fetchError);
      return res.status(404).json({
        status: 'error',
        message: 'Budget not found'
      });
    }

    console.log('Current budget data:', budgetData);

    const userView = parseFloat(budgetData.user_view) || 0;
    const ethsiaPistosi = parseFloat(budgetData.ethsia_pistosi) || 0;
    const katanomesEtous = parseFloat(budgetData.katanomes_etous) || 0;

    // First check: Amount cannot exceed user_view
    if (requestedAmount > userView) {
      return res.status(400).json({
        status: 'error',
        message: 'Το ποσό υπερβαίνει το διαθέσιμο προϋπολογισμό',
        canCreate: false,
        allowDocx: false
      });
    }

    const remainingEthsiaPistosi = ethsiaPistosi - requestedAmount;
    const remainingUserView = userView - requestedAmount;
    const twentyPercentThreshold = katanomesEtous * 0.2;

    // Second check: Ethsia Pistosi will be depleted
    if (remainingEthsiaPistosi <= 0) {
      return res.json({
        status: 'warning',
        message: 'Το ποσό θα εξαντλήσει την ετήσια πίστωση',
        canCreate: true,
        requiresNotification: true,
        notificationType: 'funding',
        allowDocx: true
      });
    }

    // Third check: Below 20% of katanomes_etous
    if (remainingUserView <= twentyPercentThreshold) {
      return res.json({
        status: 'warning',
        message: 'Το ποσό θα μειώσει το διαθέσιμο προϋπολογισμό κάτω από το 20% της ετήσιας κατανομής',
        canCreate: true,
        requiresNotification: true,
        notificationType: 'reallocation',
        allowDocx: true
      });
    }

    // All checks passed
    return res.json({
      status: 'success',
      canCreate: true,
      allowDocx: true
    });

  } catch (error) {
    console.error('Budget validation error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Update budget amount after document creation
router.post('/:mis/update-amount', authenticateToken, async (req, res) => {
  try {
    const { mis } = req.params;
    const { amount } = req.body;
    const user = req.user;

    if (!mis || !amount) {
      return res.status(400).json({
        status: 'error',
        message: 'MIS and amount are required'
      });
    }

    const requestedAmount = parseFloat(amount);
    if (isNaN(requestedAmount) || requestedAmount <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid amount'
      });
    }

    // Get current budget data
    const { data: budgetData, error: fetchError } = await supabase
      .from('budget_na853_split')
      .select('*')
      .eq('mis', mis)
      .single();

    if (fetchError) {
      console.error('Budget fetch error:', fetchError);
      throw new Error('Failed to fetch budget data');
    }

    console.log('Current budget data before update:', budgetData);

    const currentUserView = parseFloat(budgetData.user_view) || 0;
    const currentEthsiaPistosi = parseFloat(budgetData.ethsia_pistosi) || 0;
    const katanomesEtous = parseFloat(budgetData.katanomes_etous) || 0;

    // Calculate new amounts
    const newUserView = Math.max(0, currentUserView - requestedAmount);
    const newEthsiaPistosi = Math.max(0, currentEthsiaPistosi - requestedAmount);
    const twentyPercentThreshold = katanomesEtous * 0.2;

    console.log('Calculated new amounts:', {
      newUserView,
      newEthsiaPistosi,
      twentyPercentThreshold
    });

    // Create budget notifications if needed
    const notifications = [];

    if (newEthsiaPistosi <= 0) {
      notifications.push({
        mis,
        type: 'funding',
        amount: requestedAmount,
        current_budget: newUserView,
        ethsia_pistosi: newEthsiaPistosi,
        reason: 'Η ετήσια πίστωση έχει εξαντληθεί',
        status: 'pending',
        user_id: user.id,
        created_at: new Date().toISOString()
      });
    }

    if (newUserView <= twentyPercentThreshold) {
      notifications.push({
        mis,
        type: 'reallocation',
        amount: requestedAmount,
        current_budget: newUserView,
        ethsia_pistosi: newEthsiaPistosi,
        reason: 'Το ποσό υπερβαίνει το 20% της ετήσιας κατανομής',
        status: 'pending',
        user_id: user.id,
        created_at: new Date().toISOString()
      });
    }

    // Insert notifications if any
    if (notifications.length > 0) {
      const { error: notificationError } = await supabase
        .from('budget_notifications')
        .insert(notifications);

      if (notificationError) {
        console.error('Notification creation error:', notificationError);
        throw new Error('Failed to create notifications');
      }

      console.log('Created notifications:', notifications);
    }

    // Update budget amounts
    const { error: updateError } = await supabase
      .from('budget_na853_split')
      .update({
        user_view: newUserView,
        ethsia_pistosi: newEthsiaPistosi,
        updated_at: new Date().toISOString()
      })
      .eq('mis', mis);

    if (updateError) {
      console.error('Budget update error:', updateError);
      throw new Error('Failed to update budget amounts');
    }

    console.log('Updated budget data:', {
      mis,
      newUserView,
      newEthsiaPistosi
    });

    res.json({
      status: 'success',
      data: {
        newUserView,
        newEthsiaPistosi,
        notifications: notifications.map(n => ({
          type: n.type,
          reason: n.reason
        }))
      }
    });

  } catch (error) {
    console.error('Budget update error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Bulk update budget data
router.post('/bulk-update', authenticateToken, async (req, res) => {
  const { updates } = req.body;
  const results = { success: [], errors: [] };

  if (!Array.isArray(updates)) {
    return res.status(400).json({ status: 'error', message: 'Updates must be an array' });
  }

  for (const update of updates) {
    try {
      const { na853, ...budgetData } = update;
      if (!na853) throw new Error('NA853 code required');

      const sanitizedData = {
        proip: validateAmount(budgetData.proip),
        ethsia_pistosi: validateAmount(budgetData.ethsia_pistosi),
        q1: validateAmount(budgetData.q1),
        q2: validateAmount(budgetData.q2),
        q3: validateAmount(budgetData.q3),
        q4: validateAmount(budgetData.q4),
        katanomes_etous: validateAmount(budgetData.katanomes_etous),
        user_view: validateAmount(budgetData.user_view || budgetData.katanomes_etous)
      };

      const { error } = await supabase
        .from('budget_na853_split')
        .upsert({ na853, ...sanitizedData, updated_at: new Date().toISOString() },
                { onConflict: 'na853', returning: 'minimal' });

      if (error) throw error;
      results.success.push(na853);
    } catch (error) {
      results.errors.push({ na853: update.na853, error: error.message });
    }
  }

  res.json({
    status: results.errors.length === 0 ? 'success' : 'partial',
    results
  });
});


router.post('/notify-admin', authenticateToken, async (req, res) => {
  try {
    const { type, mis, amount, current_budget, ethsia_pistosi, reason } = req.body;
    const user = req.user;

    // Enhanced validation
    const validationResult = validateBudgetData({ type, mis, amount, current_budget, ethsia_pistosi });
    if (!validationResult.isValid) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        details: validationResult.errors
      });
    }

    // Add audit logging
    await auditLogger.log({
      action: 'BUDGET_NOTIFICATION',
      user_id: user.id,
      details: { mis, type, amount }
    });

    // Enhanced input validation
    const validations = {
      type: !type || !['funding', 'reallocation'].includes(type),
      mis: !mis?.toString().trim(),
      amount: isNaN(parseFloat(amount)) || parseFloat(amount) <= 0,
      current_budget: isNaN(parseFloat(current_budget)),
      ethsia_pistosi: isNaN(parseFloat(ethsia_pistosi))
    };

    const failedValidations = Object.entries(validations)
      .filter(([_, failed]) => failed)
      .map(([field]) => field);

    if (failedValidations.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid parameters',
        details: failedValidations
      });
    }

    // Validate numeric values
    if ([amount, current_budget, ethsia_pistosi].some(val => isNaN(parseFloat(val)))) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid numeric values provided'
      });
    }

    // Check project existence
    const { data: project, error: projectCheckError } = await supabase
      .from('project_catalog')
      .select('*')
      .eq('mis', mis)
      .single();

    if (projectCheckError || !project) {
      return res.status(404).json({
        status: 'error',
        message: `Project with MIS ${mis} not found`
      });
    }

    // Create notification
    const notification = {
      mis,
      type,
      amount: parseFloat(amount),
      current_budget: parseFloat(current_budget),
      ethsia_pistosi: parseFloat(ethsia_pistosi),
      reason,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    const { data: insertedNotification, error: notificationError } = await supabase
      .from('budget_notifications')
      .insert([notification])
      .select()
      .single();

    if (notificationError || !insertedNotification) {
      throw new Error(notificationError?.message || 'Failed to create notification record');
    }

    // Update project status
    // Only update the status column
    const { error: updateError } = await supabase
      .from('project_catalog')
      .update({
        status: type === 'funding' ? 'pending_funding' : 'pending_reallocation'
      })
      .eq('mis', mis);

    if (updateError) {
      throw new Error(`Failed to update project status: ${updateError.message}`);
    }

    res.json({
      status: 'success',
      message: 'Admin notification submitted successfully',
      notification_id: insertedNotification.id,
      project_status: updates.status
    });
  } catch (error) {
    console.error('Admin notification error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to process notification'
    });
  }
});

module.exports = router;