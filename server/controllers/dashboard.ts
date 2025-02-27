import { Request, Response } from "express";
import { supabase } from "../config/db";

export async function getDashboardStats(req: Request, res: Response) {
  try {
    console.log('[Dashboard] Starting to fetch dashboard statistics...');

    // Initialize default response structure
    const defaultStats = {
      totalDocuments: 0,
      pendingDocuments: 0,
      completedDocuments: 0,
      projectStats: {
        active: 0,
        pending: 0,
        completed: 0,
        pending_reallocation: 0
      },
      recentActivity: []
    };

    // Get document counts from the generated_documents table
    console.log('[Dashboard] Attempting to fetch documents data...');
    const { data: documentsData, error: documentsError } = await supabase
      .from('generated_documents')
      .select('status');

    if (documentsError) {
      console.error('[Dashboard] Error fetching documents:', documentsError);
      return res.json(defaultStats); // Return default stats instead of error
    }

    // Get project status counts
    console.log('[Dashboard] Attempting to fetch projects data...');
    const { data: projectsData, error: projectsError } = await supabase
      .from('projects')
      .select('status');

    if (projectsError) {
      console.error('[Dashboard] Error fetching projects:', projectsError);
      return res.json(defaultStats); // Return default stats instead of error
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

    // Get recent activity - make this optional
    let recentActivity = [];
    try {
      console.log('[Dashboard] Attempting to fetch recent activity...');
      const { data: activityData, error: activityError } = await supabase
        .from('activity_log')
        .select('id,type,description,created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      if (!activityError && activityData) {
        recentActivity = activityData.map(activity => ({
          id: activity.id,
          type: activity.type,
          description: activity.description,
          date: activity.created_at
        }));
      }
    } catch (activityError) {
      console.error('[Dashboard] Error fetching activity (non-critical):', activityError);
      // Continue without activity data
    }

    const response = {
      totalDocuments,
      pendingDocuments,
      completedDocuments,
      projectStats,
      recentActivity
    };

    console.log('[Dashboard] Successfully compiled stats:', response);
    res.json(response);

  } catch (error) {
    console.error('[Dashboard] Unexpected error:', error);
    // Return default stats instead of error
    res.json({
      totalDocuments: 0,
      pendingDocuments: 0,
      completedDocuments: 0,
      projectStats: {
        active: 0,
        pending: 0,
        completed: 0,
        pending_reallocation: 0
      },
      recentActivity: []
    });
  }
}