import { Router } from 'express';
import { supabase } from '../config/db';
import { authenticateSession } from '../authentication';

const router = Router();

// Diagnostic endpoint to check beneficiary_payments data
router.get('/beneficiary-payments', authenticateSession, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('beneficiary_payments')
      .select(`
        *,
        beneficiaries (
          firstname,
          lastname, 
          afm
        ),
        generated_documents (
          protocol_number_input,
          total_amount
        )
      `)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('[Diagnostic] Error fetching beneficiary payments:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({
      total: data.length,
      payments: data
    });
  } catch (error) {
    console.error('[Diagnostic] Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test document creation with minimal data
router.post('/test-document', authenticateSession, async (req, res) => {
  try {
    const testPayload = {
      unit: "2",
      project_id: "29", // Known project ID
      expenditure_type: "1",
      recipients: [{
        firstname: "Τεστ",
        lastname: "Χρήστης", 
        fathername: "Πατέρας",
        afm: "123456789",
        amount: 500.00,
        installment: "ΤΡΙΜΗΝΟ 1",
        installments: ["ΤΡΙΜΗΝΟ 1"],
        installmentAmounts: { "ΤΡΙΜΗΝΟ 1": 500.00 }
      }],
      total_amount: 500.00,
      attachments: [],
      esdian_field1: "TEST001",
      esdian_field2: "TEST002"
    };

    console.log('[Diagnostic] Creating test document with payload:', testPayload);

    const response = await fetch('http://localhost:5173/api/documents/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': req.headers.cookie || ''
      },
      body: JSON.stringify(testPayload)
    });

    const result = await response.json();
    console.log('[Diagnostic] Test document creation result:', result);

    res.json({
      success: response.ok,
      status: response.status,
      result
    });
  } catch (error) {
    console.error('[Diagnostic] Test document creation error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

export default router;