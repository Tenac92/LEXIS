import { useEffect, useRef, useState } from 'react';
import { useAuth } from './use-auth';
import { useToast } from './use-toast';
import { queryClient } from '@/lib/queryClient';

// Configuration for session management
const REFRESH_INTERVAL = 15 * 60 * 1000; // 15 minutes (increased from 5 to reduce lag)
const ACTIVITY_THRESHOLD = 3 * 60 * 1000; // 3 minutes of inactivity before we stop refreshing
const WARNING_THRESHOLD = 20 * 60 * 1000; // Show warning 20 minutes before expected session expiry
const MAX_SESSION_AGE = 8 * 60 * 60 * 1000; // 8 hours (this should match the server-side setting)

export interface SessionKeepaliveOptions {
  onSessionExpired?: () => void;
  enableWarnings?: boolean;
}

export function useSessionKeepalive(options: SessionKeepaliveOptions = {}) {
  const { 
    onSessionExpired, 
    enableWarnings = true 
  } = options;
  
  const { user, error, isLoading, refreshUser } = useAuth();
  const { toast } = useToast();
  const [isWarningVisible, setIsWarningVisible] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [sessionHealth, setSessionHealth] = useState<'active' | 'warning' | 'expired'>('active');
  
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const sessionStartRef = useRef<number>(Date.now());
  
  // Track user activity
  useEffect(() => {
    if (!user) return;
    
    // Events that indicate user activity
    const activityEvents = ['mousedown', 'keydown', 'mousemove', 'touchstart', 'scroll', 'click'];
    
    const handleUserActivity = () => {
      // Update the timestamp of the last user activity
      lastActivityRef.current = Date.now();
      
      // If a warning was showing, check if the session is still valid
      if (isWarningVisible) {
        refreshSession();
      }
    };
    
    // Add event listeners
    activityEvents.forEach(event => {
      window.addEventListener(event, handleUserActivity);
    });
    
    // Cleanup
    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleUserActivity);
      });
    };
  }, [user, isWarningVisible]);
  
  // Set up the automatic session refresh
  useEffect(() => {
    if (!user) return;
    
    // Reset session timers when user changes
    sessionStartRef.current = Date.now();
    
    // Clear any existing timers
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    
    // Set up regular session refresh
    refreshTimerRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityRef.current;
      
      // Only refresh if user has been active recently
      if (timeSinceLastActivity < ACTIVITY_THRESHOLD) {
        console.log('[SessionKeepalive] Refreshing session due to recent activity');
        refreshSession();
      } else {
        console.log('[SessionKeepalive] Skipping refresh, user inactive');
      }
      
      // Check if we're approaching session expiry
      const sessionAge = now - sessionStartRef.current;
      const timeToExpiry = MAX_SESSION_AGE - sessionAge;
      
      if (enableWarnings && timeToExpiry < WARNING_THRESHOLD && !isWarningVisible) {
        // Set up warning for upcoming session expiry
        setIsWarningVisible(true);
        setTimeRemaining(timeToExpiry);
        setSessionHealth('warning');
        
        // Show toast notification
        toast({
          title: 'Session Expiring Soon',
          description: 'Your session will expire soon. Please save your work.',
          variant: 'default',
          duration: 10000,
        });
      }
    }, REFRESH_INTERVAL);
    
    // Cleanup
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      
      if (warningTimerRef.current) {
        clearTimeout(warningTimerRef.current);
        warningTimerRef.current = null;
      }
    };
  }, [user, enableWarnings, toast, isWarningVisible]);
  
  // Handle page visibility changes
  useEffect(() => {
    if (!user) return;
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // When the tab becomes visible again, check session
        console.log('[SessionKeepalive] Tab visible, checking session');
        refreshSession();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);
  
  // Performance optimized refresh session function
  // Uses requestIdleCallback when available to minimize UI impact
  const refreshSession = async () => {
    // Check if we've refreshed recently (within the last minute) to prevent excessive refreshes
    const now = Date.now();
    const timeSinceLastRefresh = now - sessionStartRef.current;
    if (timeSinceLastRefresh < 60000) {
      // Skip refresh if we refreshed less than a minute ago
      return true;
    }
    
    // Use a debounced approach to reduce multiple rapid refreshes
    const refreshAction = async () => {
      try {
        // First update local state to avoid UI flicker
        setSessionHealth('active');
        
        // Then make the actual API call
        await queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
        const result = await refreshUser();
        
        if (result) {
          // Session is still valid
          setIsWarningVisible(false);
          
          // Reset the session start time to extend the effective session duration
          sessionStartRef.current = Date.now();
          return true;
        } else {
          // Session is invalid
          handleSessionExpiry();
          return false;
        }
      } catch (error) {
        console.error('[SessionKeepalive] Error refreshing session:', error);
        handleSessionExpiry();
        return false;
      }
    };
    
    // Use requestIdleCallback if available for better performance
    if (typeof window.requestIdleCallback === 'function') {
      return new Promise(resolve => {
        window.requestIdleCallback(() => {
          refreshAction().then(resolve);
        }, { timeout: 2000 }); // 2 second timeout to ensure it runs even if the system is busy
      });
    } else {
      // Fallback to setTimeout for browsers without requestIdleCallback
      return new Promise(resolve => {
        setTimeout(() => {
          refreshAction().then(resolve);
        }, 50); // Small delay to avoid blocking the main thread
      });
    }
  };
  
  // Handle session expiry
  const handleSessionExpiry = () => {
    setSessionHealth('expired');
    
    // Call the onSessionExpired callback if provided
    if (onSessionExpired) {
      onSessionExpired();
    }
    
    toast({
      title: 'Session Expired',
      description: 'Your session has expired. Please log in again.',
      variant: 'destructive',
    });
  };
  
  // Function to manually extend the session
  const extendSession = async () => {
    const success = await refreshSession();
    
    if (success) {
      toast({
        title: 'Session Extended',
        description: 'Your session has been extended successfully.',
      });
    }
    
    return success;
  };
  
  return {
    sessionHealth,
    isWarningVisible,
    timeRemaining,
    extendSession,
    refreshSession,
  };
}