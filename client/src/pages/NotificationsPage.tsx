import { useEffect, useState } from 'react';
import { NotificationCenter } from '@/components/NotificationCenter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import type { User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { RotateCw, Bell, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Header } from '@/components/header';

export const NotificationsPage = () => {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [roleCheckAttempts, setRoleCheckAttempts] = useState(0);
  const [isConfirmingRole, setIsConfirmingRole] = useState(false);
  const [needsFinalCheck, setNeedsFinalCheck] = useState(false);
  const [showAccessDenied, setShowAccessDenied] = useState(false);

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
  
  const handleRefresh = () => {
    // Invalidate both notification endpoints to ensure consistency
    queryClient.invalidateQueries({ queryKey: ['/api/budget/notifications'] });
    queryClient.invalidateQueries({ queryKey: ['/api/budget-notifications/admin'] });
    toast({
      title: "Refreshing",
      description: "Updating notifications...",
    });
  };

  // Double-check that the user is actually not an admin to avoid false redirects
  const isUserAdmin = user?.role?.toLowerCase() === 'admin';
  
  // Effect for final redirect after exceeding max attempts - with additional safety checks
  useEffect(() => {
    // Logging for extra visibility during debugging
    console.log('[NotificationsPage] Role check advanced state:', {
      userRole: user?.role,
      lowercaseRole: user?.role?.toLowerCase(),
      isAdmin: isUserAdmin,
      attempts: roleCheckAttempts,
      hasUser: !!user,
      showingAccessDenied: showAccessDenied
    });
    
    // Only redirect if it's absolutely certain the user is not an admin
    if (!isUserAdmin && roleCheckAttempts >= 3 && !showAccessDenied) {
      console.log('[NotificationsPage] Redirecting to home after exhausting all checks');
      setShowAccessDenied(true);
      
      // Delay the redirect slightly to show the access denied message
      const timeoutId = setTimeout(() => {
        // Final safety check before redirect
        if (!isUserAdmin) {
          console.log('[NotificationsPage] Confirmed non-admin status, redirecting...');
          setLocation('/');
        } else {
          console.log('[NotificationsPage] Found admin status, canceling redirect');
          setShowAccessDenied(false);
        }
      }, 2000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [user?.role, isUserAdmin, roleCheckAttempts, showAccessDenied, setLocation]);
  
  // Main effect to check user role and authentication
  useEffect(() => {
    console.log('[NotificationsPage] User state:', {
      user,
      userLoading,
      role: user?.role,
      isAdmin: isUserAdmin,
      attempts: roleCheckAttempts
    });
    
    if (!userLoading) {
      if (!user) {
        console.log('[NotificationsPage] No user found, redirecting to auth');
        setLocation('/auth');
      } else if (!isUserAdmin) {
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
              
              if (roleCheckAttempts >= 2) {
                setShowAccessDenied(true);
                
                // Final safety check before setting up the redirect
                setTimeout(() => {
                  // Get the latest user data directly from the query cache
                  const cachedUser = queryClient.getQueryData<User>(['/api/auth/me']);
                  const isCachedUserAdmin = cachedUser?.role?.toLowerCase() === 'admin';
                  
                  if (!isCachedUserAdmin) {
                    setLocation('/');
                  } else {
                    console.log('[NotificationsPage] Found admin in cache, canceling redirect');
                    setShowAccessDenied(false);
                  }
                }, 2000);
              }
            } else {
              console.log('[NotificationsPage] Admin access confirmed after refresh');
              // Force a re-render
              queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
            }
          }, 500);
          
          return () => clearTimeout(timeoutId);
        }
      } else if (isUserAdmin) {
        console.log('[NotificationsPage] Admin access confirmed directly');
      }
    }
  }, [user, userLoading, isUserAdmin, roleCheckAttempts, isConfirmingRole, setLocation, toast, queryClient]);

  // Effect for handling the final check of admin status
  useEffect(() => {
    // Only run this effect when needsFinalCheck is true
    if (needsFinalCheck && !isUserAdmin && roleCheckAttempts < 3) {
      console.log('[NotificationsPage] Secondary role check failed, attempting final refresh:', user?.role);
      
      // Increment the attempt counter
      setRoleCheckAttempts(prev => prev + 1);
      
      // Reset the flag
      setNeedsFinalCheck(false);
      
      // Perform the refresh
      refreshUserData().then(isAdmin => {
        if (!isAdmin) {
          console.log('[NotificationsPage] Final refresh confirms non-admin status');
          
          if (roleCheckAttempts >= 2) {
            setShowAccessDenied(true);
            
            // Final safety check before setting up the redirect
            setTimeout(() => {
              // Get the latest user data directly from the query cache
              const cachedUser = queryClient.getQueryData<User>(['/api/auth/me']);
              const isCachedUserAdmin = cachedUser?.role?.toLowerCase() === 'admin';
              
              if (!isCachedUserAdmin) {
                setLocation('/');
              } else {
                console.log('[NotificationsPage] Found admin in cache, canceling redirect');
                setShowAccessDenied(false);
              }
            }, 2000);
          }
        } else {
          console.log('[NotificationsPage] Admin status confirmed after final refresh');
          // Force a re-render
          queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
        }
      });
    }
  }, [needsFinalCheck, isUserAdmin, roleCheckAttempts, refreshUserData, setLocation, queryClient]);
  
  // Effect to trigger final check when needed
  useEffect(() => {
    // If user exists but is not admin, and we haven't tried too many times yet
    if (user && !isUserAdmin && roleCheckAttempts < 3 && !needsFinalCheck && !isConfirmingRole) {
      console.log('[NotificationsPage] Setting up final admin check via effect');
      setNeedsFinalCheck(true);
    }
  }, [user, isUserAdmin, roleCheckAttempts, needsFinalCheck, isConfirmingRole]);

  // Loading state
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

  // Authentication error state
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

  // Confirming role state
  if (isConfirmingRole) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto py-8">
          <Card className="w-full bg-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-center min-h-[40vh]">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="mt-4 text-muted-foreground">Verifying access privileges...</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  
  // Verifying admin role state
  if (!isUserAdmin && roleCheckAttempts < 3) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto py-8">
          <Card className="w-full bg-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-center min-h-[40vh]">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="mt-4 text-muted-foreground">Verifying access privileges...</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  
  // Access denied state - about to redirect
  if (showAccessDenied) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto py-8">
          <Card className="w-full bg-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-center min-h-[40vh]">
                <div className="text-center">
                  <div className="text-destructive mb-4">
                    <AlertTriangle className="h-8 w-8 mx-auto" />
                  </div>
                  <p className="font-medium text-destructive">Access Denied</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Redirecting to dashboard...
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  
  // Main content - only shown for admin users
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