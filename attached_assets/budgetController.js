const express = require('express');
const router = express.Router();
const { supabase } = require('../config/db.js');
const { authenticateToken, requireAdmin } = require('../middleware/authMiddleware.js');
const { ApiError } = require('../utils/apiErrorHandler.js');
const { validateBudgetData } = require('../utils/validation.js');
const AuditLogger = require('../utils/auditLogger.js');

// Utility functions
const sanitize = {
  mis: (mis) => mis?.toString().trim() || '',
  amount: (amount) => {
    const parsed = parseFloat(amount);
    return !isNaN(parsed) && parsed >= 0 ? parsed : 0;
  },
  quarterly: (data) => ({
    q1: sanitize.amount(data?.q1),
    q2: sanitize.amount(data?.q2),
    q3: sanitize.amount(data?.q3),
    q4: sanitize.amount(data?.q4)
  })
};

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Budget data retrieval routes
router.get('/all', authenticateToken, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('budget_na853_split')
    .select('*')
    .order('na853', { ascending: true });

  if (error) throw new ApiError(500, 'Database error while fetching budget data');
  res.json(data || []);
}));

router.get('/:mis', authenticateToken, asyncHandler(async (req, res) => {
  const mis = sanitize.mis(req.params.mis);

  const { data, error } = await supabase
    .from('budget_na853_split')
    .select('*')
    .eq('mis', mis)
    .single();

  if (error) throw new ApiError(500, 'Error fetching budget data');

  res.json(data || {
    user_view_budget: 0,
    total_budget: 0,
    katanomes_etous: 0,
    quarterly: { q1: 0, q2: 0, q3: 0, q4: 0 }
  });
}));

// Budget update routes
router.post('/bulk-update', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { updates } = req.body;

  if (!Array.isArray(updates)) {
    throw new ApiError(400, 'Updates must be an array');
  }

  const results = { success: [], errors: [] };

  const { data: client } = await supabase.rpc('begin_transaction');

  try {
    for (const update of updates) {
      const { na853, ...budgetData } = update;
      if (!na853) throw new Error('NA853 code required');

      const sanitizedData = {
        proip: sanitize.amount(budgetData.proip),
        ethsia_pistosi: sanitize.amount(budgetData.ethsia_pistosi),
        ...sanitize.quarterly(budgetData),
        katanomes_etous: sanitize.amount(budgetData.katanomes_etous),
        user_view: sanitize.amount(budgetData.user_view || budgetData.katanomes_etous),
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('budget_na853_split')
        .upsert({ na853, ...sanitizedData });

      if (error) throw error;
      results.success.push(na853);

      await AuditLogger.log(
        req.user.id,
        'BUDGET_UPDATE',
        'budget',
        na853,
        sanitizedData
      );
    }

    await supabase.rpc('commit_transaction');

    res.json({
      status: 'success',
      results
    });
  } catch (error) {
    await supabase.rpc('rollback_transaction');
    throw new ApiError(409, 'Transaction failed', results);
  }
}));

// Budget validation routes
router.post('/:mis/validate-amount', authenticateToken, asyncHandler(async (req, res) => {
  const { mis } = req.params;
  const { amount } = req.body;

  if (!mis || amount === undefined) {
    throw new ApiError(400, 'MIS and amount are required');
  }

  const { data, error } = await supabase
    .from('budget_na853_split')
    .select('*')
    .eq('mis', mis)
    .single();

  if (error || !data) {
    throw new ApiError(404, 'Budget not found');
  }

  const validation = {
    requestedAmount: sanitize.amount(amount),
    userView: sanitize.amount(data.user_view),
    katanomesEtous: sanitize.amount(data.katanomes_etous),
    ethsiaPistosi: sanitize.amount(data.ethsia_pistosi),
    proip: sanitize.amount(data.proip)
  };

  const validationResult = {
    status: 'success',
    canCreate: true
  };

  if (validation.requestedAmount > validation.proip) {
    validationResult.status = 'error';
    validationResult.message = 'Amount exceeds budget (ΠΡΟΫΠ)';
    validationResult.canCreate = false;
  } else if (validation.requestedAmount > validation.ethsiaPistosi) {
    validationResult.status = 'warning';
    validationResult.message = 'Amount exceeds annual credit';
    validationResult.canCreate = false;
    validationResult.requiresNotification = true;
  } else if (validation.requestedAmount > (validation.katanomesEtous * 0.2)) {
    validationResult.status = 'warning';
    validationResult.message = 'Amount exceeds 20% of annual allocation';
    validationResult.requiresNotification = true;
  }

  res.json(validationResult);
}));

// Admin notification route
router.post('/notify-admin', authenticateToken, asyncHandler(async (req, res) => {
  const { type, mis, amount, current_budget, ethsia_pistosi, reason } = req.body;

  const validationResult = validateBudgetData({
    type,
    mis,
    amount,
    current_budget,
    ethsia_pistosi
  });

  if (!validationResult.isValid) {
    throw new ApiError(400, 'Validation failed', validationResult.errors);
  }

  const notification = {
    mis: sanitize.mis(mis),
    type,
    amount: sanitize.amount(amount),
    current_budget: sanitize.amount(current_budget),
    ethsia_pistosi: sanitize.amount(ethsia_pistosi),
    reason: reason || 'Budget limit exceeded',
    status: 'pending',
    created_at: new Date().toISOString(),
    user_id: req.user.id
  };

  const { data: insertedNotification, error: notificationError } = await supabase
    .from('budget_notifications')
    .insert([notification])
    .select()
    .single();

  if (notificationError) {
    throw new ApiError(500, 'Failed to create notification record');
  }

  const { error: updateError } = await supabase
    .from('project_catalog')
    .update({
      status: type === 'funding' ? 'pending_funding' : 'pending_reallocation'
    })
    .eq('mis', mis);

  if (updateError) {
    throw new ApiError(500, 'Failed to update project status');
  }

  res.json({
    status: 'success',
    message: 'Admin notification created successfully',
    notification: {
      id: insertedNotification.id,
      type: insertedNotification.type,
      status: insertedNotification.status
    }
  });
}));

module.exports = router;