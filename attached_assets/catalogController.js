const express = require("express");
const xlsx = require("xlsx");
const ProjectCatalog = require("../models/ProjectCatalog.js");
const { authenticateToken, requireAdmin } = require("../middleware/authMiddleware.js");
const { supabase } = require("../config/db.js");
const router = express.Router();

// Get all catalog items
router.get("/", authenticateToken, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = parseInt(req.query.limit) || 12;  // Remove limit restriction for exports
    const search = (req.query.search || '').trim();
    const unit = (req.query.unit || '').trim();

    const items = await ProjectCatalog.findAll(page, limit, { search, unit });

    res.json({
      status: 'success',
      data: items.data || [],
      pagination: {
        page,
        limit,
        total: items.total || 0,
        pages: items.totalPages || 1
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Catalog fetch error:', error);
    res.status(error.status || 500).json({ 
      status: 'error',
      message: error.message || 'Error fetching catalog items'
    });
  }
});

// Create new catalog item (admin only)
router.post("/", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const item = await ProjectCatalog.create(req.body);
    res.status(201).json(item);
  } catch (error) {
    handleError(error, res, "Error creating catalog item");
  }
});

// Update catalog item (admin only)
router.put("/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    await ProjectCatalog.update(req.params.id, req.body);
    res.json({ message: "Catalog item updated successfully" });
  } catch (error) {
    handleError(error, res, "Error updating catalog item");
  }
});

// Get single catalog item
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    if (!req.params.id) {
      return res.status(400).json({
        status: 'error',
        message: 'Project ID is required'
      });
    }
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid project ID format'
      });
    }
    const item = await ProjectCatalog.findById(projectId);
    if (!item) {
      return res.status(404).json({
        status: 'error',
        message: 'Project not found'
      });
    }
    res.json(item);
  } catch (error) {
    handleError(error, res, "Error fetching catalog item");
  }
});

// Delete catalog item (admin only)
router.delete("/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    await ProjectCatalog.delete(req.params.id);
    res.json({ message: "Catalog item deleted successfully" });
  } catch (error) {
    handleError(error, res, "Error deleting catalog item");
  }
});


// Validate project and expenditure types
router.get("/:id/validate", authenticateToken, async (req, res) => {
  try {
    const { data: project, error } = await supabase
      .from('project_catalog')
      .select('*, budget_details:budget_na853(*)')
      .eq('mis', req.params.id)
      .single();

    if (error) throw error;

    const budgetValidation = {
      hasValidBudget: project.budget_na853 > 0,
      status: project.status,
      canCreate: project.status === 'active' && project.budget_na853 > 0
    };

    if (error) throw error;

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Handle PostgreSQL array format for expenditure_type
    let expenditureTypes = [];

    if (project.expenditure_type) {
      try {
        if (Array.isArray(project.expenditure_type)) {
          expenditureTypes = project.expenditure_type.flat();
        } else if (typeof project.expenditure_type === 'string') {
          // Handle PostgreSQL array format {value1,value2}
          const cleaned = project.expenditure_type.replace(/^\{|\}$/g, '');
          expenditureTypes = cleaned.split(',')
            .map(item => item.trim().replace(/^"|"$/g, ''))
            .filter(Boolean);
        }
        console.log('Parsed expenditure types:', expenditureTypes);
      } catch (err) {
        console.error('Error parsing expenditure types:', err);
      }
    }

    project.expenditure_type = expenditureTypes;
    res.json(project);
  } catch (error) {
    handleError(error, res, "Error validating project");
  }
});

// Get expenditure types for a project
router.get("/:id/expenditure-types", authenticateToken, async (req, res) => {
  try {
    const { data: project } = await supabase
      .from('project_catalog')
      .select('expenditure_type')
      .eq('mis', req.params.id)
      .single();

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    res.json({ expenditure_types: project.expenditure_type || [] });
  } catch (error) {
    handleError(error, res, "Error fetching expenditure types");
  }
});

// Bulk update projects (admin only)
router.put("/bulk-update", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { updates } = req.body;
    if (!Array.isArray(updates)) {
      return res.status(400).json({ message: "Updates must be an array" });
    }

    const results = await Promise.all(
      updates.map(update => ProjectCatalog.update(update.mis, update.data))
    );

    res.json({ message: "Bulk update completed", results });
  } catch (error) {
    handleError(error, res, "Error performing bulk update");
  }
});

// Export projects
router.get("/export", authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 1000);
    const search = (req.query.search || '').trim();
    const unit = (req.query.unit || '').trim();

    const items = await ProjectCatalog.findAll(page, limit, { search, unit });

    if (!items?.data) {
      return res.status(400).json({
        status: 'error',
        message: 'No projects found for export'
      });
    }

    // Convert to CSV
    const fields = ['mis', 'event_description', 'region', 'budget_na853', 'status'];
    const csv = [
      fields.join(','),
      ...items.data.map(item => fields.map(field => `"${item[field] || ''}"`).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=projects.csv');
    res.send(csv);


  } catch (error) {
    handleError(error, res, "Error exporting projects");
  }
});


function handleError(error, res, message) {
  console.error('Catalog error:', error);
  res.status(500).json({ 
    message, 
    error: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
  });
}

module.exports = router;
// Update project status
router.patch('/:mis/status', authenticateToken, async (req, res) => {
  try {
    const { mis } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    const allowedStatuses = ['pending_funding', 'pending_reallocation', 'active'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const success = await ProjectCatalog.update(mis, { status });
    if (!success) {
      throw new Error('Failed to update project status');
    }

    res.json({ message: 'Status updated successfully' });
  } catch (error) {
    console.error('Status update error:', error);
    res.status(500).json({ message: error.message });
  }
});