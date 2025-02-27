import { Request, Response } from "express";
import { supabase } from "../config/db";

export async function getDashboardStats(req: Request, res: Response) {
  try {
    console.log('[Dashboard] Starting to fetch dashboard statistics...');

    // Get document counts from the generated_documents table
    console.log('[Dashboard] Attempting to fetch documents data...');
    const { data: documentsData, error: documentsError } = await supabase
      .from('generated_documents')
      .select('status');

    if (documentsError) {
      console.error('[Dashboard] Error fetching documents:', documentsError);
      throw documentsError;
    }

    // Get budget data from budget_na853_split table
    console.log('[Dashboard] Attempting to fetch budget data...');
    const { data: budgetData, error: budgetError } = await supabase
      .from('budget_na853_split')
      .select('*');

    if (budgetError) {
      console.error('[Dashboard] Error fetching budget data:', budgetError);
      throw budgetError;
    }

    console.log('[Dashboard] Successfully fetched data:', {
      documentsCount: documentsData?.length || 0,
      budgetDataCount: budgetData?.length || 0
    });

    try {
      // Calculate document totals
      const totalDocuments = documentsData?.length || 0;
      const pendingDocuments = documentsData?.filter(doc => 
        ['draft', 'pending'].includes(doc.status || '')
      ).length || 0;
      const completedDocuments = documentsData?.filter(doc => 
        doc.status === 'approved'
      ).length || 0;

      // Calculate budget statistics with safe number parsing
      const parseAmount = (value: any): number => {
        const parsed = parseFloat(value?.toString() || '0');
        return isNaN(parsed) ? 0 : parsed;
      };

      const projectStats = {
        active: budgetData?.filter(b => parseAmount(b.user_view) > 0).length || 0,
        pending: budgetData?.filter(b => parseAmount(b.user_view) === 0 && parseAmount(b.proip) > 0).length || 0,
        pending_reallocation: budgetData?.filter(b => parseAmount(b.katanomes_etous) > parseAmount(b.user_view)).length || 0,
        completed: budgetData?.filter(b => parseAmount(b.user_view) === parseAmount(b.katanomes_etous) && parseAmount(b.user_view) > 0).length || 0
      };

      // Calculate budget totals
      const budgetTotals = budgetData?.reduce((acc, budget) => {
        const userView = parseAmount(budget.user_view);
        const proip = parseAmount(budget.proip);
        const katanomesEtous = parseAmount(budget.katanomes_etous);

        let status = 'unknown';
        if (userView > 0) status = 'active';
        else if (userView === 0 && proip > 0) status = 'pending';
        else if (katanomesEtous > userView) status = 'pending_reallocation';
        else if (userView === katanomesEtous && userView > 0) status = 'completed';

        return {
          ...acc,
          [status]: (acc[status] || 0) + userView
        };
      }, {} as Record<string, number>) || {};

      // Get recent budget history
      console.log('[Dashboard] Attempting to fetch budget history...');
      const { data: historyData, error: historyError } = await supabase
        .from('budget_history')
        .select('id, change_type, mis, previous_amount, new_amount, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      if (historyError) {
        console.error('[Dashboard] Error fetching budget history:', historyError);
        throw historyError;
      }

      const recentActivity = historyData?.map(activity => ({
        id: activity.id,
        type: activity.change_type,
        description: `Project ${activity.mis}: Budget changed from ${activity.previous_amount} to ${activity.new_amount}`,
        date: activity.created_at
      })) || [];

      const response = {
        totalDocuments,
        pendingDocuments,
        completedDocuments,
        projectStats,
        budgetTotals,
        recentActivity
      };

      console.log('[Dashboard] Successfully compiled stats:', {
        documents: { total: totalDocuments, pending: pendingDocuments, completed: completedDocuments },
        projects: projectStats,
        budgets: Object.keys(budgetTotals)
      });

      res.json(response);

    } catch (calculationError) {
      console.error('[Dashboard] Error during statistics calculation:', calculationError);
      throw calculationError;
    }

  } catch (error) {
    console.error('[Dashboard] Unexpected error:', error);
    res.status(500).json({
      error: 'Internal server error while fetching dashboard statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}