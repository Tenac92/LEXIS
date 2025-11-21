import { FC, useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { formatDistanceToNow, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import type { BudgetNotification } from '@shared/schema';
import { useStableWebSocket } from '@/hooks/use-stable-websocket';

const notificationTypeLabels = {
  funding: 'ΧΡΗΜΑΤΟΔΟΤΗΣΗ',
  reallocation: 'ΑΝΑΠΡΟΣΑΡΜΟΓΗ',
  default: 'ΕΙΔΟΠΟΙΗΣΗ'
};

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
  const { isConnected, reconnect } = useStableWebSocket();
  const queryClient = useQueryClient();
  
  // Local state management for manual handling
  const [loadingState, setLoadingState] = useState<'idle' | 'loading' | 'error' | 'success'>('idle');
  const [localNotifications, setLocalNotifications] = useState<BudgetNotification[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Enhanced query with local state management
  const { 
    data: notifications = [], 
    error, 
    isError, 
    isLoading, 
    refetch 
  } = useQuery<BudgetNotification[]>({
    queryKey: ['/api/budget-notifications/admin'],
    queryFn: async () => {
      // Fetching notifications from API endpoints
      setLoadingState('loading');
      setErrorMessage(null);
      
      // Try the primary endpoint first
      try {
        const response = await fetch('/api/budget-notifications/admin', {
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });

        if (response.ok) {
          const data = await response.json();
          // Primary endpoint fetched data successfully

          // Ensure we always return an array
          if (!Array.isArray(data)) {
            console.warn('[NotificationCenter] Expected array but got:', typeof data);
            setLoadingState('error');
            setErrorMessage('Invalid data format returned from server');
            return [];
          }

          setLoadingState('success');
          setLocalNotifications(data);
          return data;
        }
        
        console.warn('[NotificationCenter] Primary endpoint failed with status:', response.status);
        // Fall through to try backup endpoint
      } catch (err) {
        console.error('[NotificationCenter] Primary endpoint error:', err);
        // Fall through to try backup endpoint
      }
      
      // If primary endpoint fails, try the alternate endpoint
      try {
        // Trying alternate endpoint for fallback
        const fallbackResponse = await fetch('/api/budget/notifications', {
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });

        if (!fallbackResponse.ok) {
          console.error('[NotificationCenter] Alternate endpoint failed:', fallbackResponse.status);
          setLoadingState('error');
          setErrorMessage('Failed to fetch notifications from both endpoints');
          return [];
        }

        const fallbackData = await fallbackResponse.json();
        // Alternate endpoint fetched data successfully

        // Ensure we always return an array
        if (!Array.isArray(fallbackData)) {
          console.warn('[NotificationCenter] Expected array from alternate endpoint but got:', typeof fallbackData);
          setLoadingState('error');
          setErrorMessage('Invalid data format returned from fallback server');
          return [];
        }

        setLoadingState('success');
        setLocalNotifications(fallbackData);
        return fallbackData;
      } catch (fallbackErr) {
        console.error('[NotificationCenter] Both endpoints failed:', fallbackErr);
        setLoadingState('error');
        setErrorMessage('Failed to fetch notifications: Network error');
        return [];
      }
    },
    retry: 2, // Increase retry attempts
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 10000), // Exponential backoff
    refetchInterval: 30000, // Refetch every 30 seconds
    refetchOnWindowFocus: true // Refresh when window gets focus
  });
  
  // Set up callbacks for query state changes
  useEffect(() => {
    if (isError && error) {
      console.error('[NotificationCenter] Query error:', error);
      setLoadingState('error');
      setErrorMessage(error instanceof Error ? error.message : 'An unknown error occurred');
    }
  }, [isError, error]);
  
  // Update local state when query data changes
  useEffect(() => {
    if (notifications && notifications.length > 0) {
      setLoadingState('success');
      setLocalNotifications(notifications);
    }
  }, [notifications]);
  
  // Effect to check if we need to manually fetch if query fails
  useEffect(() => {
    // If we've previously failed and need to retry manually
    if (isError && loadingState === 'error' && localNotifications.length === 0) {
      const manualFetch = async () => {
        try {
          // Attempting manual fetch after previous error
          
          // Try the standard endpoint with a direct fetch
          const response = await fetch('/api/budget/notifications', {
            credentials: 'include',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data)) {
              // Manual fetch succeeded
              setLocalNotifications(data);
              setLoadingState('success');
              setErrorMessage(null);
              
              // Update the query cache
              queryClient.setQueryData(['/api/budget-notifications/admin'], data);
              return;
            }
          }
        } catch (err) {
          console.error('[NotificationCenter] Manual fetch failed:', err);
        }
      };
      
      // Wait a bit before trying manual fetch
      const timer = setTimeout(() => {
        manualFetch();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [isError, loadingState, localNotifications.length, queryClient]);

  // Show loading state if we're loading and don't have any data yet
  if ((isLoading || loadingState === 'loading') && localNotifications.length === 0) {
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

  // Show error state if we have an error and no backup data
  if ((isError || loadingState === 'error') && localNotifications.length === 0) {
    return (
      <Card className="w-full border-destructive">
        <CardContent className="pt-6">
          <div className="text-center text-destructive">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p className="font-semibold">Αποτυχία φόρτωσης ειδοποιήσεων</p>
            <p className="text-sm text-muted-foreground mt-2">
              {errorMessage || (error instanceof Error ? error.message : 'Προέκυψε ένα μη αναμενόμενο σφάλμα')}
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                // Try both the refetch and a manual fetch
                refetch();
                setLoadingState('loading');
                
                toast({
                  title: "Ανανέωση",
                  description: "Επαναφόρτωση ειδοποιήσεων...",
                });
              }}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Δοκιμάστε ξανά
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Decide which data source to use - prefer query data but fall back to local state
  const displayNotifications = notifications.length > 0 ? notifications : localNotifications;

  // Show empty state if no notifications are present
  if (!displayNotifications.length) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2" />
            <p>Δεν υπάρχουν ειδοποιήσεις</p>
            {!isConnected && (
              <p className="text-sm mt-2 text-yellow-600">
                Αποσύνδεση ενημερώσεων πραγματικού χρόνου. Οι ειδοποιήσεις ενδέχεται να καθυστερήσουν.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show notifications with warning if WebSocket is disconnected
  return (
    <div className="space-y-4">
      {!isConnected && (
        <div className="text-sm p-2 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-600 mb-4">
          ⚠️ Αποσύνδεση ενημερώσεων πραγματικού χρόνου. Ορισμένες ειδοποιήσεις ενδέχεται να καθυστερήσουν.
          <Button
            variant="link"
            className="text-yellow-700 p-0 h-auto ml-2"
            onClick={() => {
              reconnect();
              refetch();
              setLoadingState('loading');
              toast({
                title: "Επανασύνδεση",
                description: "Επαναφορά σύνδεσης ενημερώσεων πραγματικού χρόνου...",
              });
            }}
          >
            Επανασύνδεση
          </Button>
        </div>
      )}
      
      {/* Show a loading indicator if refreshing in the background */}
      {loadingState === 'loading' && displayNotifications.length > 0 && (
        <div className="flex items-center justify-center py-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
          <span className="ml-2 text-xs text-muted-foreground">Ανανέωση...</span>
        </div>
      )}
      
      {displayNotifications.map((notification) => {
        const style = notificationStyles[notification.type as keyof typeof notificationStyles] || notificationStyles.default;
        const Icon = style.icon;
        
        // Handle potential date parsing errors
        let formattedDate = "Unknown date";
        try {
          // Ensure created_at is a string before parsing
          // Use type guard to ensure created_at is a string
          const createdAtValue = notification.created_at;
          if (typeof createdAtValue === 'string' && createdAtValue) {
            const createdAt = parseISO(createdAtValue);
            if (!isNaN(createdAt.getTime())) {
              formattedDate = formatDistanceToNow(createdAt, { addSuffix: true });
            }
          }
        } catch (err) {
          // Date parsing error - silent fallback to "Unknown date"
        }

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
                  {notification.type?.replace('_', ' ').toUpperCase() || 'NOTIFICATION'}
                </CardTitle>
                <CardDescription className="text-xs">
                  {formattedDate}
                </CardDescription>
              </div>
              <Badge variant="outline" className={cn(style.badge)}>
                {notification.status || 'New'}
              </Badge>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{notification.reason || 'No details provided'}</p>
              <div className="mt-2 text-xs text-muted-foreground">
                MIS: {notification.mis || 'N/A'} • 
                Budget: €{Number(notification.current_budget || 0).toLocaleString()} • 
                Amount: €{Number(notification.amount || 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default NotificationCenter;