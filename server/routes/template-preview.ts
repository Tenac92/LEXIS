import { Router, Request, Response } from 'express';
import { TemplateManager } from '../utils/TemplateManager';

const router = Router();

router.post('/preview', async (req: Request, res: Response) => {
  try {
    const { templateId, previewData } = req.body;

    if (!templateId) {
      return res.status(400).json({ message: 'Template ID is required' });
    }

    const buffer = await TemplateManager.generatePreview(
      templateId,
      previewData || {},
      { watermark: true }
    );

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=template-preview.docx`);
    res.send(buffer);
  } catch (error) {
    console.error('Template preview error:', error);
    res.status(500).json({
      message: 'Failed to generate template preview',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
