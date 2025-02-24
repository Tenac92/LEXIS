import { FC, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, AlertTriangle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import type { BudgetNotification } from '@shared/schema';

// Styling based on notification type
const notificationStyles = {
  funding: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    badge: 'bg-red-100 text-red-800',
    toastVariant: 'destructive' as const
  },
  reallocation: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    badge: 'bg-yellow-100 text-yellow-800',
    toastVariant: 'default' as const
  },
  default: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    badge: 'bg-blue-100 text-blue-800',
    toastVariant: 'default' as const
  }
};

const typeIcons = {
  funding: AlertCircle,
  reallocation: AlertTriangle
} as const;

interface NotificationCenterProps {
  onNotificationClick?: (notification: BudgetNotification) => void;
}

export const NotificationCenter: FC<NotificationCenterProps> = ({ onNotificationClick }) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: notifications, error, isError, isLoading } = useQuery({
    queryKey: ['/api/budget/notifications'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/budget/notifications', {
          credentials: 'include'
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to fetch notifications');
        }

        const data = await response.json();
        return data.notifications as BudgetNotification[];
      } catch (error) {
        console.error('[NotificationCenter] Fetch error:', error);
        throw error;
      }
    },
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000)
  });

  useEffect(() => {
    try {
      const host = window.location.host;
      if (!host) {
        console.error('No host found in window.location');
        return;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${host}/ws/notifications`;

      console.log('Attempting WebSocket connection to:', wsUrl);
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connection established');
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        toast({
          title: "Connection Warning",
          description: "Real-time updates may be delayed. Please refresh for latest notifications.",
          variant: "default"
        });
      };

      ws.onmessage = (event) => {
        try {
          const notification = JSON.parse(event.data) as BudgetNotification;
          const styles = notificationStyles[notification.type as keyof typeof notificationStyles] || notificationStyles.default;

          toast({
            title: `New Budget Notification`,
            description: notification.reason || `${notification.type} notification received`,
            variant: styles.toastVariant
          });

          queryClient.invalidateQueries({ queryKey: ['/api/budget/notifications'] });
        } catch (error) {
          console.error('Error processing notification:', error);
        }
      };

      return () => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      };
    } catch (error) {
      console.error('Failed to setup WebSocket:', error);
    }
  }, [queryClient, toast]);

  if (isLoading) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="w-full max-w-md mx-auto border-destructive">
        <CardContent className="pt-6">
          <div className="text-center text-destructive">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p>Failed to load notifications</p>
            <p className="text-sm text-muted-foreground mt-2">
              {error instanceof Error ? error.message : 'An unexpected error occurred'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!notifications?.length) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2" />
            No notifications
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {notifications.map((notification) => {
        const Icon = typeIcons[notification.type as keyof typeof typeIcons] || Bell;
        const styles = notificationStyles[notification.type as keyof typeof notificationStyles] || notificationStyles.default;
        const createdAt = notification.created_at ? new Date(notification.created_at) : new Date();

        return (
          <Card
            key={notification.id}
            className={cn(
              'cursor-pointer transition-colors hover:shadow-md',
              styles.bg,
              styles.border,
              'border rounded-lg overflow-hidden'
            )}
            onClick={() => onNotificationClick?.(notification)}
          >
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <Icon className="h-5 w-5" />
              <div className="flex-1">
                <CardTitle className="text-sm font-medium">
                  {notification.type.replace('_', ' ').toUpperCase()}
                </CardTitle>
                <CardDescription className="text-xs">
                  {formatDistanceToNow(createdAt, { addSuffix: true })}
                </CardDescription>
              </div>
              <Badge variant="outline" className={cn(styles.badge)}>
                {notification.status}
              </Badge>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{notification.reason}</p>
              <div className="mt-2 text-xs text-muted-foreground">
                MIS: {notification.mis} • Amount: €{notification.amount.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default NotificationCenter;