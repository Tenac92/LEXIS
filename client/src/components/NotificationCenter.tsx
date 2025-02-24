import { FC, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, AlertTriangle, AlertCircle } from 'lucide-react';
import { useToast, toast } from '@/hooks/use-toast';
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
  const { toast: showToast } = useToast(); // Get toast function from hook

  const { data: notifications, error } = useQuery({
    queryKey: ['/api/budget/notifications'],
    queryFn: async () => {
      const response = await fetch('/api/budget/notifications', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch notifications');
      const data = await response.json();
      return data.notifications as BudgetNotification[];
    }
  });

  // Update the WebSocket connection logic
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
        showToast({
          title: "Connection Error",
          description: "Failed to connect to notification service. Please refresh the page.",
          variant: "destructive"
        });
      };

      ws.onmessage = (event) => {
        try {
          const notification = JSON.parse(event.data) as BudgetNotification;
          const styles = notificationStyles[notification.type as keyof typeof notificationStyles];

          showToast({
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
  }, [queryClient, showToast]); // Added showToast to dependency array

  if (error) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="pt-6">
          <div className="text-center text-destructive">
            Failed to load notifications
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
        const styles = notificationStyles[notification.type as keyof typeof notificationStyles];

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
                  {formatDistanceToNow(new Date(notification.created_at || new Date()), { addSuffix: true })}
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