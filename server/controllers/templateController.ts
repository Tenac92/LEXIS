import { Router, Request, Response } from "express";
import { TemplateManager } from "../utils/TemplateManager";
import { authenticateSession } from '../auth';
import type { User } from "@shared/schema";

interface AuthRequest extends Request {
  user?: User;
}

const router = Router();

// List all templates
router.get('/', authenticateSession, async (req: AuthRequest, res: Response) => {
  try {
    const templates = await TemplateManager.listTemplates();
    res.json(templates);
  } catch (error) {
    console.error('[Templates] Error fetching templates:', error);
    res.status(500).json({
      error: 'Failed to fetch templates',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get single template
router.get('/:id', authenticateSession, async (req: AuthRequest, res: Response) => {
  try {
    const template = await TemplateManager.getTemplate(parseInt(req.params.id));
    res.json(template);
  } catch (error) {
    console.error('[Templates] Error fetching template:', error);
    res.status(500).json({
      error: 'Failed to fetch template',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create new template
router.post('/', authenticateSession, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { name, description, category, templateData } = req.body;

    if (!name || !description || !category) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'Name, description, and category are required'
      });
    }

    const template = await TemplateManager.createTemplate(
      name,
      description,
      category,
      templateData || { sections: [] },
      req.user.id
    );

    res.status(201).json(template);
  } catch (error) {
    console.error('[Templates] Error creating template:', error);
    res.status(500).json({
      error: 'Failed to create template',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update template
router.patch('/:id', authenticateSession, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const template = await TemplateManager.updateTemplate(
      parseInt(req.params.id),
      req.body,
      req.user.id
    );

    res.json(template);
  } catch (error) {
    console.error('[Templates] Error updating template:', error);
    res.status(500).json({
      error: 'Failed to update template',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Delete template (soft delete)
router.delete('/:id', authenticateSession, async (req: AuthRequest, res: Response) => {
  try {
    await TemplateManager.deleteTemplate(parseInt(req.params.id));
    res.status(204).send();
  } catch (error) {
    console.error('[Templates] Error deleting template:', error);
    res.status(500).json({
      error: 'Failed to delete template',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Preview template
router.post('/:id/preview', authenticateSession, async (req: AuthRequest, res: Response) => {
  try {
    const buffer = await TemplateManager.generatePreview(
      parseInt(req.params.id),
      req.body.previewData || {},
      { sampleData: true }
    );

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=template-preview-${req.params.id}.docx`);
    res.send(buffer);
  } catch (error) {
    console.error('[Templates] Error generating preview:', error);
    res.status(500).json({
      error: 'Failed to generate preview',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;