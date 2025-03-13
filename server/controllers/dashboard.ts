import { Request, Response } from "express";
import { supabase } from "../config/db";

export async function getDashboardStats(req: Request, res: Response) {
  try {
    console.log('[Dashboard] Starting to fetch dashboard statistics...');

    // Get document counts with single query
    const { data: documentsData, error: documentsError } = await supabase
      .from('generated_documents')
      .select('status')
      .order('created_at', { ascending: false });

    if (documentsError) {
      console.error('[Dashboard] Error fetching documents:', documentsError);
      throw documentsError;
    }

    // Get budget data with optimized query
    const { data: budgetData, error: budgetError } = await supabase
      .from('budget_na853_split')
      .select('user_view, proip, katanomes_etous')
      .order('created_at', { ascending: false });

    if (budgetError) {
      console.error('[Dashboard] Error fetching budget data:', budgetError);
      throw budgetError;
    }

    // Safe number parsing with default values
    const parseAmount = (value: any): number => {
      if (value === null || value === undefined) return 0;
      const parsed = parseFloat(String(value));
      return isNaN(parsed) ? 0 : parsed;
    };

    // Calculate document totals
    const documentStats = documentsData?.reduce((acc, doc) => ({
      total: acc.total + 1,
      pending: acc.pending + ((['draft', 'pending'].includes(doc.status || '')) ? 1 : 0),
      completed: acc.completed + ((doc.status === 'approved') ? 1 : 0)
    }), { total: 0, pending: 0, completed: 0 });

    // Calculate project stats with null safety
    const projectStats = {
      active: 0,
      pending: 0,
      pending_reallocation: 0,
      completed: 0
    };

    const budgetTotals: Record<string, number> = {
      active: 0,
      pending: 0,
      pending_reallocation: 0,
      completed: 0
    };

    // Single pass through budget data with improved status detection
    budgetData?.forEach(budget => {
      const userView = parseAmount(budget.user_view);
      const proip = parseAmount(budget.proip);
      const katanomesEtous = parseAmount(budget.katanomes_etous);

      // Determine project status with updated logic
      if (userView > 0 && katanomesEtous === 0) {
        // If there's active budget being used but no allocation yet
        projectStats.active++;
        budgetTotals.active += userView;
      } else if (katanomesEtous > 0 && Math.abs(katanomesEtous - userView) > 0.01) {
        // If there's any significant difference between allocated and used budget
        projectStats.pending_reallocation++;
        budgetTotals.pending_reallocation += katanomesEtous - userView;
      } else if (userView > 0 && Math.abs(katanomesEtous - userView) <= 0.01) {
        // If the project is fully allocated (with small tolerance for floating point)
        projectStats.completed++;
        budgetTotals.completed += userView;
      } else if (userView === 0 && proip > 0) {
        // If there's only provisional budget
        projectStats.pending++;
        budgetTotals.pending += proip;
      }
    });

    // Get recent budget history with limit
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
      description: `Project ${activity.mis}: Budget changed from ${
        parseAmount(activity.previous_amount).toFixed(2)
      } to ${
        parseAmount(activity.new_amount).toFixed(2)
      }`,
      date: activity.created_at
    })) || [];

    const response = {
      totalDocuments: documentStats?.total || 0,
      pendingDocuments: documentStats?.pending || 0,
      completedDocuments: documentStats?.completed || 0,
      projectStats,
      budgetTotals,
      recentActivity
    };

    console.log('[Dashboard] Successfully compiled stats:', {
      documents: documentStats,
      projects: projectStats,
      budgets: Object.keys(budgetTotals)
    });

    return res.json(response);

  } catch (error) {
    console.error('[Dashboard] Unexpected error:', error);
    return res.status(500).json({
      error: 'Internal server error while fetching dashboard statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}