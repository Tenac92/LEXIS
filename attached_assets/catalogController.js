const express = require("express");
const ExcelJS = require("exceljs");
const { authenticateToken, requireAdmin } = require("../middleware/authMiddleware.js");
const { supabase } = require("../config/db.js");
const { ApiError } = require("../utils/apiErrorHandler.js");
const router = express.Router();

const asyncHandler = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

router.get("/", authenticateToken, asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = parseInt(req.query.limit) || 12;
  const search = (req.query.search || '').trim();
  const unit = (req.query.unit || '').trim();

  let query = supabase
    .from('project_catalog')
    .select('*', { count: 'exact' });

  if (unit) {
    query = query.contains('implementing_agency', [unit]);
  }

  if (search) {
    const searchTerms = search.split(',').map(term => term.trim());
    const searchConditions = searchTerms.map(term => {
      const searchDigits = term.length > 3 ? term.slice(-3) : term;
      return `na853.ilike.%${searchDigits}`;
    });
    query = query.or(searchConditions.join(','));
  }

  const { data, error, count } = await query
    .order('mis', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (error) throw new ApiError(500, 'Failed to fetch catalog items');

  res.json({
    status: 'success',
    data: data || [],
    pagination: {
      page,
      limit,
      total: count || 0,
      pages: Math.ceil((count || 0) / limit)
    }
  });
}));

router.post("/", authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('project_catalog')
    .insert([req.body])
    .select()
    .single();

  if (error) throw new ApiError(500, 'Failed to create catalog item');

  res.status(201).json({
    status: 'success',
    data
  });
}));

router.get("/:mis", authenticateToken, asyncHandler(async (req, res) => {
  const { mis } = req.params;

  if (!mis) throw new ApiError(400, 'MIS parameter is required');

  const { data, error } = await supabase
    .from('project_catalog')
    .select('*, budget_details:budget_na853(*)')
    .eq('mis', mis)
    .single();

  if (error) throw new ApiError(500, 'Failed to fetch catalog item');
  if (!data) throw new ApiError(404, 'Project not found');

  res.json(data);
}));

router.put("/:mis", authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { mis } = req.params;
  const { data, error } = await supabase
    .from('project_catalog')
    .update(req.body)
    .eq('mis', mis)
    .select()
    .single();

  if (error) throw new ApiError(500, 'Failed to update catalog item');

  res.json({
    status: 'success',
    data
  });
}));

router.delete("/:mis", authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { mis } = req.params;
  const { error } = await supabase
    .from('project_catalog')
    .delete()
    .eq('mis', mis);

  if (error) throw new ApiError(500, 'Failed to delete catalog item');

  res.json({
    status: 'success',
    message: 'Project deleted successfully'
  });
}));

router.get("/export", authenticateToken, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('project_catalog')
    .select('*')
    .order('mis', { ascending: false });

  if (error) throw new ApiError(500, 'Failed to fetch data for export');

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Projects');

  worksheet.columns = [
    { header: 'MIS', key: 'mis' },
    { header: 'Description', key: 'event_description' },
    { header: 'Region', key: 'region' },
    { header: 'Budget', key: 'budget_na853' },
    { header: 'Status', key: 'status' }
  ];

  worksheet.addRows(data);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=projects.xlsx');

  await workbook.xlsx.write(res);
}));

module.exports = router;