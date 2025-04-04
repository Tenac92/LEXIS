import { Request, Response, Router } from 'express';
import { supabase } from '../config/db';
import { DocumentFormatter } from '../utils/DocumentFormatter';
import JSZip from 'jszip';

export const documentExportRouter = Router();

export async function exportDocument(req: Request, res: Response) {
  try {
    const { id } = req.params;
    console.log('Starting document export for ID:', id);

    // Validate ID
    if (!id || isNaN(parseInt(id))) {
      console.error('Invalid document ID:', id);
      return res.status(400).json({ message: 'Invalid document ID' });
    }

    // Fetch document with recipients
    const { data: document, error: docError } = await supabase
      .from('generated_documents')
      .select('*, recipients')
      .eq('id', parseInt(id))
      .single();

    if (docError) {
      console.error('Database query error:', docError);
      return res.status(500).json({ 
        message: 'Error fetching document',
        details: docError.message
      });
    }

    if (!document) {
      console.error('Document not found:', id);
      return res.status(404).json({ message: 'Document not found' });
    }

    // Validate document data
    if (!document.unit || !document.recipients || !Array.isArray(document.recipients)) {
      console.error('Invalid document data:', {
        id: document.id,
        hasUnit: Boolean(document.unit),
        hasRecipients: Boolean(document.recipients),
        recipientsIsArray: Array.isArray(document.recipients)
      });
      return res.status(400).json({ message: 'Invalid document data' });
    }

    // Check format parameter if user wants a ZIP file with both documents
    const format = req.query.format as string;
    const generateBoth = format === 'both' || format === 'zip';
    console.log('Export format:', format, 'generateBoth:', generateBoth);

    // Generate primary document buffer
    console.log('Generating primary document...');
    const primaryBuffer = await DocumentFormatter.generateDocument(document);

    if (!primaryBuffer || primaryBuffer.length === 0) {
      console.error('Generated empty buffer for primary document:', id);
      return res.status(500).json({ message: 'Failed to generate primary document content' });
    }

    // If user wants only the primary document (default behavior)
    if (!generateBoth) {
      // Set proper headers for Word document
      const filename = `document-${document.id.toString().padStart(6, '0')}.docx`;
      console.log('Sending primary document:', filename, 'Size:', primaryBuffer.length);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      res.setHeader('Content-Length', primaryBuffer.length);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      // Send primary buffer
      res.end(primaryBuffer);
      console.log('Primary document sent successfully');
      return;
    }

    // If we're here, user wants both documents in a zip
    console.log('Generating secondary document...');
    try {
      const secondaryBuffer = await DocumentFormatter.generateSecondDocument(document);
      if (!secondaryBuffer || secondaryBuffer.length === 0) {
        console.error('Generated empty buffer for secondary document:', id);
        return res.status(500).json({ message: 'Failed to generate secondary document content' });
      }

      // Create a new ZIP archive
      const zip = new JSZip();
      
      // Add both documents to the zip file
      zip.file(`document-primary-${document.id.toString().padStart(6, '0')}.docx`, primaryBuffer);
      zip.file(`document-supplementary-${document.id.toString().padStart(6, '0')}.docx`, secondaryBuffer);
      
      // Generate zip file
      console.log('Generating ZIP file...');
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      
      // Verify zip content
      console.log('ZIP file generation complete. File structure:');
      const zipContent = Object.keys(zip.files);
      console.log('ZIP contains files:', zipContent);
      
      // Set proper headers for ZIP file
      const zipFilename = `documents-${document.id.toString().padStart(6, '0')}.zip`;
      console.log('Sending ZIP archive with both documents:', zipFilename, 'Size:', zipBuffer.length, 'bytes');
      
      // Clear any previous headers that might interfere
      res.removeHeader('Content-Type');
      res.removeHeader('Content-Disposition');
      res.removeHeader('Content-Length');
      
      // Set proper headers for ZIP file download
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(zipFilename)}"`);
      res.setHeader('Content-Length', zipBuffer.length);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      // Log all response headers for debugging
      console.log('Response headers:', res.getHeaders());
      
      // Send zip buffer
      console.log('Sending zip buffer now...');
      res.end(zipBuffer);
      console.log('ZIP file with both documents sent successfully');
    } catch (secondaryDocError) {
      console.error('Error generating secondary document:', secondaryDocError);
      res.status(500).json({
        message: 'Failed to generate secondary document',
        details: secondaryDocError instanceof Error ? secondaryDocError.message : 'Unknown error'
      });
    }

  } catch (error) {
    console.error('Document export error:', error);
    res.status(500).json({
      message: 'Failed to generate document',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Test endpoint
documentExportRouter.get('/:id/test', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    console.log('Testing document generation for ID:', id);

    const { data: document } = await supabase
      .from('generated_documents')
      .select('*, recipients')
      .eq('id', parseInt(id))
      .single();

    if (!document) {
      return res.json({ 
        success: false, 
        message: 'Document not found' 
      });
    }

    // Validate document data
    const validation = {
      hasUnit: Boolean(document.unit),
      hasRecipients: Boolean(document.recipients),
      recipientsIsArray: Array.isArray(document.recipients),
      recipientCount: Array.isArray(document.recipients) ? document.recipients.length : 0
    };

    res.json({
      success: true,
      validation,
      document: {
        id: document.id,
        unit: document.unit,
        expenditureType: document.expenditure_type
      }
    });

  } catch (error) {
    console.error('Document test error:', error);
    res.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Export endpoint
documentExportRouter.get('/:id/export', exportDocument);

export default documentExportRouter;