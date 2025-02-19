const express = require("express");
const { authenticateToken } = require("../middleware/authMiddleware.js");
const { supabase } = require("../config/db.js");
const rateLimit = require('express-rate-limit');
const router = express.Router();

// Constants
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

// Rate limiting configuration
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { 
    status: 'error', 
    message: 'Too many requests, please try again later.' 
  }
});

router.use(apiLimiter);

// Main routes
router.get("/all", authenticateToken, async (req, res) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }

    const { searchQuery, pagination } = parseQueryParams(req.query);
    const query = buildDatabaseQuery(searchQuery);
    const result = await executeQuery(query, pagination);

    if (!result?.data) {
      res.status(404).json({
        status: 'error',
        message: 'No data found'
      });
      return;
    }

    res.json({
      data: formatResponseData(result.data),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.count,
        pages: Math.ceil(result.count / pagination.limit),
      },
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error:`, error);
    if (!res.headersSent) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch data',
        code: error.name || 'InternalError'
      });
    }
  }
});

// Handle project status updates
router.post("/action/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { actionType } = req.body;
    const userId = req.user.userId;

    if (!['approve', 'reject', 'review'].includes(actionType)) {
      return res.status(400).json({ message: 'Invalid action type' });
    }

    // Update project status
    const { error } = await supabase
      .from('project_catalog')
      .update({ 
        status: actionType === 'approve' ? 'approved' : 
                actionType === 'reject' ? 'rejected' : 
                'under_review'
      })
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to update project status: ${error.message}`);
    }

    res.json({ 
      message: 'Status updated successfully',
      status: 'success'
    });
  } catch (error) {
    console.error('Action error:', error);
    res.status(500).json({ 
      message: 'Failed to update status',
      status: 'error'
    });
  }
});

// Helper functions
function parseQueryParams(query) {
  const searchQuery = query.search?.toString().trim() || '';
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(MAX_PAGE_SIZE, parseInt(query.limit, 10) || DEFAULT_PAGE_SIZE);

  return {
    searchQuery,
    pagination: { 
      page,
      limit,
      start: (page - 1) * limit,
      end: (page - 1) * limit + limit - 1
    }
  };
}

function buildDatabaseQuery(searchTerm) {
  let query = supabase.from("project_catalog").select("*", { count: "exact" });

  if (searchTerm) {
    const sanitizedTerm = searchTerm.replace(/[\\%_'";]/g, '\\$&');

    if (/^\d+$/.test(searchTerm)) {
      query = query.filter(`mis::text`, 'ilike', `%${sanitizedTerm}%`);
    } else {
      query = query.or(`e069.ilike.%${sanitizedTerm}%,na271.ilike.%${sanitizedTerm}%,na853.ilike.%${sanitizedTerm}%,event_description.ilike.%${sanitizedTerm}%,project_title.ilike.%${sanitizedTerm}%,region.ilike.%${sanitizedTerm}%,municipality.ilike.%${sanitizedTerm}%`);
    }
  }

  return query;
}

async function executeQuery(query, pagination) {
  try {
    const { data, error, count } = await query
      .range(pagination.start, pagination.end);

    if (error) throw new Error(`Database query failed: ${error.message}`);
    return { data: data || [], count: count || 0 };
  } catch (err) {
    console.error('Query execution error:', err);
    throw new Error(`Database query failed: ${err.message}`);
  }
}

function formatResponseData(data) {
  return data.map(item => ({
    id: item.id,
    MIS: item.mis,
    e069: item.e069,
    budget_e069: item.budget_e069,
    na271: item.na271,
    budget_na271: item.budget_na271,
    na853: item.na853,
    budget_na853: item.budget_na853,
    description: item.event_description,
    title: item.project_title,
    event_type: item.event_type,
    event_year: item.event_year,
    region: item.region,
    regional_unit: item.regional_unit,
    municipality: item.municipality,
    implementing_agency: item.implementing_agency,
    expenditure_type: item.expenditure_type,
    KYA: item.kya,
    FEK: item.fek,
    ADA: item.ada,
    status: item.status,
    procedures: item.procedures
  }));
}

module.exports = router;