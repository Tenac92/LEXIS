import { useEffect, useRef } from 'react';
import { useAuth } from './use-auth';
import { queryClient } from '@/lib/queryClient';

interface SessionKeepaliveOptions {
  interval?: number; // How often to check session in milliseconds (default: 5 minutes)
  onSessionExpired?: () => void; // Callback when session is detected as expired
}

/**
 * Hook to keep the user session alive by periodically checking and refreshing auth status
 */
export function useSessionKeepalive(options: SessionKeepaliveOptions = {}) {
  const { interval = 5 * 60 * 1000, onSessionExpired } = options;
  const { user } = useAuth();
  const timerRef = useRef<number>();
  
  // Function to check and refresh the session
  const refreshSession = async () => {
    try {
      // Force a refetch of the user data
      await queryClient.refetchQueries({ queryKey: ['/api/auth/me'] });
      
      // Check if the session is still valid after the refresh
      const userData = queryClient.getQueryData(['/api/auth/me']);
      
      if (!userData && user) {
        console.warn('Session appears to have expired');
        // Session was lost, call the callback if provided
        onSessionExpired?.();
      }
    } catch (error) {
      console.error('Error refreshing session:', error);
    }
  };
  
  useEffect(() => {
    // Set up the interval for session refresh
    timerRef.current = window.setInterval(refreshSession, interval);
    
    // Clean up the interval on unmount
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
    };
  }, [interval, onSessionExpired, user]);
  
  // Return a function to manually refresh the session if needed
  return { refreshSession };
}