import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
  units: string[];
  department?: string;
  telephone?: number;
  details?: {
    gender?: string;
    specialty?: string;
  };
}

export interface AuthResponse {
  authenticated: boolean;
  user?: AuthUser;
  message?: string;
}

export function useOptimizedAuth() {
  const queryClient = useQueryClient();
  const lastRefreshRef = useRef<number>(0);
  const refreshInProgressRef = useRef<boolean>(false);

  // Optimized user query with aggressive caching
  const { data: authData, isLoading, error, refetch } = useQuery<AuthResponse>({
    queryKey: ['/api/auth/me'],
    staleTime: 10 * 60 * 1000, // 10 minutes - increased from 5
    gcTime: 30 * 60 * 1000,    // 30 minutes - keep data longer
    refetchOnWindowFocus: false, // Disable automatic refocus refetch
    refetchOnMount: false,       // Don't refetch on every mount
    retry: (failureCount, error: any) => {
      // Only retry on network errors, not auth failures
      if (error?.status === 401 || error?.status === 403) {
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
  });

  // Throttled refresh function to prevent spam
  const refreshUser = useCallback(async () => {
    const now = Date.now();
    
    // Throttle refresh calls to max once per 30 seconds
    if (now - lastRefreshRef.current < 30000 || refreshInProgressRef.current) {
      return authData;
    }

    refreshInProgressRef.current = true;
    lastRefreshRef.current = now;

    try {
      const result = await refetch();
      return result.data;
    } catch (error) {
      console.error('[OptimizedAuth] Refresh failed:', error);
      return null;
    } finally {
      refreshInProgressRef.current = false;
    }
  }, [refetch, authData]);

  // Manual session invalidation
  const invalidateSession = useCallback(() => {
    queryClient.removeQueries({ queryKey: ['/api/auth/me'] });
    lastRefreshRef.current = 0;
    refreshInProgressRef.current = false;
  }, [queryClient]);

  // Check if user is authenticated
  const isAuthenticated = authData?.authenticated ?? false;
  
  // Get user data
  const user = authData?.user ?? null;

  // Role checking utilities
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager' || user?.role === 'admin';

  return {
    user,
    isAuthenticated,
    isAdmin,
    isManager,
    isLoading,
    error,
    refreshUser,
    invalidateSession
  };
}