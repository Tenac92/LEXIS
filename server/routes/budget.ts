import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { supabase } from '../db';

const router = Router();

router.put('/bulk-update', authenticateToken, async (req, res) => {
  try {
    console.log('[Budget] Starting bulk update for budget splits');

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
