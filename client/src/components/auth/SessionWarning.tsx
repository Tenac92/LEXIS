import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

let sessionTimeoutId: number | undefined;
const SESSION_WARNING_THRESHOLD = 23 * 60 * 60 * 1000; // 23 hours in milliseconds

/**
 * Component that displays session expiration warnings
 * Shows a dialog when the session is close to expiring
 */
export function SessionWarning() {
  const [showWarning, setShowWarning] = useState(false);
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    // Only start the warning timer if the user is logged in
    if (user) {
      // Clear any existing timeout
      if (sessionTimeoutId) {
        clearTimeout(sessionTimeoutId);
      }

      // Set timeout to show warning before session expires
      sessionTimeoutId = window.setTimeout(() => {
        setShowWarning(true);
      }, SESSION_WARNING_THRESHOLD);

      return () => {
        if (sessionTimeoutId) {
          clearTimeout(sessionTimeoutId);
        }
      };
    }
  }, [user]);

  const handleStayLoggedIn = async () => {
    try {
      // Make a request to the server to refresh the session
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      });
      
      if (response.ok) {
        setShowWarning(false);
        toast({
          title: "Session Extended",
          description: "Your session has been refreshed successfully."
        });
        
        // Reset the warning timer
        if (sessionTimeoutId) {
          clearTimeout(sessionTimeoutId);
        }
        sessionTimeoutId = window.setTimeout(() => {
          setShowWarning(true);
        }, SESSION_WARNING_THRESHOLD);
      } else {
        throw new Error('Failed to refresh session');
      }
    } catch (error) {
      console.error('Error refreshing session:', error);
      toast({
        title: 'Session Error',
        description: 'Unable to extend your session. Please log in again.',
        variant: 'destructive',
      });
      setLocation('/auth');
    }
  };

  const handleLogout = () => {
    // Redirect to the login page
    setLocation('/auth');
  };

  if (!showWarning) return null;

  return (
    <Dialog open={showWarning} onOpenChange={setShowWarning}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Session Expiring Soon</DialogTitle>
          <DialogDescription>
            Your session is about to expire due to inactivity. Would you like to stay logged in?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={handleLogout}>
            Log Out
          </Button>
          <Button onClick={handleStayLoggedIn}>
            Stay Logged In
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}