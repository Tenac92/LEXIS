import { FC } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, AlertTriangle, AlertCircle, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import type { BudgetNotification } from '@shared/schema';
import { useWebSocketUpdates } from '@/hooks/use-websocket-updates';

// Styling based on notification type
const notificationStyles = {
  funding: {
    bg: 'bg-red-50 hover:bg-red-100',
    border: 'border-red-200',
    badge: 'bg-red-100 text-red-800',
    icon: AlertCircle,
    toastVariant: 'destructive' as const
  },
  reallocation: {
    bg: 'bg-yellow-50 hover:bg-yellow-100',
    border: 'border-yellow-200',
    badge: 'bg-yellow-100 text-yellow-800',
    icon: AlertTriangle,
    toastVariant: 'default' as const
  },
  default: {
    bg: 'bg-gray-50 hover:bg-gray-100',
    border: 'border-gray-200',
    badge: 'bg-gray-100 text-gray-800',
    icon: Bell,
    toastVariant: 'default' as const
  }
};

interface NotificationCenterProps {
  onNotificationClick?: (notification: BudgetNotification) => void;
}

export const NotificationCenter: FC<NotificationCenterProps> = ({ onNotificationClick }) => {
  const { toast } = useToast();
  const { isConnected } = useWebSocketUpdates();

  const { data: notifications = [], error, isError, isLoading, refetch } = useQuery({
    queryKey: ['/api/budget/notifications'],
    queryFn: async () => {
      console.log('[NotificationCenter] Fetching notifications...');
      const response = await fetch('/api/budget/notifications', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }

      const data = await response.json();
      console.log('[NotificationCenter] API Response:', data);

      return data as BudgetNotification[];
    }
  });

  if (isLoading) {
    return (
      <Card className="w-full animate-pulse">
        <CardContent className="pt-6">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-muted rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="w-full border-destructive">
        <CardContent className="pt-6">
          <div className="text-center text-destructive">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p className="font-semibold">Failed to load notifications</p>
            <p className="text-sm text-muted-foreground mt-2">
              {error instanceof Error ? error.message : 'An unexpected error occurred'}
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => refetch()}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!notifications.length) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2" />
            <p>No notifications available</p>
            {!isConnected && (
              <p className="text-sm mt-2 text-yellow-600">
                Real-time updates disconnected. Notifications may be delayed.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {!isConnected && (
        <div className="text-sm p-2 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-600 mb-4">
          ⚠️ Real-time updates disconnected. Some notifications may be delayed.
          <Button
            variant="link"
            className="text-yellow-700 p-0 h-auto ml-2"
            onClick={() => window.location.reload()}
          >
            Reconnect
          </Button>
        </div>
      )}
      {notifications.map((notification) => {
        const style = notificationStyles[notification.type as keyof typeof notificationStyles] || notificationStyles.default;
        const Icon = style.icon;
        const createdAt = new Date(notification.created_at);

        return (
          <Card
            key={notification.id}
            className={cn(
              'cursor-pointer transition-all duration-200',
              'hover:shadow-md',
              style.bg,
              style.border,
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
              <Badge variant="outline" className={cn(style.badge)}>
                {notification.status}
              </Badge>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{notification.reason}</p>
              <div className="mt-2 text-xs text-muted-foreground">
                MIS: {notification.mis} • Budget: €{notification.current_budget.toLocaleString('en-US', { minimumFractionDigits: 2 })} • Amount: €{notification.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default NotificationCenter;