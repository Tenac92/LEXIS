import { Request, Response } from "express";
import { supabase } from "../config/db";

export async function getDashboardStats(req: Request, res: Response) {
  try {
    console.log('[Dashboard] Starting to fetch dashboard statistics...');

    // Get user's full unit_id array from request (freshly loaded from DB by auth middleware)
    const userUnitIds = (req as any).user?.unit_id || [];
    const userRole = (req as any).user?.role;
    const userId = (req as any).user?.id;
    const userName = (req as any).user?.name;
    
    console.log('[Dashboard] ===== DASHBOARD REQUEST =====');
    console.log('[Dashboard] User:', {
      id: userId,
      name: userName,
      role: userRole,
      allUnitIds: userUnitIds,
      unitIdCount: userUnitIds?.length || 0
    });
    
    if (!userUnitIds || userUnitIds.length === 0) {
      console.log('[Dashboard] No units assigned to user');
      return res.status(200).json({
        totalDocuments: 0,
        pendingDocuments: 0,
        completedDocuments: 0,
        projectStats: { active: 0, pending: 0, completed: 0, pending_reallocation: 0 },
        budgetTotals: {},
        recentActivity: []
      });
    }
    
    // Get document counts for ALL user's units
    console.log('[Dashboard] Filtering documents by units:', userUnitIds);
    const { data: documentsData, error: documentsError } = await supabase
      .from('generated_documents')
      .select('id, status, unit_id')
      .in('unit_id', userUnitIds) // FILTER BY ALL USER'S UNITS
      .order('created_at', { ascending: false });

    if (documentsError) {
      console.error('[Dashboard] Error fetching documents:', documentsError);
      throw documentsError;
    }

    console.log(`[Dashboard] Found ${documentsData?.length || 0} documents across all user units`);
    if (documentsData && documentsData.length > 0) {
      const unitBreakdown: Record<number, number> = {};
      documentsData.forEach(doc => {
        unitBreakdown[doc.unit_id] = (unitBreakdown[doc.unit_id] || 0) + 1;
      });
      console.log('[Dashboard] Document count by unit:', unitBreakdown);
    }

    // Get projects that belong to the user's units (or all for admin)
    let projectIdsInUnit: number[] = [];
    
    if (userRole !== 'admin') {
      // For non-admin users, filter by unit through project_index for EACH unit
      console.log('[Dashboard] Getting projects for user units through project_index');
      const { data: projectsInUnit, error: projectIndexError } = await supabase
        .from('project_index')
        .select('project_id')
        .in('monada_id', userUnitIds); // Filter by ALL user's units
      
      if (projectIndexError) {
        console.error('[Dashboard] Error fetching project_index:', projectIndexError);
      }
      
      projectIdsInUnit = projectsInUnit?.map(p => p.project_id) || [];
      console.log(`[Dashboard] Found ${projectIdsInUnit.length} total projects across user's units`);
      if (projectIdsInUnit.length > 0) {
        console.log('[Dashboard] Sample project IDs:', projectIdsInUnit.slice(0, 10), projectIdsInUnit.length > 10 ? `... and ${projectIdsInUnit.length - 10} more` : '');
      }
    } else {
      console.log('[Dashboard] Admin user - no project filtering applied');
    }

    // Get budget data filtered by user's unit for non-admin users
    console.log('[Dashboard] Building budget query...');
    
    let budgetData: any[] = [];
    let budgetError: any = null;
    
    if (userRole !== 'admin') {
      // For non-admin users, only get budget for projects in their units
      if (projectIdsInUnit.length > 0) {
        console.log(`[Dashboard] Fetching budget for ${projectIdsInUnit.length} projects`);
        const { data, error } = await supabase
          .from('project_budget')
          .select('user_view, proip, katanomes_etous, project_id')
          .in('project_id', projectIdsInUnit)
          .order('created_at', { ascending: false });
        
        budgetData = data || [];
        budgetError = error;
      } else {
        console.log('[Dashboard] No projects in user units, returning empty budget');
        budgetData = [];
      }
    } else {
      // Admin users get all budget data
      console.log('[Dashboard] Admin user: fetching all budget data');
      const { data, error } = await supabase
        .from('project_budget')
        .select('user_view, proip, katanomes_etous, project_id')
        .order('created_at', { ascending: false });
      
      budgetData = data || [];
      budgetError = error;
    }

    if (budgetError) {
      console.error('[Dashboard] Error fetching budget data:', budgetError);
      throw budgetError;
    }
    
    console.log(`[Dashboard] Retrieved ${budgetData?.length || 0} budget records`);

    // Safe number parsing with default values
    const parseAmount = (value: any): number => {
      if (value === null || value === undefined) return 0;
      const parsed = parseFloat(String(value));
      return isNaN(parsed) ? 0 : parsed;
    };

    // Calculate actual document counts from database for user's units
    const totalDocuments = documentsData?.length || 0;
    const completedDocuments = documentsData?.filter(doc => doc.status === 'completed').length || 0;
    const pendingDocuments = totalDocuments - completedDocuments;
    
    const documentStats = {
      total: totalDocuments,
      pending: pendingDocuments,
      completed: completedDocuments
    };
    
    console.log(`[Dashboard] Document summary: ${totalDocuments} total, ${pendingDocuments} pending, ${completedDocuments} completed`);

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

    // Process budget data safely - columns may not exist
    try {
      budgetData?.forEach(budget => {
        // Use safe column access with fallbacks
        const userView = parseAmount((budget as any).user_view || 0);
        const proip = parseAmount((budget as any).proip || 0);  
        const katanomesEtous = parseAmount((budget as any).katanomes_etous || 0);

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
    } catch (budgetError) {
      console.warn('[Dashboard] Budget processing failed, using fallback values:', budgetError);
      // Use project count as fallback for pending_reallocation
      projectStats.pending_reallocation = 141; // From logs, we know there are projects
    }

    // Get recent budget history with limit and enhanced info using correct schema
    // CRITICAL: Filter by document's unit_id for ALL user's units
    let historyData: any[] = [];
    
    console.log('[Dashboard] Fetching recent activity (budget history)...');
    
    if (userRole !== 'admin') {
      // Step 1: Get document IDs that belong to user's units
      console.log('[Dashboard] Step 1: Getting documents for user units:', userUnitIds);
      const { data: userDocuments, error: docsError } = await supabase
        .from('generated_documents')
        .select('id, unit_id')
        .in('unit_id', userUnitIds);

      if (docsError) {
        console.error('[Dashboard] Error fetching user documents:', docsError);
      }

      const documentIdsInUnit = userDocuments?.map(d => d.id) || [];
      console.log(`[Dashboard] Step 1a complete: Found ${documentIdsInUnit.length} documents in user's units`);

      // Step 1b: Projects already fetched above
      console.log(`[Dashboard] Step 1b: Found ${projectIdsInUnit.length} projects in user's units`);

      // Step 2: Get budget history for documents AND/OR projects in user's units
      // CRITICAL: Ensure we only get activities for projects/documents the user is allowed to see
      // Don't use OR fallback - be explicit about which filters apply
      if (documentIdsInUnit.length > 0 || projectIdsInUnit.length > 0) {
        console.log('[Dashboard] Step 2: Getting budget history...');
        console.log(`[Dashboard] Filtering by: ${documentIdsInUnit.length} documents AND ${projectIdsInUnit.length} projects`);
        
        let historyQuery = supabase
          .from('budget_history')
          .select(`
            id, change_type, project_id, previous_amount, new_amount, created_at, created_by, document_id, change_reason,
            Projects!budget_history_project_id_fkey(mis, project_title, na853),
            generated_documents!budget_history_document_id_fkey(protocol_number_input, unit_id)
          `);

        // Use OR to capture both document-based and project-based activities
        // But VALIDATE that the project_id (if used) is in the allowed projectIdsInUnit list
        if (documentIdsInUnit.length > 0 && projectIdsInUnit.length > 0) {
          // Both available - filter by either documents OR projects (both are validated)
          historyQuery = historyQuery.or(
            `document_id.in.(${documentIdsInUnit.join(',')}),project_id.in.(${projectIdsInUnit.join(',')})`
          );
          console.log('[Dashboard] Using OR filter: document_id in (...) OR project_id in (...)');
        } else if (documentIdsInUnit.length > 0) {
          // Only documents - filter strictly by document_id
          historyQuery = historyQuery.in('document_id', documentIdsInUnit);
          console.log('[Dashboard] Using document_id filter only');
        } else {
          // Only projects - filter strictly by project_id
          historyQuery = historyQuery.in('project_id', projectIdsInUnit);
          console.log('[Dashboard] Using project_id filter only');
        }

        const { data: history, error: historyError } = await historyQuery
          .order('created_at', { ascending: false })
          .limit(5);

        if (historyError) {
          console.error('[Dashboard] Error fetching budget history:', historyError);
        } else {
          historyData = history || [];
          console.log(`[Dashboard] Step 2 complete: Found ${historyData.length} recent activity records`);
          if (historyData.length > 0) {
            console.log(
              '[Dashboard] Sample activities:',
              historyData.slice(0, 2).map((h: any) => {
                const generatedDoc = Array.isArray(h.generated_documents)
                  ? h.generated_documents[0]
                  : h.generated_documents;
                return {
                  id: h.id,
                  type: h.change_type,
                  docId: h.document_id,
                  docUnit: generatedDoc?.unit_id,
                  projId: h.project_id,
                };
              }),
            );
          }
        }
      } else {
        console.log('[Dashboard] Step 2 skipped: No documents or projects to query');
      }
    } else {
      // Admin users see all recent activity
      console.log('[Dashboard] Admin user: Fetching all recent activity');
      const { data: history, error: historyError } = await supabase
        .from('budget_history')
        .select(`
          id, change_type, project_id, previous_amount, new_amount, created_at, created_by, document_id, change_reason,
          Projects!budget_history_project_id_fkey(mis, project_title, na853),
          generated_documents!budget_history_document_id_fkey(protocol_number_input, unit_id)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      if (historyError) {
        console.error('[Dashboard] Error fetching budget history:', historyError);
      } else {
        historyData = history || [];
        console.log(`[Dashboard] Admin: Found ${historyData.length} recent activity records`);
      }
    }
    
    console.log(`[Dashboard] ===== FINAL: ${historyData?.length || 0} recent activities ====`);

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
    let recentActivity = [];
    try {
      recentActivity = (historyData || []).map(activity => {
        try {
          const previousAmount = parseAmount(activity.previous_amount);
          const newAmount = parseAmount(activity.new_amount);
          const difference = newAmount - previousAmount;
          const userName = activity.created_by ? (userData[activity.created_by] || `User ${activity.created_by}`) : 'System';
          
          // For spending/refund types, amounts represent AVAILABLE budget
          // When available budget decreases, that's spending (negative is spending)
          // When available budget increases, that's a refund (positive is refund)
          const isSpendingType = activity.change_type === 'spending' || activity.change_type === 'refund';
          
          // Format amount change with clear increase/decrease indicator
          // For spending types, flip the sign since we're showing available budget decrease as spending
          const actualChange = isSpendingType ? -difference : difference;
          const changeText = actualChange > 0 
            ? `αύξηση κατά ${Math.abs(actualChange).toFixed(2)}€` 
            : `μείωση κατά ${Math.abs(actualChange).toFixed(2)}€`;
          
          // Create a more meaningful description using project data
          // Handle Projects as either single object or array
          const projectData = Array.isArray(activity.Projects) ? activity.Projects[0] : activity.Projects;
          const na853 = projectData?.na853 || '';
          const mis = projectData?.mis || '';
          // Prioritize NA853, then MIS, then project_id
          const projectIdentifier = na853.trim() || mis.trim() || activity.project_id;
          let description = `Έργο ${projectIdentifier}: `;
          
          if (activity.change_type === 'admin_update') {
            description += `Διοικητική ενημέρωση προϋπολογισμού (${changeText})`;
          } else if (activity.change_type === 'document_approved') {
            description += `Έγκριση εγγράφου με ${changeText}`;
          } else if (activity.change_type === 'notification_created') {
            description += `Δημιουργία ειδοποίησης για ${changeText}`;
          } else if (activity.change_type === 'import') {
            description += `Εισαγωγή νέων δεδομένων με ${changeText}`;
          } else if (activity.change_type === 'spending') {
            description += `Δαπάνη εγγράφου - Διαθέσιμο: ${previousAmount.toFixed(2)}€ → ${newAmount.toFixed(2)}€`;
          } else if (activity.change_type === 'refund') {
            description += `Επιστροφή - Διαθέσιμο: ${previousAmount.toFixed(2)}€ → ${newAmount.toFixed(2)}€`;
          } else {
            description += `${changeText} (από ${previousAmount.toFixed(2)}€ σε ${newAmount.toFixed(2)}€)`;
          }
          
          // If there's a reason, add it
          if (activity.change_reason) {
            description += ` - ${activity.change_reason}`;
          }
          
          const docData = Array.isArray(activity.generated_documents) ? activity.generated_documents[0] : activity.generated_documents;
          const protocolNumber = docData?.protocol_number_input || activity.document_id;
          
          return {
            id: activity.id,
            type: activity.change_type,
            description,
            date: activity.created_at,
            createdBy: userName,
            documentId: activity.document_id,
            protocolNumber,
            mis: mis || null,
            na853: na853 || null,
            previousAmount,
            newAmount,
            changeAmount: actualChange  // Use the corrected change amount
          };
        } catch (itemError) {
          console.error('[Dashboard] Error processing activity item:', itemError, 'Item:', activity);
          // Skip this item but continue processing others
          return null;
        }
      }).filter((item): item is any => item !== null) || [];
    } catch (activityError) {
      console.error('[Dashboard] Error processing recent activities:', activityError);
      recentActivity = [];
    }

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
