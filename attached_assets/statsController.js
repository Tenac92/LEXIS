const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware.js');
const { supabase } = require('../config/db.js');
const { ApiError } = require('../utils/apiErrorHandler.js');
const router = express.Router();

const asyncHandler = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

router.get('/dashboard', authenticateToken, asyncHandler(async (req, res) => {
  const { data: stats, error } = await supabase
    .rpc('get_dashboard_stats', { user_id: req.user.userId });

  if (error) throw new ApiError(500, "Failed to fetch dashboard statistics");

  res.json(stats || {
    total_documents: 0,
    pending_documents: 0,
    completed_documents: 0,
    total_amount: 0
  });
}));

router.get('/monthly', authenticateToken, asyncHandler(async (req, res) => {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 11);

  const { data, error } = await supabase
    .from('documents')
    .select('created_at, status, total_amount')
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: true });

  if (error) throw new ApiError(500, "Failed to fetch monthly statistics");

  const monthlyStats = {};
  data?.forEach(doc => {
    const month = doc.created_at.substring(0, 7);
    if (!monthlyStats[month]) {
      monthlyStats[month] = {
        total: 0,
        completed: 0,
        amount: 0
      };
    }
    monthlyStats[month].total++;
    if (doc.status === 'completed') monthlyStats[month].completed++;
    monthlyStats[month].amount += doc.total_amount || 0;
  });

  res.json(monthlyStats);
}));

module.exports = router;