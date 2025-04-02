import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { useSessionKeepalive } from '@/hooks/use-session-keepalive';
import { ReactNode, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';

interface SessionKeeperProps {
  children: ReactNode;
  /**
   * What to do when a session expires - by default shows a toast and redirects to login
   */
  onSessionExpired?: () => void;
}

/**
 * Component that provides active session management, checks auth status periodically and
 * handles session expiration gracefully.
 */
export function SessionKeeper({ children, onSessionExpired }: SessionKeeperProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  // Default handler for session expiration
  const handleSessionExpired = () => {
    toast({
      title: "Session Expired",
      description: "Your session has expired. Please log in again.",
      variant: "destructive",
    });
    setLocation('/auth');
  };

  // Use the session keepalive hook
  useSessionKeepalive({
    onSessionExpired: onSessionExpired || handleSessionExpired,
  });

  // Add an additional listener for visibility changes (tab focus)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Refresh auth status when the tab becomes visible again
        if (user) {
          // Only attempt to refresh if we currently have a user
          // to avoid unnecessary redirects when already logged out
          setTimeout(() => {
            // This small delay prevents race conditions with other visibility handlers
            // that might be checking auth status simultaneously
            window.dispatchEvent(new Event('focus'));
          }, 100);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  return <>{children}</>;
}