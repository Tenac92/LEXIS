// Custom hooks for project data fetching
import { useQuery } from '@tanstack/react-query';

export function useProjectData(mis: string | undefined) {
  return useQuery({
    queryKey: [`/api/projects/${mis}/complete`],
    enabled: !!mis,
    staleTime: 5 * 60 * 1000, // 5 minutes cache for project-specific data
    gcTime: 15 * 60 * 1000, // 15 minutes cache retention
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

export function useReferenceData() {
  return useQuery({
    queryKey: ['/api/projects/reference-data'],
    staleTime: 60 * 60 * 1000, // 1 hour cache for reference data
    gcTime: 4 * 60 * 60 * 1000, // 4 hours cache retention
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

export function useGeographicData() {
  return useQuery({
    queryKey: ['/api/geographic-data'],
    staleTime: 60 * 60 * 1000, // 1 hour cache for geographic data
    gcTime: 4 * 60 * 60 * 1000, // 4 hours cache retention
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}