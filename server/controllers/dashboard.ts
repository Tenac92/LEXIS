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

    // Calculate document totals based on actual status values
    const totalDocuments = documentsData?.length || 0;
    const pendingDocuments = documentsData?.filter(doc => 
      ['draft', 'pending'].includes(doc.status || '')
    ).length || 0;
    const completedDocuments = documentsData?.filter(doc => 
      doc.status === 'approved'
    ).length || 0;

    // Calculate budget statistics
    const projectStats = {
      active: budgetData?.filter(b => parseFloat(b.user_view?.toString() || '0') > 0).length || 0,
      pending: budgetData?.filter(b => parseFloat(b.user_view?.toString() || '0') === 0 && parseFloat(b.proip?.toString() || '0') > 0).length || 0,
      pending_reallocation: budgetData?.filter(b => parseFloat(b.katanomes_etous?.toString() || '0') > parseFloat(b.user_view?.toString() || '0')).length || 0,
      completed: budgetData?.filter(b => parseFloat(b.user_view?.toString() || '0') === parseFloat(b.katanomes_etous?.toString() || '0')).length || 0
    };

    // Calculate budget totals for different statuses
    const budgetTotals = budgetData?.reduce((acc, budget) => {
      const userView = parseFloat(budget.user_view?.toString() || '0');
      const proip = parseFloat(budget.proip?.toString() || '0');
      const katanomesEtous = parseFloat(budget.katanomes_etous?.toString() || '0');

      let status = 'unknown';
      if (userView > 0) status = 'active';
      else if (userView === 0 && proip > 0) status = 'pending';
      else if (katanomesEtous > userView) status = 'pending_reallocation';
      else if (userView === katanomesEtous) status = 'completed';

      return {
        ...acc,
        [status]: (acc[status] || 0) + userView
      };
    }, {} as Record<string, number>);

    // Get recent activity from budget_history
    let recentActivity = [];
    try {
      console.log('[Dashboard] Attempting to fetch recent activity...');
      const { data: activityData, error: activityError } = await supabase
        .from('budget_history')
        .select('id, change_type, mis, previous_amount, new_amount, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      if (!activityError && activityData) {
        recentActivity = activityData.map(activity => ({
          id: activity.id,
          type: activity.change_type,
          description: `Project ${activity.mis}: Budget changed from ${activity.previous_amount} to ${activity.new_amount}`,
          date: activity.created_at
        }));
      }
    } catch (activityError) {
      console.error('[Dashboard] Error fetching activity (non-critical):', activityError);
    }

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
      budgets: budgetTotals
    });

    res.json(response);

  } catch (error) {
    console.error('[Dashboard] Unexpected error:', error);
    res.status(500).json({
      error: 'Internal server error while fetching dashboard statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}