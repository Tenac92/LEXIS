import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { supabase } from '../config/db';
import { BudgetService } from '../services/budgetService';

const router = Router();

// Get available MIS and NA853 combinations
router.get('/records', authenticateToken, async (req, res) => {
  try {
    console.log('[Budget] Fetching available MIS and NA853 combinations');

    const { data, error } = await supabase
      .from('budget_na853_split')
      .select('mis, na853')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Budget] Error fetching records:', error);
      return res.status(500).json({ 
        status: 'error',
        message: 'Failed to fetch budget records',
        details: error.message
      });
    }

    if (!data) {
      return res.json([]);
    }

    console.log(`[Budget] Successfully fetched ${data.length} records`);
    return res.json({
      status: 'success',
      data: data.map(record => ({
        mis: record.mis,
        na853: record.na853
      }))
    });

  } catch (error) {
    console.error('[Budget] Unexpected error:', error);
    return res.status(500).json({ 
      status: 'error',
      message: 'Failed to fetch budget records',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get budget history with pagination
router.get('/history', authenticateToken, async (req, res) => {
  try {
    console.log('[Budget] Fetching budget history');

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    // Get total count for pagination
    const { count } = await supabase
      .from('budget_history')
      .select('*', { count: 'exact', head: true });

    // Get paginated data with joins for user information
    const { data, error } = await supabase
      .from('budget_history')
      .select(`
        id,
        mis,
        previous_amount,
        new_amount,
        change_type,
        change_reason,
        document_id,
        created_by,
        created_at,
        metadata,
        users(name),
        generated_documents(id, status)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[Budget] Error fetching history:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to fetch budget history',
        details: error.message
      });
    }

    // Format the response data
    const formattedData = data?.map(entry => ({
      id: entry.id,
      mis: entry.mis,
      previous_amount: entry.previous_amount,
      new_amount: entry.new_amount,
      change_type: entry.change_type,
      change_reason: entry.change_reason,
      document_id: entry.document_id,
      document_status: entry.generated_documents?.[0]?.status,
      created_by: entry.users?.name || 'System',
      created_at: entry.created_at,
      metadata: entry.metadata
    }));

    return res.json({
      status: 'success',
      data: formattedData,
      pagination: {
        total: count,
        page,
        limit,
        pages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error) {
    console.error('[Budget] History fetch error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch budget history',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get budget notifications
router.get('/notifications', authenticateToken, async (req, res) => {
  try {
    console.log('[Budget] Fetching budget notifications');
    
    const { data, error } = await supabase
      .from('budget_notifications')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error('[Budget] Error fetching notifications:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to fetch notifications',
        details: error.message
      });
    }
    
    if (!data) {
      return res.json([]);
    }
    
    return res.json(data);
    
  } catch (error) {
    console.error('[Budget] Notifications fetch error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch budget data',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.put('/bulk-update', authenticateToken, async (req, res) => {
  try {
    console.log('[Budget] Starting bulk update for budget_na853_split');

    const { updates } = req.body;

    if (!Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        message: 'Updates must be an array'
      });
    }

    // Process each update sequentially
    for (const update of updates) {
      const { mis, na853, data } = update;

      if (!mis || !na853) {
        throw new Error(`Invalid update data: missing mis or na853`);
      }

      // Validate MIS and NA853 combination exists
      const { data: existing, error: checkError } = await supabase
        .from('budget_na853_split')
        .select('id')
        .eq('mis', mis)
        .eq('na853', na853)
        .single();

      if (checkError || !existing) {
        throw new Error(`Budget split record not found for MIS ${mis} and NA853 ${na853}`);
      }

      // Update the budget split record
      const { error: updateError } = await supabase
        .from('budget_na853_split')
        .update({
          ethsia_pistosi: data.ethsia_pistosi,
          q1: data.q1,
          q2: data.q2,
          q3: data.q3,
          q4: data.q4,
          katanomes_etous: data.katanomes_etous,
          user_view: data.user_view,
          updated_at: new Date().toISOString()
        })
        .eq('mis', mis)
        .eq('na853', na853);

      if (updateError) {
        throw new Error(`Failed to update budget split for MIS ${mis}: ${updateError.message}`);
      }

      console.log(`[Budget] Successfully updated budget split for MIS ${mis}`);
    }

    res.json({ 
      success: true, 
      message: `Successfully updated ${updates.length} budget splits` 
    });
  } catch (error) {
    console.error('[Budget] Bulk update error:', error);
    res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Failed to process bulk update' 
    });
  }
});

export default router;