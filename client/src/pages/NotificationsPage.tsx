import { useEffect } from 'react';
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

  // Check if user is admin using the correct endpoint
  const { data: user, isLoading: userLoading, error: userError } = useQuery<User>({
    queryKey: ['/api/auth/me'],
    queryFn: async () => {
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch user data');
      }
      return response.json();
    },
    retry: 1
  });

  useEffect(() => {
    // Only redirect if we have finished loading and the user is not an admin
    if (!userLoading && user && user.role !== 'admin') {
      toast({
        title: "Access Denied",
        description: "You need administrator privileges to access this page.",
        variant: "destructive"
      });
      setLocation('/');
    }
  }, [user, userLoading, setLocation, toast]);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/budget/notifications'] });
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
                <p className="text-lg font-semibold">Authentication Error</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {userError instanceof Error 
                    ? userError.message 
                    : 'Please try logging in again'}
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
  if (user.role !== 'admin') {
    return null;
  }

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