/**
 * Expenditure Types Hook
 * Provides access to expenditure types data with proper error handling
 */

import { useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';

export interface ExpenditureType {
  id: number;
  name: string;
  description?: string;
  category?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export const useExpenditureTypes = () => {
  return useQuery<ExpenditureType[]>({
    queryKey: ['/api/expenditure-types'],
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    meta: {
      errorMessage: 'Αποτυχία φόρτωσης τύπων δαπανών'
    }
  });
};

export const useExpenditureTypesForFilter = () => {
  return useQuery<ExpenditureType[]>({
    queryKey: ['/api/public/expenditure-types'],
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    meta: {
      errorMessage: 'Αποτυχία φόρτωσης τύπων δαπανών για φίλτρα'
    }
  });
};

// Invalidate expenditure types cache
export const invalidateExpenditureTypesCache = () => {
  queryClient.invalidateQueries({ queryKey: ['/api/expenditure-types'] });
  queryClient.invalidateQueries({ queryKey: ['/api/public/expenditure-types'] });
};

// Prefetch expenditure types
export const prefetchExpenditureTypes = () => {
  queryClient.prefetchQuery({
    queryKey: ['/api/expenditure-types'],
    staleTime: 30 * 60 * 1000
  });
};

export default useExpenditureTypes;