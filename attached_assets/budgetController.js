const express = require('express');
const router = express.Router();
const { supabase } = require('../config/db.js');
const { authenticateToken } = require('../middleware/authMiddleware.js');
const { ApiError } = require('../utils/apiErrorHandler.js');
const { validateBudgetData } = require('../utils/validation');
const auditLogger = require('../utils/auditLogger'); // Assuming this is defined elsewhere
const BudgetService = require('../services/budgetService'); // Assuming this is defined elsewhere

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
      user_view_budget: 0,
      total_budget: 0,
      katanomes_etous: 0,
      quarterly: { q1: 0, q2: 0, q3: 0, q4: 0 }
    });
  } catch (error) {
    console.error('Budget fetch error:', error);
    res.status(500).json({ status: 'error', message: error.message });
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

// Update budget amount after document creation
router.post('/:mis/update-amount', authenticateToken, async (req, res) => {
  try {
    const { mis } = req.params;
    const { amount } = req.body;

    if (!mis || !amount) {
      return res.status(400).json({
        status: 'error',
        message: 'MIS and amount are required'
      });
    }

    const { data, error } = await supabase
      .from('budget_na853_split')
      .select('user_view')
      .eq('mis', mis)
      .single();

    if (error) throw error;

    const currentAmount = parseFloat(data.user_view) || 0;
    const newAmount = Math.max(0, currentAmount - parseFloat(amount));

    const { error: updateError } = await supabase
      .from('budget_na853_split')
      .update({ user_view: newAmount })
      .eq('mis', mis);

    if (updateError) throw updateError;

    res.json({ status: 'success', newAmount });
  } catch (error) {
    console.error('Budget update error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});


router.post('/notify-admin', authenticateToken, async (req, res) => {
  try {
    const {
      type,
      mis,
      amount,
      current_budget,
      ethsia_pistosi,
      reason,
      priority = 'medium',
      metadata = {},
      action_deadline
    } = req.body;
    const user = req.user;

    // Enhanced validation
    const validationResult = validateBudgetData({
      type,
      mis,
      amount,
      current_budget,
      ethsia_pistosi
    });

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
      details: {
        mis,
        type,
        amount,
        priority,
        metadata
      }
    });

    // Create notification with enhanced data
    const notification = await BudgetService.createBudgetNotification({
      mis,
      type,
      amount: parseFloat(amount),
      current_budget: parseFloat(current_budget),
      ethsia_pistosi: parseFloat(ethsia_pistosi),
      reason,
      priority,
      metadata: {
        ...metadata,
        source_ip: req.ip,
        user_agent: req.headers['user-agent'],
        notification_context: {
          budget_percentage: (parseFloat(amount) / parseFloat(current_budget)) * 100,
          annual_budget_impact: (parseFloat(amount) / parseFloat(ethsia_pistosi)) * 100
        }
      },
      created_by: user.id,
      action_deadline: action_deadline ? new Date(action_deadline) : undefined
    });

    // Update project status with more specific states
    const projectStatus = type === 'funding' ? 'pending_funding' :
      type === 'reallocation' ? 'pending_reallocation' :
        type === 'low_budget' ? 'budget_warning' :
          'budget_review_needed';

    const { error: updateError } = await supabase
      .from('project_catalog')
      .update({
        status: projectStatus,
        last_notification_date: new Date().toISOString(),
        notification_count: supabase.raw('notification_count + 1')
      })
      .eq('mis', mis);

    if (updateError) {
      throw new Error(`Failed to update project status: ${updateError.message}`);
    }

    // Send response with enhanced information
    res.json({
      status: 'success',
      message: 'Admin notification submitted successfully',
      notification: {
        id: notification.id,
        type: notification.type,
        priority: notification.priority,
        status: notification.status,
        action_required: notification.action_required,
        action_deadline: notification.action_deadline
      },
      project_status: projectStatus,
      metadata: notification.metadata
    });
  } catch (error) {
    console.error('Admin notification error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to process notification',
      error_code: error.code,
      error_details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Add new endpoint for retrieving notifications with filtering and sorting
router.get('/notifications', authenticateToken, async (req, res) => {
  try {
    const {
      status,
      priority,
      type,
      from_date,
      to_date,
      mis,
      limit = 10,
      offset = 0,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query;

    let query = supabase
      .from('budget_notifications')
      .select('*, created_by(id, name)', { count: 'exact' });

    // Apply filters
    if (status) query = query.eq('status', status);
    if (priority) query = query.eq('priority', priority);
    if (type) query = query.eq('type', type);
    if (mis) query = query.eq('mis', mis);
    if (from_date) query = query.gte('created_at', from_date);
    if (to_date) query = query.lte('created_at', to_date);

    // Apply sorting
    query = query.order(sort_by, { ascending: sort_order === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: notifications, error, count } = await query;

    if (error) throw error;

    res.json({
      status: 'success',
      data: notifications,
      pagination: {
        total: count,
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: count > (offset + limit)
      }
    });
  } catch (error) {
    console.error('Fetch notifications error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch notifications',
      error_details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Add endpoint for updating notification status
router.patch('/notifications/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, review_notes } = req.body;
    const user = req.user;

    const { data: notification, error } = await supabase
      .from('budget_notifications')
      .update({
        status,
        review_notes,
        reviewed_by: user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Create audit log entry for the status update
    await auditLogger.log({
      action: 'NOTIFICATION_STATUS_UPDATE',
      user_id: user.id,
      details: {
        notification_id: id,
        old_status: notification.status,
        new_status: status,
        review_notes
      }
    });

    res.json({
      status: 'success',
      message: 'Notification updated successfully',
      notification
    });
  } catch (error) {
    console.error('Update notification error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update notification',
      error_details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

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

    const { data, error } = await supabase
      .from('budget_na853_split')
      .select('*')
      .eq('mis', mis)
      .single();

    if (error || !data) {
      return res.status(404).json({
        status: 'error',
        message: 'Budget not found'
      });
    }

    const requestedAmount = parseFloat(amount);
    const userView = parseFloat(data.user_view) || 0;
    const katanomesEtous = parseFloat(data.katanomes_etous) || 0;
    const ethsiaPistosi = parseFloat(data.ethsia_pistosi) || 0;
    const proip = parseFloat(data.proip) || 0;

    if (requestedAmount > proip) {
      return res.status(400).json({
        status: 'error',
        message: 'Το ποσό υπερβαίνει τον προϋπολογισμό (ΠΡΟΫΠ)',
        canCreate: false,
        notificationType: 'exceeded_proip'
      });
    }

    if (requestedAmount > ethsiaPistosi) {
      return res.status(200).json({
        status: 'warning',
        message: 'Το ποσό υπερβαίνει την ετήσια πίστωση',
        canCreate: false,
        requiresNotification: true,
        notificationType: 'funding',
        allowDocx: false
      });
    }

    if (requestedAmount > (katanomesEtous * 0.2)) {
      return res.status(200).json({
        status: 'warning',
        message: 'Το ποσό υπερβαίνει το 20% της ετήσιας κατανομής',
        canCreate: true,
        requiresNotification: true,
        notificationType: 'reallocation',
        allowDocx: true
      });
    }

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

module.exports = router;