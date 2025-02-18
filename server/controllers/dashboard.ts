import { Request, Response } from "express";
import { supabase } from "../config/db";

export async function getDashboardStats(req: Request, res: Response) {
  try {
    // Get document counts from the documents table
    const { data: documentsData, error: documentsError } = await supabase
      .from('documents')
      .select('status', { count: 'exact' });

    if (documentsError) {
      // If table doesn't exist or other error, return empty stats
      console.error('Error fetching documents:', documentsError);
      return res.json({
        totalDocuments: 0,
        pendingDocuments: 0,
        completedDocuments: 0
      });
    }

    // Calculate totals
    const totalDocuments = documentsData?.length || 0;
    const pendingDocuments = documentsData?.filter(doc => doc.status === 'pending').length || 0;
    const completedDocuments = documentsData?.filter(doc => doc.status === 'completed').length || 0;

    res.json({
      totalDocuments,
      pendingDocuments,
      completedDocuments
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    // Return empty stats instead of error to prevent UI from showing error state
    res.json({
      totalDocuments: 0,
      pendingDocuments: 0,
      completedDocuments: 0
    });
  }
}