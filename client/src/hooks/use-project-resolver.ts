/**
 * Project Resolver Hook
 * Frontend hook for resolving project identifiers to project data
 * Handles the transition from MIS-based to ID-based project identification
 */

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface ProjectData {
  id: number;
  mis?: number;
  na853: string;
  event_description: string;
  project_title?: string;
  expenditure_type?: string[];
  implementing_agency?: string[];
  region?: any;
  status?: string;
}

/**
 * Hook to resolve any project identifier to full project data
 */
export function useProjectResolver(identifier: string | number | null) {
  return useQuery({
    queryKey: ['project-resolver', identifier],
    queryFn: async (): Promise<ProjectData | null> => {
      if (!identifier) return null;
      
      try {
        const response = await apiRequest(`/api/projects/resolve/${encodeURIComponent(identifier)}`);
        return response as ProjectData;
      } catch (error) {
        console.error('Failed to resolve project:', error);
        return null;
      }
    },
    enabled: !!identifier,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to get project ID from any identifier
 */
export function useProjectId(identifier: string | number | null) {
  const { data: project } = useProjectResolver(identifier);
  return project?.id || null;
}

/**
 * Hook to get NA853 code from any identifier
 */
export function useProjectNA853(identifier: string | number | null) {
  const { data: project } = useProjectResolver(identifier);
  return project?.na853 || null;
}

/**
 * Hook to validate if a project exists
 */
export function useProjectExists(identifier: string | number | null) {
  const { data: project, isLoading } = useProjectResolver(identifier);
  return {
    exists: project !== null,
    isLoading,
    project
  };
}

/**
 * Utility function to format project display name
 */
export function formatProjectDisplay(project: ProjectData | null): string {
  if (!project) return '';
  
  // Primary display: NA853 + Event Description
  if (project.na853 && project.event_description) {
    return `${project.na853} - ${project.event_description}`;
  }
  
  // Fallback to NA853 only
  if (project.na853) {
    return project.na853;
  }
  
  // Last resort: event description
  return project.event_description || `Project ${project.id}`;
}

/**
 * Utility to get the primary identifier users should see
 */
export function getPrimaryProjectIdentifier(project: ProjectData | null): string {
  if (!project) return '';
  return project.na853 || project.event_description || String(project.id);
}