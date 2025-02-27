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

    // Get project status counts from projects table
    console.log('[Dashboard] Attempting to fetch projects data...');
    const { data: projectsData, error: projectsError } = await supabase
      .from('projects')
      .select('status, budget_na853');

    if (projectsError) {
      console.error('[Dashboard] Error fetching projects:', projectsError);
      throw projectsError;
    }

    // Calculate document totals based on actual status values in schema
    const totalDocuments = documentsData?.length || 0;
    const pendingDocuments = documentsData?.filter(doc => 
      ['draft', 'pending'].includes(doc.status || '')
    ).length || 0;
    const completedDocuments = documentsData?.filter(doc => 
      doc.status === 'approved'
    ).length || 0;

    // Calculate project status totals with correct status values from schema
    const projectStats = {
      active: projectsData?.filter(proj => proj.status === 'active').length || 0,
      pending: projectsData?.filter(proj => 
        ['pending', 'pending_funding'].includes(proj.status || '')
      ).length || 0,
      pending_reallocation: projectsData?.filter(proj => 
        proj.status === 'pending_reallocation'
      ).length || 0,
      completed: projectsData?.filter(proj => proj.status === 'completed').length || 0
    };

    // Calculate total budget values for projects
    const budgetTotals = projectsData?.reduce((acc, proj) => {
      const budget = parseFloat(proj.budget_na853 || '0');
      const status = proj.status || 'unknown';
      return {
        ...acc,
        [status]: (acc[status] || 0) + budget
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