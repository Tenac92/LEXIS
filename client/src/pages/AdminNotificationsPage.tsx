import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { RotateCw, CheckCircle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

interface BudgetNotification {
  id: number;
  project_id: number;
  mis?: number;
  na853?: string | null;
  type: string;
  amount: number;
  current_budget: number;
  ethsia_pistosi: number;
  reason?: string;
  status: string;
  user_id?: number;
  created_at: string;
  updated_at?: string;
  user?: {
    id: number;
    name: string;
    email?: string;
    department?: string;
  } | null;
}

const notificationTypeLabels: Record<string, string> = {
  anakatanom_request: 'ΑΝΑΚΑΤΑΝΟΜΗ',
  xrimatodotisi_request: 'ΧΡΗΜΑΤΟΔΟΤΗΣΗ',
  funding: 'ΧΡΗΜΑΤΟΔΟΤΗΣΗ',
  reallocation: 'ΑΝΑΠΡΟΣΑΡΜΟΓΗ',
  low_budget: 'ΧΑΜΗΛΟ ΥΠΟΛΟΙΠΟ',
  default: 'ΕΙΔΟΠΟΙΗΣΗ'
};

const statusLabels: Record<string, string> = {
  pending: 'εκκρεμές',
  approved: 'εγκεκριμένο',
  rejected: 'απορριφθέν'
};

const notificationStyles: Record<string, { bg: string; border: string; badge: string; color: string; icon: string }> = {
  anakatanom_request: {
    bg: 'bg-red-50 hover:bg-red-100',
    border: 'border-red-300',
    badge: 'bg-red-600 text-white',
    color: 'text-red-800',
    icon: 'red',
  },
  xrimatodotisi_request: {
    bg: 'bg-amber-50 hover:bg-amber-100',
    border: 'border-amber-300',
    badge: 'bg-amber-500 text-white',
    color: 'text-amber-800',
    icon: 'amber',
  },
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
        console.log('[AdminNotificationsPage] Notification types:', data.map((n: any) => ({ id: n.id, type: n.type })));
        
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
  
  const handleApprove = async (na853: string) => {
    try {
      const response = await fetch(`/api/budget-notifications/${na853}/approve`, {
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
  
  const handleReject = async (na853: string) => {
    try {
      const response = await fetch(`/api/budget-notifications/${na853}/reject`, {
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
            <h1 className="text-2xl font-bold">Ειδοποιήσεις Προϋπολογισμού</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Παρακολούθηση και διαχείριση ειδοποιήσεων προϋπολογισμού
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
            Όλα
          </Badge>
          <Badge 
            className={cn("cursor-pointer", statusFilter === 'pending' ? "bg-primary" : "bg-secondary")}
            onClick={() => setStatusFilter('pending')}
          >
            Εκκρεμές
          </Badge>
          <Badge 
            className={cn("cursor-pointer", statusFilter === 'approved' ? "bg-primary" : "bg-secondary")}
            onClick={() => setStatusFilter('approved')}
          >
            Εγκεκριμένο
          </Badge>
          <Badge 
            className={cn("cursor-pointer", statusFilter === 'rejected' ? "bg-primary" : "bg-secondary")}
            onClick={() => setStatusFilter('rejected')}
          >
            Απορριφθέν
          </Badge>
        </div>

        <Card className="bg-card">
          <CardContent className="p-6">
            {isLoading ? (
              <div className="text-center py-8">Φόρτωση ειδοποιήσεων...</div>
            ) : filteredNotifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {statusFilter === 'all' 
                  ? 'Δεν βρέθηκαν ειδοποιήσεις προϋπολογισμού.' 
                  : `Δεν βρέθηκαν ειδοποιήσεις με κατάσταση "${statusFilter}".`}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredNotifications.map((notification) => {
                  console.log(`[AdminNotificationsPage] Rendering notification id=${notification.id}, type="${notification.type}", found style key=${notification.type in notificationStyles}`);
                  const style = notificationStyles[notification.type as keyof typeof notificationStyles] || notificationStyles.default;
                  console.log(`[AdminNotificationsPage] Applied style for type="${notification.type}":`, style);
                  
                  return (
                    <div 
                      key={notification.na853 || String(notification.id)}
                      className={cn(
                        "rounded-lg border p-4 transition-colors",
                        style.bg,
                        style.border
                      )}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <Badge className={style.badge}>
                            {notificationTypeLabels[notification.type as keyof typeof notificationTypeLabels] || notificationTypeLabels.default}
                          </Badge>
                          <span className="text-sm font-medium">NA853: {notification.na853 || notification.mis}</span>
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
                          {statusLabels[notification.status as keyof typeof statusLabels] || notification.status}
                        </Badge>
                      </div>
                      
                      <p className={cn("mb-3", style.color)}>
                        {notification.reason}
                      </p>
                      
                      {notification.user && (
                        <div className="mb-2 text-xs text-muted-foreground">
                          <span className="font-semibold">Ζητήθηκε από:</span> {notification.user.name || 'Άγνωστος χρήστης'} 
                          {notification.user.email && (
                            <span> ({notification.user.email})</span>
                          )}
                          {notification.user.department && (
                            <span> • {notification.user.department}</span>
                          )}
                        </div>
                      )}
                      
                      <div className="flex justify-between items-center text-sm">
                        <div>
                          <span className="font-semibold">Ποσό:</span> €{notification.amount.toLocaleString()} | 
                          <span className="font-semibold ml-2">Τρέχων Προϋπολογισμός:</span> €{notification.current_budget.toLocaleString()} | 
                          <span className="font-semibold ml-2">Ετήσια Πίστωση:</span> €{notification.ethsia_pistosi.toLocaleString()}
                        </div>
                        
                        {notification.status === 'pending' && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex items-center gap-1"
                              onClick={() => handleApprove(notification.na853 || String(notification.id))}
                            >
                              <CheckCircle className="h-4 w-4" />
                              Έγκριση
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex items-center gap-1"
                              onClick={() => handleReject(notification.na853 || String(notification.id))}
                            >
                              <XCircle className="h-4 w-4" />
                              Απόρριψη
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