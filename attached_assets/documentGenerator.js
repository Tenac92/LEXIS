const { supabase } = require('../config/db.js');
const DocumentFormatter = require('../utils/documentFormatter');
const docx = require('docx');
const { Packer } = require('docx');
const getAuthToken = require('../utils/getAuthToken');


class DocumentGenerator {
  static async generateSingle(req, res) {
    try {
      const documentIds = req.params.id.split(',').filter(Boolean);
      if (!documentIds.length) {
        return res.status(400).json({ message: 'No valid document IDs provided' });
      }

      if (!documentIds.every(id => /^\d+$/.test(id))) {
        return res.status(400).json({ message: 'Invalid document ID format' });
      }

      const documents = await DocumentGenerator.fetchDocuments(documentIds, req); // Pass req object

      if (!documents) {
        return res.status(500).json({ message: 'Failed to fetch documents' });
      }

      if (documents.length === 0) {
        return res.status(404).json({ message: 'No documents found with provided IDs' });
      }

      if (documents.length !== documentIds.length) {
        return res.status(400).json({ 
          message: 'Some documents could not be found',
          foundIds: documents.map(d => d.id)
        });
      }

      if (!DocumentGenerator.validateDocuments(documents)) {
        return res.status(400).json({ message: 'Document data is incomplete' });
      }

      const existingDoc = await DocumentGenerator.checkExistingDocument(documents);
      if (existingDoc) {
        return res.status(409).json({ 
          message: 'Document already exists',
          existingDocId: existingDoc.id 
        });
      }

      await DocumentGenerator.processTransaction(req.user.id, documents, documentIds);
      const docBuffer = await DocumentGenerator.generateDocument(req, documents);

      DocumentGenerator.sendResponse(res, docBuffer);
    } catch (error) {
      console.error('Error generating document:', error);
      res.status(500).json({ 
        message: error.message || 'Failed to generate document',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  static async fetchDocuments(documentIds, req) { // Modified to accept req object
    const authToken = await getAuthToken(req); // Added auth token retrieval

    const { data, error } = await supabase
      .from('recipients')
      .select(`
        *,
        project_catalog:project_id (
          mis,
          na853,
          expenditure_type
        )
      `)
      .in('id', documentIds)
      .order('lastname')
      .auth(authToken); // Added authentication


    if (error) throw error;
    if (!data || !data.length) throw new Error('No documents found');

    // Ensure project_id and project_catalog data exists
    const invalidDocs = data.filter(doc => !doc.project_id || !doc.project_catalog);
    if (invalidDocs.length > 0) {
      throw new Error('Invalid project data in documents');
    }

    return data.map(doc => ({
      ...doc,
      project_id: doc.project_id,
      project_na853: doc.project_catalog?.na853,
      expenditure_type: doc.expenditure_type || doc.project_catalog?.expenditure_type
    }));
  }

  static validateDocuments(documents) {
    return documents.every(doc => 
      doc.firstname && doc.lastname && doc.amount && 
      doc.installment && doc.afm
    );
  }

  static async checkExistingDocument(documents) {
    const { data } = await supabase
      .from('generated_documents')
      .select('*')
      .eq('status', 'pending')
      .contains('recipients', documents)
      .single();

    return data;
  }

  static async processTransaction(userId, documents, documentIds) {
    try {
      const totalAmount = documents.reduce((sum, doc) => sum + parseFloat(doc.amount), 0);
      if (isNaN(totalAmount) || totalAmount <= 0) {
        throw new Error('Invalid total amount');
      }

      // Delete recipients first
      const { error: deleteError } = await supabase
        .from('recipients')
        .delete()
        .in('id', documentIds);

      if (deleteError) {
        console.error('Error deleting recipients:', deleteError);
        throw new Error('Failed to delete recipients');
      }

      const firstDoc = documents[0];
      if (!firstDoc) {
        throw new Error('No documents provided');
      }

      if (!firstDoc.project_id) {
        throw new Error('Project ID is required');
      }

      const projectId = firstDoc.project_id.toString();
      const isValid = documents.every(doc => 
        doc.project_id === firstDoc.project_id &&
        doc.expenditure_type === firstDoc.expenditure_type &&
        doc.unit === firstDoc.unit
      );

      if (!isValid) {
        throw new Error('All documents must have the same project, unit and expenditure type');
      }

      // Get project details for NA853
      const projectMis = firstDoc.project_id.split(':')[0];
      const { data: projectDetails } = await supabase
        .from('project_catalog')
        .select('na853, budget_na853')
        .eq('mis', projectMis)
        .single();

      const { error: docError } = await supabase
        .from('generated_documents')
        .insert({
          generated_by: userId,
          recipients: documents.map(doc => ({
            ...doc,
            unit: firstDoc.unit,
            project_na853: projectDetails?.na853
          })),
          total_amount: totalAmount,
          status: 'pending',
          created_at: new Date().toISOString(),
          project_id: projectMis,
          project_na853: projectDetails?.na853,
          expenditure_type: firstDoc.expenditure_type,
          unit: firstDoc.unit
        });

      if (docError) throw docError;


    } catch (error) {
      console.error('Transaction error:', error);
      throw error;
    }
  }

  static async generateDocument(req, documents, options = {}) {
    const { department, attachments, unitDetails } = options;
    const totalAmount = documents.reduce((sum, doc) => sum + parseFloat(doc.amount), 0);

    const doc = new docx.Document({
      sections: [{
        properties: {
          page: {
            ...DocumentFormatter.getDefaultMargins(),
            size: { width: 11906, height: 16838 },
            columns: { space: 708, count: 2 }
          }
        },
        children: [
          DocumentFormatter.createDocumentHeader(req),
          new docx.Paragraph({ text: '', spacing: { before: 240, after: 240 } }),
          DocumentFormatter.createHeader('ΠΙΝΑΚΑΣ ΔΙΚΑΙΟΥΧΩΝ ΣΤΕΓΑΣΤΙΚΗΣ ΣΥΝΔΡΟΜΗΣ'),
          new docx.Paragraph({ 
            children: [
              new docx.TextRun({ text: `Μονάδα: ${documents[0].unit || 'N/A'}`, bold: true }),
              new docx.TextRun({ text: `    NA853: ${documents[0].project_na853 || 'N/A'}`, bold: true })
            ],
            spacing: { before: 240, after: 240 }
          }),
          DocumentFormatter.createPaymentTable(documents),
          new docx.Paragraph({ text: '', spacing: { before: 300 } }),
          new docx.Paragraph({
            children: [
              new docx.TextRun({ text: 'ΣΥΝΟΛΟ: ', bold: true }),
              new docx.TextRun({ text: `${totalAmount.toFixed(2)}€` })
            ]
          }),
          new docx.Paragraph({ text: '', spacing: { before: 300 } }),
          DocumentFormatter.createDocumentFooter()
        ]
      }]
    });

    return Packer.toBuffer(doc);
  }

  static sendResponse(res, buffer) {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename=combined-documents.docx');
    res.send(buffer);
  }

  static async generateMultiple(req, res) {
    try {
      const { documentIds } = req.body;
      if (!documentIds || !Array.isArray(documentIds)) {
        return res.status(400).json({ message: 'Document IDs required' });
      }

      const { data: documents, error } = await supabase
        .from('documents')
        .select('*')
        .in('id', documentIds)
        .is('generated', false);

      if (error) throw error;

      await supabase
        .from('documents')
        .update({ generated: true })
        .in('id', documentIds);

      const doc = new docx.Document({
        sections: [{
          properties: {},
          children: documents.map(doc => [
            new docx.Paragraph({
              children: [new docx.TextRun({ text: `Document ID: ${doc.id}`, size: 24 })],
            }),
            new docx.Paragraph({
              children: [new docx.TextRun({ text: `Name: ${doc.firstname} ${doc.lastname}`, size: 24 })],
            }),
            new docx.Paragraph({
              children: [new docx.TextRun({ text: `AFM: ${doc.afm}`, size: 24 })],
            }),
            new docx.Paragraph({
              children: [new docx.TextRun({ text: `Amount: €${doc.amount}`, size: 24 })],
            }),
            new docx.Paragraph({ text: '-------------------' }),
          ]).flat(),
        }],
      });

      const buffer = await Packer.toBuffer(doc);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', 'attachment; filename=combined-documents.docx');
      res.send(buffer);
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ message: error.message });
    }
  }
}

module.exports = DocumentGenerator;