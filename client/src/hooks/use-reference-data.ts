import { useQuery } from '@tanstack/react-query';

/**
 * Hook to fetch and cache reference data with aggressive caching
 * This data changes rarely so we can cache it for long periods
 */
export function useReferenceData() {
  return useQuery({
    queryKey: ['/api/projects/reference-data'],
    staleTime: 60 * 60 * 1000, // 1 hour cache
    gcTime: 4 * 60 * 60 * 1000, // 4 hours cache retention
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}

// Type for reference data response
type ReferenceData = {
  eventTypes: Array<{ id: number; name: string }>;
  units: Array<{ id: number; unit?: string; name?: string }>;
  kallikratis: Array<{ 
    id: number; 
    perifereia: string; 
    perifereiaki_enotita: string; 
    onoma_neou_ota: string; 
    level?: string; 
  }>;
  expenditureTypes: Array<{ id: number; expenditure_types: string }>;
};

/**
 * Hook to get specific reference data types with fallbacks
 */
export function useReferenceDataTypes() {
  const { data: referenceData, isLoading, error } = useReferenceData();
  
  const typedData = referenceData as ReferenceData | undefined;
  
  return {
    eventTypes: typedData?.eventTypes || [],
    units: typedData?.units || [],
    kallikratis: typedData?.kallikratis || [],
    expenditureTypes: typedData?.expenditureTypes || [],
    isLoading,
    error,
    hasData: !!typedData
  };
}