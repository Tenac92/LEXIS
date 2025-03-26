import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { RotateCw, CheckCircle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { BudgetNotification } from '@/lib/types';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

const notificationStyles = {
  funding: {
    bg: 'bg-red-50 hover:bg-red-100',
    border: 'border-red-200',
    badge: 'bg-red-100 text-red-800',
    color: 'text-red-800',
    icon: 'red',
  },
  reallocation: {
    bg: 'bg-yellow-50 hover:bg-yellow-100',
    border: 'border-yellow-200', 
    badge: 'bg-yellow-100 text-yellow-800',
    color: 'text-yellow-800',
    icon: 'amber',
  },
  low_budget: {
    bg: 'bg-blue-50 hover:bg-blue-100',
    border: 'border-blue-200',
    badge: 'bg-blue-100 text-blue-800',
    color: 'text-blue-800',
    icon: 'blue',
  },
  default: {
    bg: 'bg-gray-50 hover:bg-gray-100',
    border: 'border-gray-200',
    badge: 'bg-gray-100 text-gray-800',
    color: 'text-gray-800',
    icon: 'gray',
  }
};

export default function AdminNotificationsPage() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState('all');
  
  const { data: notifications = [], isLoading, refetch } = useQuery<BudgetNotification[]>({
    queryKey: ['/api/budget-notifications/admin'],
    queryFn: async () => {
      console.log('[AdminNotificationsPage] Fetching notifications...');
      try {
        const response = await fetch('/api/budget-notifications/admin', {
          credentials: 'include',
        });
        
        if (!response.ok) {
          throw new Error(`Error fetching notifications: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('[AdminNotificationsPage] Received notifications:', data);
        
        if (!Array.isArray(data)) {
          console.warn('[AdminNotificationsPage] Expected array but got:', typeof data);
          return [];
        }
        
        return data;
      } catch (error) {
        console.error('[AdminNotificationsPage] Error fetching notifications:', error);
        toast({
          title: 'Error fetching notifications',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive',
        });
        return [];
      }
    }
  });
  
  const handleRefresh = () => {
    refetch();
    toast({
      title: 'Refreshing notifications',
      description: 'Getting the latest budget notifications'
    });
  };
  
  const handleApprove = async (id: number) => {
    try {
      const response = await fetch(`/api/budget-notifications/${id}/approve`, {
        method: 'POST',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`Error approving notification: ${response.status}`);
      }
      
      toast({
        title: 'Notification approved',
        description: 'The budget notification has been approved'
      });
      
      refetch();
    } catch (error) {
      toast({
        title: 'Error approving notification',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };
  
  const handleReject = async (id: number) => {
    try {
      const response = await fetch(`/api/budget-notifications/${id}/reject`, {
        method: 'POST',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`Error rejecting notification: ${response.status}`);
      }
      
      toast({
        title: 'Notification rejected',
        description: 'The budget notification has been rejected'
      });
      
      refetch();
    } catch (error) {
      toast({
        title: 'Error rejecting notification',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };
  
  const filteredNotifications = statusFilter === 'all' 
    ? notifications 
    : notifications.filter(notification => notification.status === statusFilter);

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

        <div className="flex gap-2 mb-4">
          <Badge 
            className={cn("cursor-pointer", statusFilter === 'all' ? "bg-primary" : "bg-secondary")}
            onClick={() => setStatusFilter('all')}
          >
            All
          </Badge>
          <Badge 
            className={cn("cursor-pointer", statusFilter === 'pending' ? "bg-primary" : "bg-secondary")}
            onClick={() => setStatusFilter('pending')}
          >
            Pending
          </Badge>
          <Badge 
            className={cn("cursor-pointer", statusFilter === 'approved' ? "bg-primary" : "bg-secondary")}
            onClick={() => setStatusFilter('approved')}
          >
            Approved
          </Badge>
          <Badge 
            className={cn("cursor-pointer", statusFilter === 'rejected' ? "bg-primary" : "bg-secondary")}
            onClick={() => setStatusFilter('rejected')}
          >
            Rejected
          </Badge>
        </div>

        <Card className="bg-card">
          <CardContent className="p-6">
            {isLoading ? (
              <div className="text-center py-8">Loading notifications...</div>
            ) : filteredNotifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {statusFilter === 'all' 
                  ? 'No budget notifications found.' 
                  : `No ${statusFilter} notifications found.`}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredNotifications.map((notification) => {
                  const style = notificationStyles[notification.type as keyof typeof notificationStyles] || notificationStyles.default;
                  
                  return (
                    <div 
                      key={notification.id}
                      className={cn(
                        "rounded-lg border p-4 transition-colors",
                        style.bg,
                        style.border
                      )}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <Badge className={style.badge}>
                            {notification.type.replace('_', ' ').toUpperCase()}
                          </Badge>
                          <span className="text-sm font-medium">MIS: {notification.mis}</span>
                          <span className="text-sm">
                            {formatDistanceToNow(parseISO(notification.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <Badge variant={
                          notification.status === 'approved' 
                            ? 'default' 
                            : notification.status === 'rejected' 
                              ? 'destructive' 
                              : 'outline'
                        }>
                          {notification.status.toUpperCase()}
                        </Badge>
                      </div>
                      
                      <p className={cn("mb-3", style.color)}>
                        {notification.reason}
                      </p>
                      
                      <div className="flex justify-between items-center text-sm">
                        <div>
                          <span className="font-semibold">Amount:</span> €{notification.amount.toLocaleString()} | 
                          <span className="font-semibold ml-2">Current Budget:</span> €{notification.current_budget.toLocaleString()} | 
                          <span className="font-semibold ml-2">Annual Credit:</span> €{notification.ethsia_pistosi.toLocaleString()}
                        </div>
                        
                        {notification.status === 'pending' && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex items-center gap-1"
                              onClick={() => handleApprove(notification.id)}
                            >
                              <CheckCircle className="h-4 w-4" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex items-center gap-1"
                              onClick={() => handleReject(notification.id)}
                            >
                              <XCircle className="h-4 w-4" />
                              Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}