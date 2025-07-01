/**
 * Project History Utilities
 * Helper functions for working with the simplified linear project_history table
 */

import { supabase } from './supabaseClient.js';

export interface ProjectHistoryEntry {
  project_id: number;
  change_type: 'CREATE' | 'UPDATE' | 'STATUS_CHANGE' | 'BUDGET_CHANGE' | 'INITIAL';
  change_description?: string;
  changed_by?: number;
  
  // Core project fields
  project_title?: string;
  project_description?: string;
  event_description?: string;
  status?: string;
  
  // Financial data
  budget_na853?: number;
  budget_na271?: number;
  budget_e069?: number;
  
  // SA codes
  na853?: string;
  na271?: string;
  e069?: string;
  
  // Event info
  event_type_id?: number;
  event_year?: string;
  
  // Documents
  protocol_number?: string;
  fek?: string;
  ada?: string;
  
  // Location
  region?: string;
  regional_unit?: string;
  municipality?: string;
  
  // Implementation
  implementing_agency_id?: number;
  implementing_agency_name?: string;
  
  // Additional fields
  expenses_executed?: number;
  project_status?: string;
  enumeration_code?: string;
  inclusion_year?: number;
  summary_description?: string;
  change_comments?: string;
  
  // Previous state for comparison
  previous_status?: string;
  previous_budget_na853?: number;
  previous_budget_na271?: number;
  previous_budget_e069?: number;
}

/**
 * Create a new project history entry
 */
export async function createProjectHistoryEntry(entry: ProjectHistoryEntry) {
  console.log(`[ProjectHistory] Creating history entry for project ${entry.project_id}: ${entry.change_type}`);
  
  const { data, error } = await supabase
    .from('project_history')
    .insert([{
      ...entry,
      created_at: new Date().toISOString()
    }])
    .select()
    .single();
    
  if (error) {
    console.error('[ProjectHistory] Error creating history entry:', error);
    throw error;
  }
  
  console.log(`[ProjectHistory] Created history entry with ID: ${data.id}`);
  return data;
}

/**
 * Get project history entries for a specific project
 */
export async function getProjectHistory(projectId: number, limit = 50) {
  console.log(`[ProjectHistory] Fetching history for project ${projectId}`);
  
  const { data, error } = await supabase
    .from('project_history')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit);
    
  if (error) {
    console.error('[ProjectHistory] Error fetching history:', error);
    throw error;
  }
  
  console.log(`[ProjectHistory] Found ${data.length} history entries`);
  return data;
}

/**
 * Create history entry when project is updated
 */
export async function logProjectUpdate(
  projectId: number, 
  previousData: any, 
  newData: any, 
  changedBy?: number,
  changeDescription?: string
) {
  // Detect what changed
  const changes = [];
  
  if (previousData.status !== newData.status) {
    changes.push(`Status: ${previousData.status} → ${newData.status}`);
  }
  
  if (previousData.budget_na853 !== newData.budget_na853) {
    changes.push(`Budget NA853: ${previousData.budget_na853} → ${newData.budget_na853}`);
  }
  
  if (previousData.budget_na271 !== newData.budget_na271) {
    changes.push(`Budget NA271: ${previousData.budget_na271} → ${newData.budget_na271}`);
  }
  
  if (previousData.budget_e069 !== newData.budget_e069) {
    changes.push(`Budget E069: ${previousData.budget_e069} → ${newData.budget_e069}`);
  }
  
  if (previousData.project_title !== newData.project_title) {
    changes.push('Project title updated');
  }
  
  if (previousData.event_description !== newData.event_description) {
    changes.push('Project description updated');
  }
  
  // Determine change type
  let changeType: ProjectHistoryEntry['change_type'] = 'UPDATE';
  if (previousData.status !== newData.status) {
    changeType = 'STATUS_CHANGE';
  } else if (
    previousData.budget_na853 !== newData.budget_na853 ||
    previousData.budget_na271 !== newData.budget_na271 ||
    previousData.budget_e069 !== newData.budget_e069
  ) {
    changeType = 'BUDGET_CHANGE';
  }
  
  const historyEntry: ProjectHistoryEntry = {
    project_id: projectId,
    change_type: changeType,
    change_description: changeDescription || changes.join('; '),
    changed_by: changedBy,
    
    // Current state
    project_title: newData.project_title,
    project_description: newData.event_description,
    event_description: newData.event_description,
    status: newData.status,
    budget_na853: newData.budget_na853,
    budget_na271: newData.budget_na271,
    budget_e069: newData.budget_e069,
    na853: newData.na853,
    na271: newData.na271,
    e069: newData.e069,
    event_type_id: newData.event_type_id,
    event_year: Array.isArray(newData.event_year) ? JSON.stringify(newData.event_year) : newData.event_year,
    enumeration_code: newData.na853,
    
    // Previous state for comparison
    previous_status: previousData.status,
    previous_budget_na853: previousData.budget_na853,
    previous_budget_na271: previousData.budget_na271,
    previous_budget_e069: previousData.budget_e069,
  };
  
  return await createProjectHistoryEntry(historyEntry);
}

/**
 * Create initial history entry for new projects
 */
export async function createInitialProjectHistory(projectData: any, createdBy?: number) {
  const historyEntry: ProjectHistoryEntry = {
    project_id: projectData.id,
    change_type: 'CREATE',
    change_description: 'Project created',
    changed_by: createdBy,
    
    project_title: projectData.project_title,
    project_description: projectData.event_description,
    event_description: projectData.event_description,
    status: projectData.status,
    budget_na853: projectData.budget_na853,
    budget_na271: projectData.budget_na271,
    budget_e069: projectData.budget_e069,
    na853: projectData.na853,
    na271: projectData.na271,
    e069: projectData.e069,
    event_type_id: projectData.event_type_id,
    event_year: Array.isArray(projectData.event_year) ? JSON.stringify(projectData.event_year) : projectData.event_year,
    enumeration_code: projectData.na853,
  };
  
  return await createProjectHistoryEntry(historyEntry);
}

/**
 * Get latest history entry for a project (current state)
 */
export async function getLatestProjectHistory(projectId: number) {
  console.log(`[ProjectHistory] Fetching latest history for project ${projectId}`);
  
  const { data, error } = await supabase
    .from('project_history')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
    
  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
    console.error('[ProjectHistory] Error fetching latest history:', error);
    throw error;
  }
  
  return data;
}

/**
 * Get project history summary stats
 */
export async function getProjectHistoryStats(projectId: number) {
  const { data, error } = await supabase
    .from('project_history')
    .select('change_type, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error('[ProjectHistory] Error fetching history stats:', error);
    throw error;
  }
  
  const stats = {
    total_changes: data.length,
    create_date: data[data.length - 1]?.created_at,
    last_update: data[0]?.created_at,
    change_types: data.reduce((acc, entry) => {
      acc[entry.change_type] = (acc[entry.change_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  };
  
  return stats;
}