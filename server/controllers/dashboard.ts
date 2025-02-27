import { Request, Response } from "express";
import { supabase } from "../config/db";

export async function getDashboardStats(req: Request, res: Response) {
  try {
    // Get document counts from the generated_documents table
    const { data: documentsData, error: documentsError } = await supabase
      .from('generated_documents')
      .select('status', { count: 'exact' });

    if (documentsError) {
      console.error('Error fetching documents:', documentsError);
      return res.status(500).json({
        error: 'Failed to fetch document statistics'
      });
    }

    // Get project status counts
    const { data: projectsData, error: projectsError } = await supabase
      .from('projects')
      .select('status', { count: 'exact' });

    if (projectsError) {
      console.error('Error fetching projects:', projectsError);
      return res.status(500).json({
        error: 'Failed to fetch project statistics'
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

    // Get recent activity
    const { data: recentActivity, error: activityError } = await supabase
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (activityError) {
      console.error('Error fetching recent activity:', activityError);
    }

    res.json({
      totalDocuments,
      pendingDocuments,
      completedDocuments,
      projectStats,
      recentActivity: recentActivity || []
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      error: 'Internal server error while fetching dashboard statistics'
    });
  }
}