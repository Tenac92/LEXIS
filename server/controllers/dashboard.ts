import { Request, Response } from "express";
import { supabase } from "../config/db";

export async function getDashboardStats(req: Request, res: Response) {
  try {
    console.log('[Dashboard] Fetching document statistics...');

    // Get document counts from the generated_documents table
    const { data: documentsData, error: documentsError } = await supabase
      .from('generated_documents')
      .select('status');

    if (documentsError) {
      console.error('[Dashboard] Error fetching documents:', documentsError);
      return res.status(500).json({
        error: 'Failed to fetch document statistics',
        details: documentsError.message
      });
    }

    console.log('[Dashboard] Fetching project statistics...');

    // Get project status counts
    const { data: projectsData, error: projectsError } = await supabase
      .from('projects')
      .select('status');

    if (projectsError) {
      console.error('[Dashboard] Error fetching projects:', projectsError);
      return res.status(500).json({
        error: 'Failed to fetch project statistics',
        details: projectsError.message
      });
    }

    // Calculate document totals
    const totalDocuments = documentsData?.length || 0;
    const pendingDocuments = documentsData?.filter(doc => doc.status === 'pending').length || 0;
    const completedDocuments = documentsData?.filter(doc => doc.status === 'completed').length || 0;

    // Calculate project status totals
    const projectStats = {
      active: projectsData?.filter(proj => proj.status === 'active').length || 0,
      pending: projectsData?.filter(proj => proj.status === 'pending').length || 0,
      pending_reallocation: projectsData?.filter(proj => proj.status === 'pending_reallocation').length || 0,
      completed: projectsData?.filter(proj => proj.status === 'completed').length || 0
    };

    console.log('[Dashboard] Fetching recent activity...');

    // Get recent activity
    const { data: recentActivity, error: activityError } = await supabase
      .from('activity_log')
      .select('id,type,description,created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (activityError) {
      console.error('[Dashboard] Error fetching recent activity:', activityError);
      // Don't fail the whole request if activity log fails
    }

    const response = {
      totalDocuments,
      pendingDocuments,
      completedDocuments,
      projectStats,
      recentActivity: recentActivity?.map(activity => ({
        id: activity.id,
        type: activity.type,
        description: activity.description,
        date: activity.created_at
      })) || []
    };

    console.log('[Dashboard] Returning stats:', response);
    res.json(response);

  } catch (error) {
    console.error('[Dashboard] Unexpected error:', error);
    res.status(500).json({
      error: 'Internal server error while fetching dashboard statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}