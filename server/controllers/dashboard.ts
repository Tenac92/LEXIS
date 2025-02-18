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
    res.json({
      totalDocuments: 0,
      pendingDocuments: 0,
      completedDocuments: 0
    });
  }
}