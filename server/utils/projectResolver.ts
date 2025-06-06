/**
 * Project Resolver Utility
 * Handles project identification using id, mis, or na853 codes
 * Provides a unified interface for project lookups across the application
 */

import { supabase } from '../data';

export interface ProjectIdentifier {
  id: number;
  mis?: number;
  na853: string;
  event_description: string;
  project_title?: string;
}

/**
 * Resolves a project identifier (id, mis, or na853) to a full project record
 * @param identifier - Can be project id, legacy mis, or na853 code
 * @returns Project data or null if not found
 */
export async function resolveProject(identifier: string | number): Promise<ProjectIdentifier | null> {
  try {
    const identifierStr = String(identifier);
    
    // Pattern to detect project codes like "2024ΝΑ85300001"
    const projectCodePattern = /^\d{4}[\u0370-\u03FF\u1F00-\u1FFF]+\d+$/;
    const isNumeric = /^\d+$/.test(identifierStr);

    let query = supabase
      .from('Projects')
      .select('id, mis, na853, event_description, project_title')
      .limit(1);

    // Case 1: Direct project ID lookup
    if (isNumeric) {
      const numericId = parseInt(identifierStr);
      query = query.eq('id', numericId);
      
      const { data, error } = await query.single();
      if (!error && data) {
        return data;
      }
      
      // Fallback: try legacy MIS lookup
      query = supabase
        .from('Projects')
        .select('id, mis, na853, event_description, project_title')
        .eq('mis', numericId)
        .limit(1);
        
      const { data: misData, error: misError } = await query.single();
      if (!misError && misData) {
        return misData;
      }
    }
    
    // Case 2: NA853 project code lookup
    if (projectCodePattern.test(identifierStr)) {
      query = supabase
        .from('Projects')
        .select('id, mis, na853, event_description, project_title')
        .eq('na853', identifierStr)
        .limit(1);
        
      const { data, error } = await query.single();
      if (!error && data) {
        return data;
      }
    }
    
    // Case 3: Event description lookup
    query = supabase
      .from('Projects')
      .select('id, mis, na853, event_description, project_title')
      .eq('event_description', identifierStr)
      .limit(1);
      
    const { data, error } = await query.single();
    if (!error && data) {
      return data;
    }

    console.log(`[ProjectResolver] No project found for identifier: ${identifier}`);
    return null;
    
  } catch (error) {
    console.error(`[ProjectResolver] Error resolving project ${identifier}:`, error);
    return null;
  }
}

/**
 * Gets project ID from any identifier
 * @param identifier - Can be project id, legacy mis, or na853 code
 * @returns Project ID or null if not found
 */
export async function getProjectId(identifier: string | number): Promise<number | null> {
  const project = await resolveProject(identifier);
  return project?.id || null;
}

/**
 * Gets project NA853 code from any identifier
 * @param identifier - Can be project id, legacy mis, or na853 code
 * @returns NA853 code or null if not found
 */
export async function getProjectNA853(identifier: string | number): Promise<string | null> {
  const project = await resolveProject(identifier);
  return project?.na853 || null;
}

/**
 * Validates if a project exists
 * @param identifier - Can be project id, legacy mis, or na853 code
 * @returns True if project exists, false otherwise
 */
export async function projectExists(identifier: string | number): Promise<boolean> {
  const project = await resolveProject(identifier);
  return project !== null;
}

/**
 * Batch resolve multiple project identifiers
 * @param identifiers - Array of project identifiers
 * @returns Map of identifier to project data
 */
export async function batchResolveProjects(identifiers: (string | number)[]): Promise<Map<string | number, ProjectIdentifier | null>> {
  const results = new Map<string | number, ProjectIdentifier | null>();
  
  // Process in batches to avoid overwhelming the database
  const batchSize = 50;
  for (let i = 0; i < identifiers.length; i += batchSize) {
    const batch = identifiers.slice(i, i + batchSize);
    const promises = batch.map(async (id) => {
      const project = await resolveProject(id);
      return { id, project };
    });
    
    const batchResults = await Promise.all(promises);
    batchResults.forEach(({ id, project }) => {
      results.set(id, project);
    });
  }
  
  return results;
}