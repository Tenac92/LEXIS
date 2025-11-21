import { useEffect, useState } from 'react';
import { NotificationCenter } from '@/components/NotificationCenter';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import type { User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { RotateCw, Bell, AlertTriangle, Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Header } from '@/components/header';

export const NotificationsPage = () => {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [accessChecked, setAccessChecked] = useState(false);
  
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
        console.log('[Auth] User data received:', data);
        return data;
      } catch (error) {
        console.error('[Auth] Error fetching user:', error);
        throw error;
      }
    },
    retry: 3,
    retryDelay: 1000,
    staleTime: 30000, // Cache for 30 seconds
    refetchOnWindowFocus: true
  });

  // Simple function to refresh the notifications list
  const handleRefresh = () => {
    // Invalidate both notification endpoints to ensure consistency
    queryClient.invalidateQueries({ queryKey: ['/api/budget/notifications'] });
    queryClient.invalidateQueries({ queryKey: ['/api/budget-notifications/admin'] });
    toast({
      title: "Refreshing",
      description: "Updating notifications...",
    });
  };

  // Mutation to create test notifications
  const createTestNotifications = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/budget-notifications/create-test', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to create test notifications');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Test notifications created successfully",
      });
      // Refresh notifications after creation
      handleRefresh();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create test notifications",
        variant: "destructive",
      });
    },
  });

  // Check admin access once when the user data is loaded
  useEffect(() => {
    if (!userLoading && user && !accessChecked) {
      const isAdmin = user.role?.toLowerCase() === 'admin';
      setAccessChecked(true);
      
      console.log('[NotificationsPage] Checking admin access:', {
        user,
        role: user.role,
        isAdmin,
      });
      
      if (!isAdmin) {
        console.log('[NotificationsPage] User is not an admin, redirecting to home');
        toast({
          title: "Access Denied",
          description: "You need administrator privileges to access this page.",
          variant: "destructive"
        });
        
        // Short delay to show the toast
        setTimeout(() => {
          setLocation('/');
        }, 1500);
      }
    }
  }, [user, userLoading, accessChecked, toast, setLocation]);

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

  // Admin access required
  if (user.role?.toLowerCase() !== 'admin') {
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
                    You need administrator privileges to access this page.
                  </p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => setLocation('/')}
                  >
                    Return to Dashboard
                  </Button>
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
            <h1 className="text-2xl font-bold">Ειδοποιήσεις Προϋπολογισμού</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Παρακολουθήστε και διαχειριστείτε τις ειδοποιήσεις που σχετίζονται με το προϋπολογισμό
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="secondary"
              onClick={() => createTestNotifications.mutate()}
              disabled={createTestNotifications.isPending}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              {createTestNotifications.isPending ? 'Creating...' : 'Create Test Notifications'}
            </Button>
            <Button 
              variant="outline"
              onClick={handleRefresh}
              className="flex items-center gap-2"
            >
              <RotateCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        <Card className="bg-card">
          <CardContent className="p-6">
            <NotificationCenter 
              onNotificationClick={(notification) => {
                const typeLabels: Record<string, string> = {
                  'funding': 'ΧΡΗΜΑΤΟΔΟΤΗΣΗ',
                  'reallocation': 'ΑΝΑΠΡΟΣΑΡΜΟΓΗ'
                };
                toast({
                  title: typeLabels[notification.type] || 'ΕΙΔΟΠΟΙΗΣΗ',
                  description: `${notification.reason}\nNA853: ${notification.na853} • Ποσό: €${notification.amount.toLocaleString()}`,
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