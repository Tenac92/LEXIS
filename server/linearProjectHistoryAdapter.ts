/**
 * Linear Project History Adapter
 * 
 * Adapter that works with the linearized project_history table structure
 * providing simplified access to project history data
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

export interface LinearProjectHistory {
  id: number;
  project_id: number;
  created_at: string;
  
  // Core fields (now at top level)
  implementing_agency_location: string;
  event_year: number;
  enumeration_code: string;
  inclusion_year: number;
  summary_description: string;
  expenses_executed: number;
  project_status: string;
  
  // Simplified decisions (flattened)
  decisions: {
    protocol_number?: string;
    fek?: string;
    ada?: string;
    budget_decision?: string;
    funding_decision?: string;
  };
  
  // Simplified formulation (linear structure)
  formulation: {
    project_title: string;
    project_description: string;
    event_description: string;
    budget_na853: number;
    budget_na271: number;
    budget_e069: number;
    na853_code: string;
    mis_code: number;
    event_year: string;
    status: string;
    inclusion_year: string;
  };
}

/**
 * Get project history with simplified linear access
 */
export async function getLinearProjectHistory(projectId: number, limit = 50) {
  console.log(`[LinearHistory] Fetching history for project ${projectId}`);
  
  const { data, error } = await supabase
    .from('project_history')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit);
    
  if (error) {
    console.error('[LinearHistory] Error fetching history:', error);
    throw error;
  }
  
  console.log(`[LinearHistory] Found ${data.length} history entries`);
  return data as LinearProjectHistory[];
}

/**
 * Create simplified project history entry
 */
export async function createLinearHistoryEntry(projectData: any, changeType: string = 'UPDATE') {
  console.log(`[LinearHistory] Creating entry for project ${projectData.id}: ${changeType}`);
  
  const historyEntry = {
    project_id: projectData.id,
    created_at: new Date().toISOString(),
    
    // Core fields at top level
    implementing_agency_location: projectData.event_description || 'Project Update',
    event_year: Array.isArray(projectData.event_year) ? 
      parseInt(projectData.event_year[0]) : parseInt(projectData.event_year) || new Date().getFullYear(),
    enumeration_code: projectData.na853 || projectData.enumeration_code,
    inclusion_year: parseInt(projectData.event_year?.[0]) || new Date().getFullYear(),
    summary_description: projectData.event_description || projectData.project_title?.substring(0, 100),
    expenses_executed: projectData.budget_na853 || 0,
    project_status: projectData.status || 'active',
    
    // Simplified decisions structure
    decisions: {
      protocol_number: null,
      fek: null,
      ada: null,
      budget_decision: null,
      funding_decision: null
    },
    
    // Simplified formulation structure
    formulation: {
      project_title: projectData.project_title,
      project_description: projectData.event_description,
      event_description: projectData.event_description,
      budget_na853: projectData.budget_na853 || 0,
      budget_na271: projectData.budget_na271 || 0,
      budget_e069: projectData.budget_e069 || 0,
      na853_code: projectData.na853,
      mis_code: projectData.mis || 0,
      event_year: Array.isArray(projectData.event_year) ? 
        projectData.event_year[0] : projectData.event_year || new Date().getFullYear().toString(),
      status: projectData.status || 'active',
      inclusion_year: (Array.isArray(projectData.event_year) ? 
        projectData.event_year[0] : projectData.event_year || new Date().getFullYear()).toString()
    },
    
    expenditure_types: null,
    event_name: null,
    previous_entries: null,
    changes: null
  };
  
  const { data, error } = await supabase
    .from('project_history')
    .insert([historyEntry])
    .select()
    .single();
    
  if (error) {
    console.error('[LinearHistory] Error creating entry:', error);
    throw error;
  }
  
  console.log(`[LinearHistory] Created entry with ID: ${data.id}`);
  return data;
}

/**
 * Get project summary from linearized history
 */
export async function getProjectSummaryFromHistory(projectId: number) {
  const history = await getLinearProjectHistory(projectId, 1);
  
  if (history.length === 0) {
    return null;
  }
  
  const latest = history[0];
  
  return {
    project_id: latest.project_id,
    title: latest.formulation?.project_title,
    description: latest.formulation?.event_description,
    status: latest.project_status,
    budget_na853: latest.formulation?.budget_na853,
    budget_na271: latest.formulation?.budget_na271,
    budget_e069: latest.formulation?.budget_e069,
    na853_code: latest.formulation?.na853_code,
    event_year: latest.event_year,
    expenses_executed: latest.expenses_executed,
    protocol_number: latest.decisions?.protocol_number,
    fek: latest.decisions?.fek,
    last_updated: latest.created_at
  };
}

/**
 * Search project history with linear access
 */
export async function searchLinearProjectHistory(searchTerm: string, limit = 20) {
  console.log(`[LinearHistory] Searching for: ${searchTerm}`);
  
  // Since we can't use full-text search easily, we'll search in the key fields
  const { data, error } = await supabase
    .from('project_history')
    .select('*')
    .or(`summary_description.ilike.%${searchTerm}%,enumeration_code.ilike.%${searchTerm}%`)
    .order('created_at', { ascending: false })
    .limit(limit);
    
  if (error) {
    console.error('[LinearHistory] Error searching:', error);
    throw error;
  }
  
  console.log(`[LinearHistory] Found ${data.length} matching entries`);
  return data as LinearProjectHistory[];
}

/**
 * Get project history statistics
 */
export async function getLinearHistoryStats() {
  const { data, error } = await supabase
    .from('project_history')
    .select('project_id, created_at, project_status, expenses_executed');
    
  if (error) {
    console.error('[LinearHistory] Error getting stats:', error);
    throw error;
  }
  
  const stats = {
    total_entries: data.length,
    unique_projects: new Set(data.map(entry => entry.project_id)).size,
    total_expenses: data.reduce((sum, entry) => sum + (entry.expenses_executed || 0), 0),
    active_projects: data.filter(entry => entry.project_status === 'active').length,
    latest_update: data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]?.created_at
  };
  
  return stats;
}