import { Request, Response } from "express";
import { supabase } from "../config/db";

export async function getDashboardStats(req: Request, res: Response) {
  try {
    console.log('[Dashboard] Starting to fetch dashboard statistics...');

    // Get document counts filtered by user's unit - SECURITY CRITICAL
    const userUnits = (req as any).user?.units || [];
    const primaryUnit = userUnits[0];
    
    if (!primaryUnit) {
      console.log('[Dashboard] No unit assigned to user');
      return res.status(200).json({
        totalDocuments: 0,
        pendingDocuments: 0,
        completedDocuments: 0,
        projectStats: { active: 0, pending: 0, completed: 0, pending_reallocation: 0 },
        budgetTotals: {},
        recentActivity: []
      });
    }
    
    const { data: documentsData, error: documentsError } = await supabase
      .from('generated_documents')
      .select('status, unit')
      .eq('unit', primaryUnit) // Only show documents from user's authorized unit
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

    // Calculate actual document counts from database for user's unit
    const totalDocuments = documentsData?.length || 0;
    const completedDocuments = documentsData?.filter(doc => doc.status === 'completed').length || 0;
    const pendingDocuments = totalDocuments - completedDocuments;
    
    const documentStats = {
      total: totalDocuments,
      pending: pendingDocuments,
      completed: completedDocuments
    };
    
    console.log(`[Dashboard] Unit ${primaryUnit}: ${totalDocuments} total, ${pendingDocuments} pending, ${completedDocuments} completed`);

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

    // Get recent budget history with limit and enhanced info
    const { data: historyData, error: historyError } = await supabase
      .from('budget_history')
      .select('id, change_type, mis, previous_amount, new_amount, created_at, created_by, document_id, change_reason')
      .order('created_at', { ascending: false })
      .limit(5);

    if (historyError) {
      console.error('[Dashboard] Error fetching budget history:', historyError);
      throw historyError;
    }

    // Get information about users for better activity display
    const userIds = historyData?.map(entry => entry.created_by).filter(Boolean) || [];
    let userData: Record<string, string> = {};
    
    if (userIds.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, name')
        .in('id', userIds);
        
      if (!usersError && users) {
        userData = users.reduce((acc: Record<string, string>, user) => {
          acc[user.id] = user.name;
          return acc;
        }, {});
      }
    }

    // Enhanced activity items with better descriptions and more details
    const recentActivity = historyData?.map(activity => {
      const previousAmount = parseAmount(activity.previous_amount);
      const newAmount = parseAmount(activity.new_amount);
      const difference = newAmount - previousAmount;
      const userName = activity.created_by ? (userData[activity.created_by] || `User ${activity.created_by}`) : 'System';
      
      // Format amount change with clear increase/decrease indicator
      const changeText = difference > 0 
        ? `αύξηση κατά ${Math.abs(difference).toFixed(2)}€` 
        : `μείωση κατά ${Math.abs(difference).toFixed(2)}€`;
      
      // Create a more meaningful description
      let description = `Έργο ${activity.mis}: `;
      
      if (activity.change_type === 'admin_update') {
        description += `Διοικητική ενημέρωση προϋπολογισμού (${changeText})`;
      } else if (activity.change_type === 'document_approved') {
        description += `Έγκριση εγγράφου με ${changeText}`;
      } else if (activity.change_type === 'notification_created') {
        description += `Δημιουργία ειδοποίησης για ${changeText}`;
      } else if (activity.change_type === 'import') {
        description += `Εισαγωγή νέων δεδομένων με ${changeText}`;
      } else {
        description += `${changeText} (από ${previousAmount.toFixed(2)}€ σε ${newAmount.toFixed(2)}€)`;
      }
      
      // If there's a reason, add it
      if (activity.change_reason) {
        description += ` - Αιτία: ${activity.change_reason}`;
      }
      
      return {
        id: activity.id,
        type: activity.change_type,
        description,
        date: activity.created_at,
        createdBy: userName,
        documentId: activity.document_id,
        mis: activity.mis,
        previousAmount,
        newAmount,
        changeAmount: difference
      };
    }) || [];

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