import { useEffect, useState } from 'react';
import { NotificationCenter } from '@/components/NotificationCenter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import type { User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { RotateCw, Bell } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Header } from '@/components/header';

export const NotificationsPage = () => {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [roleCheckAttempts, setRoleCheckAttempts] = useState(0);
  const [isConfirmingRole, setIsConfirmingRole] = useState(false);

  // Check if user is authenticated and is admin
  const { data: user, isLoading: userLoading, error: userError } = useQuery<User>({
    queryKey: ['/api/auth/me'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });

        if (response.status === 401) {
          setLocation('/auth');
          throw new Error('Please log in to access notifications');
        }

        if (!response.ok) {
          throw new Error('Failed to fetch user data');
        }

        const data = await response.json();
        return data;
      } catch (error) {
        console.error('[Auth] Error fetching user:', error);
        throw error;
      }
    },
    retry: false,
    staleTime: 30000 // Cache for 30 seconds
  });

  // Add a function to manually refetch the user data
  const refreshUserData = async () => {
    setIsConfirmingRole(true);
    console.log('[NotificationsPage] Manually refreshing user data, attempt:', roleCheckAttempts + 1);
    
    try {
      // Force fresh data with a direct fetch bypassing the cache
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          console.log('[NotificationsPage] Auth refresh returned 401, redirecting to login');
          setLocation('/auth');
          return false;
        }
        console.error('[NotificationsPage] Failed to refresh user data:', response.status);
        return false;
      }
      
      const data = await response.json();
      console.log('[NotificationsPage] Refreshed user data:', data);
      
      // Manually update the React Query cache with the fresh data
      queryClient.setQueryData(['/api/auth/me'], data.user || data);
      
      // Return true if user is admin, false otherwise
      return data.user?.role === 'admin' || data.role === 'admin';
    } catch (error) {
      console.error('[NotificationsPage] Error refreshing user:', error);
      return false;
    } finally {
      setIsConfirmingRole(false);
    }
  };
  
  useEffect(() => {
    console.log('[NotificationsPage] User state:', {
      user,
      userLoading,
      role: user?.role,
      isAdmin: user?.role === 'admin',
      attempts: roleCheckAttempts
    });
    
    if (!userLoading) {
      if (!user) {
        console.log('[NotificationsPage] No user found, redirecting to auth');
        setLocation('/auth');
      } else if (user.role !== 'admin') {
        // If not admin and we haven't tried too many times, try refreshing user data
        if (roleCheckAttempts < 3 && !isConfirmingRole) {
          console.log('[NotificationsPage] Non-admin detected, attempting refresh:', user.role);
          
          // Increment the attempt counter
          setRoleCheckAttempts(prev => prev + 1);
          
          // Set a timeout to refresh the user data (to avoid infinite loops in useEffect)
          const timeoutId = setTimeout(async () => {
            const isAdmin = await refreshUserData();
            
            if (!isAdmin) {
              console.log('[NotificationsPage] Confirmed non-admin after refresh');
              toast({
                title: "Access Denied",
                description: "You need administrator privileges to access this page.",
                variant: "destructive"
              });
              setLocation('/');
            } else {
              console.log('[NotificationsPage] Admin access confirmed after refresh');
              // Force a re-render
              queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
            }
          }, 500);
          
          return () => clearTimeout(timeoutId);
        } else if (roleCheckAttempts >= 3) {
          // After multiple attempts, if still not admin, redirect
          console.log('[NotificationsPage] Multiple refresh attempts failed, redirecting');
          toast({
            title: "Access Denied",
            description: "You need administrator privileges to access this page.",
            variant: "destructive"
          });
          setLocation('/');
        }
      } else if (user.role === 'admin') {
        console.log('[NotificationsPage] Admin access confirmed directly');
      }
    }
  }, [user, userLoading, roleCheckAttempts, isConfirmingRole, setLocation, toast, queryClient]);

  const handleRefresh = () => {
    // Invalidate both notification endpoints to ensure consistency
    queryClient.invalidateQueries({ queryKey: ['/api/budget/notifications'] });
    queryClient.invalidateQueries({ queryKey: ['/api/budget-notifications/admin'] });
    toast({
      title: "Refreshing",
      description: "Updating notifications...",
    });
  };

  if (userLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto py-8">
          <Card className="w-full bg-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-center min-h-[40vh]">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="mt-4 text-muted-foreground">Loading...</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (userError || !user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto py-8">
          <Card className="w-full bg-card">
            <CardContent className="p-6">
              <div className="text-center text-destructive">
                <Bell className="h-12 w-12 mx-auto mb-4 text-destructive" />
                <p className="text-lg font-semibold">Authentication Required</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Please log in to view notifications
                </p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => setLocation('/auth')}
                >
                  Go to Login
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Only render the page content if user is admin
  // This check should never happen if our useEffect above works correctly
  // But we'll keep it for extra safety
  if (user?.role !== 'admin') {
    console.log('[NotificationsPage] Secondary role check failed:', user?.role);
    return null;
  }
  
  console.log('[NotificationsPage] Rendering notifications page for admin');

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Budget Notifications</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Monitor and manage budget-related notifications
            </p>
          </div>
          <Button 
            variant="outline"
            onClick={handleRefresh}
            className="flex items-center gap-2"
          >
            <RotateCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        <Card className="bg-card">
          <CardContent className="p-6">
            <NotificationCenter 
              onNotificationClick={(notification) => {
                toast({
                  title: `${notification.type.replace('_', ' ').toUpperCase()}`,
                  description: `${notification.reason}\nMIS: ${notification.mis} • Amount: €${notification.amount.toLocaleString()}`,
                  variant: notification.type === 'funding' ? 'destructive' : 'default'
                });
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NotificationsPage;