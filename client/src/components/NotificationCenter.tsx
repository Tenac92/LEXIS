import { FC, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import type { BudgetNotification } from '@shared/schema';

interface NotificationStyles {
  [key: string]: {
    bg: string;
    border: string;
    badge: string;
    toastVariant: 'default' | 'destructive';
  };
}

// Priority-based styling
const notificationStyles: NotificationStyles = {
  high: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    badge: 'bg-red-100 text-red-800',
    toastVariant: 'destructive'
  },
  medium: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    badge: 'bg-yellow-100 text-yellow-800',
    toastVariant: 'default'
  },
  low: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    badge: 'bg-blue-100 text-blue-800',
    toastVariant: 'default'
  }
};

const typeIcons = {
  funding: AlertCircle,
  reallocation: AlertTriangle,
  low_budget: Info,
  threshold_warning: Bell
} as const;

interface NotificationCenterProps {
  onNotificationClick?: (notification: BudgetNotification) => void;
}

export const NotificationCenter: FC<NotificationCenterProps> = ({ onNotificationClick }) => {
  const queryClient = useQueryClient();

  const { data: notifications } = useQuery({
    queryKey: ['/api/budget/notifications'],
    queryFn: async () => {
      const response = await fetch('/api/budget/notifications');
      if (!response.ok) throw new Error('Failed to fetch notifications');
      const data = await response.json();
      return data.data as BudgetNotification[];
    }
  });

  // Set up WebSocket connection for real-time updates
  useEffect(() => {
    const ws = new WebSocket(`wss://${window.location.host}/ws/notifications`);

    ws.onmessage = (event) => {
      const notification = JSON.parse(event.data) as BudgetNotification;
      const styles = notificationStyles[notification.priority];

      // Show toast notification
      toast({
        title: `New Budget Notification`,
        description: notification.reason || `${notification.type} notification received`,
        variant: styles.toastVariant
      });

      // Invalidate notifications cache to trigger refresh
      queryClient.invalidateQueries({ queryKey: ['/api/budget/notifications'] });
    };

    return () => ws.close();
  }, [queryClient]);

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
        const styles = notificationStyles[notification.priority];

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
                {notification.priority}
              </Badge>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{notification.reason}</p>
              <div className="mt-2 text-xs text-muted-foreground">
                MIS: {notification.mis} • Amount: €{notification.amount.toLocaleString()}
              </div>
            </CardContent>
            {notification.action_required && (
              <CardFooter className="bg-background/10 pt-2">
                <Button variant="outline" size="sm" className="ml-auto">
                  Take Action
                </Button>
              </CardFooter>
            )}
          </Card>
        );
      })}
    </div>
  );
};

export default NotificationCenter;