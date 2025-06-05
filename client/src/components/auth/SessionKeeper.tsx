import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { queryClient } from '@/lib/queryClient';
import { SessionWarning } from './SessionWarning';
import { useWebSocketUpdates } from '@/hooks/use-websocket-updates';

// Optimized interval settings to reduce API calls
const REFRESH_INTERVAL = 15 * 60 * 1000; // Refresh session every 15 minutes (reduced frequency)
const ACTIVITY_TIMEOUT = 5 * 60 * 1000; // Check for user activity every 5 minutes (reduced frequency)
const EXPIRATION_WARNING_TIME = 10 * 60 * 1000; // Show warning 10 minutes before session expires

export function SessionKeeper() {
  const auth = useAuth();
  const { toast } = useToast();
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const lastActivityRef = useRef(Date.now());
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const activityCheckRef = useRef<NodeJS.Timeout | null>(null);
  const websocket = useWebSocketUpdates();
  
  // Set up session refresh on regular intervals
  useEffect(() => {
    if (!auth.user) return;
    
    // Clear any existing intervals
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }
    
    // Setup regular session refresh
    refreshIntervalRef.current = setInterval(async () => {
      console.log('[SessionKeeper] Refreshing session at regular interval');
      try {
        await auth.refreshUser();
        // Also reconnect WebSocket if it's disconnected
        websocket.connect();
      } catch (error) {
        console.error('[SessionKeeper] Failed to refresh session', error);
      }
    }, REFRESH_INTERVAL);
    
    // Cleanup on unmount
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [auth.user, auth.refreshUser, websocket]);
  
  // Track user activity
  useEffect(() => {
    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    
    const handleActivity = () => {
      // Update the last activity timestamp
      lastActivityRef.current = Date.now();
      
      // If there's a warning showing, refresh user to check if session is still valid
      if (showWarning) {
        setTimeout(() => {
          auth.refreshUser().then((refreshedUser) => {
            if (refreshedUser) {
              setShowWarning(false);
            }
          });
        }, 1000);
      }
    };
    
    // Add activity listeners
    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity);
    });
    
    // Set up activity-based session refresh
    if (activityCheckRef.current) {
      clearInterval(activityCheckRef.current);
    }
    
    // Check for user activity and refresh session if active (less frequently during logout)
    activityCheckRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityRef.current;
      
      // Only refresh if user exists and has been active recently, with throttling
      if (auth.user && timeSinceLastActivity < ACTIVITY_TIMEOUT && timeSinceLastActivity > 60000) {
        // Throttle refresh calls to prevent spam
        setTimeout(() => {
          auth.refreshUser().catch((err) => {
            if (auth.user) {
              console.error('[SessionKeeper] Error refreshing session after activity', err);
            }
          });
        }, 2000);
      }
    }, ACTIVITY_TIMEOUT * 3); // Further reduce frequency
    
    // Cleanup
    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      
      if (activityCheckRef.current) {
        clearInterval(activityCheckRef.current);
      }
    };
  }, [auth.user, auth.refreshUser, showWarning]);
  
  // Effect for tab visibility changes
  useEffect(() => {
    if (!auth.user) return;
    
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log('[SessionKeeper] Tab now visible, checking session');
        try {
          // Force a fresh check of the user when tab becomes visible
          await queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
          auth.refreshUser();
        } catch (error) {
          console.error('[SessionKeeper] Failed to check session on visibility change', error);
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [auth.user, auth.refreshUser]);
  
  // Handle extend session action
  const handleExtendSession = async () => {
    console.log('[SessionKeeper] Manually extending session');
    try {
      await auth.refreshUser();
      setShowWarning(false);
      
      toast({
        title: 'Session Extended',
        description: 'Your session has been refreshed successfully.',
      });
      
      // Reset warning timeout
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
        warningTimeoutRef.current = null;
      }
    } catch (error) {
      console.error('[SessionKeeper] Failed to extend session', error);
      
      toast({
        title: 'Session Expired',
        description: 'Your session has expired. Please log in again.',
        variant: 'destructive',
      });
      
      auth.logout();
    }
  };
  
  // Handle logout action from session warning
  const handleLogout = () => {
    auth.logout();
    setShowWarning(false);
  };
  
  return (
    <>
      {showWarning && (
        <SessionWarning 
          timeRemaining={timeRemaining} 
          onExtend={handleExtendSession} 
          onLogout={handleLogout} 
        />
      )}
    </>
  );
}