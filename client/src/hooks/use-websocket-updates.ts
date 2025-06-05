import { useEffect, useRef, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { BudgetUpdate } from '@/lib/types';

export interface BudgetUpdateMessage extends BudgetUpdate {}

export function useWebSocketUpdates() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef<number>(0);
  const connectionIdRef = useRef<string>('');
  const isConnectingRef = useRef<boolean>(false);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<BudgetUpdate | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Function to check session status with improved error handling
  const checkSession = useCallback(async () => {
    try {
      // Verify if user session is still valid
      const result = await queryClient.refetchQueries({ queryKey: ['/api/auth/me'] });
      
      // Check if the result indicates we're not authenticated
      const queryData = queryClient.getQueryData(['/api/auth/me']);
      if (!queryData) {
        console.warn('[WebSocket] Session check failed - no authenticated user found');
        
        // If we have a WebSocket connection, close it as we're no longer authenticated
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          // Closing WebSocket connection due to expired session
          wsRef.current.close(1000, 'Session expired');
          wsRef.current = null;
        }
      }
      
      return result;
    } catch (error) {
      console.error('[WebSocket] Session check failed:', error);
      return null;
    }
  }, []);

  // Generate unique connection ID for tracking
  const generateConnectionId = useCallback(() => {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Connect to WebSocket with improved stability and error handling
  const connect = useCallback(() => {
    if (!user || isConnectingRef.current) {
      return;
    }

    // Prevent multiple simultaneous connection attempts
    isConnectingRef.current = true;

    // Close any existing connection first to prevent duplicates
    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
          wsRef.current.close(1000, 'Creating new connection');
        }
      } catch (error) {
        console.error('[WebSocket] Error closing existing connection:', error);
      } finally {
        wsRef.current = null;
      }
    }

    // Generate new connection ID for tracking
    const connectionId = generateConnectionId();
    connectionIdRef.current = connectionId;

    const MAX_RETRIES = 10; // Increase max retries for better resilience
    
    try {
      // Get the correct websocket URL based on current location
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host || document.location.host;
      
      if (!host) {
        console.error('[WebSocket] Cannot connect: No valid host detected');
        return;
      }
      
      // Add timestamp to URL to prevent caching issues
      const wsUrl = `${protocol}//${host}/ws?t=${Date.now()}`;
      // Attempting to establish WebSocket connection

      // Create new WebSocket connection
      try {
        const ws = new WebSocket(wsUrl, ['notifications']);
        
        // Set a connection timeout
        const connectionTimeout = setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            console.warn('[WebSocket] Connection timeout, closing socket');
            try {
              ws.close();
            } catch (e) {
              console.error('[WebSocket] Error closing timed-out socket:', e);
            }
          }
        }, 10000); // 10 second timeout
        
        wsRef.current = ws;

        // Set up event handlers with connection tracking
        ws.onopen = () => {
          // Only proceed if this is still the current connection
          if (connectionIdRef.current === connectionId) {
            clearTimeout(connectionTimeout);
            setIsConnected(true);
            retryCountRef.current = 0;
            isConnectingRef.current = false;

          // Send initial connection message
          try {
            const message = JSON.stringify({ 
              type: 'connect',
              timestamp: new Date().toISOString()
            });
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(message);
            } else {
              console.warn('[WebSocket] Cannot send initial message, socket not open');
            }
          } catch (error) {
            console.error('[WebSocket] Failed to send initial message:', error);
          }

          // Check for session validation
          checkSession();
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            // Processing incoming WebSocket message

            switch (data.type) {
              case 'notification':
                // Handle new notification - invalidate all notification endpoints
                queryClient.invalidateQueries({ queryKey: ['/api/budget/notifications'] });
                queryClient.invalidateQueries({ queryKey: ['/api/budget-notifications/admin'] });
                
                // Display toast notification
                toast({
                  title: data.data?.reason || 'New Budget Notification',
                  description: `MIS: ${data.data?.mis} • Amount: €${Number(data.data?.amount || 0).toLocaleString('el-GR')}`,
                  variant: data.data?.type === 'funding' ? 'destructive' : 'default'
                });
                
                // Verify our session is still valid
                checkSession();
                break;
                
              case 'budget_update':
                // Handle real-time budget update
                const budgetUpdate = data.data as BudgetUpdateMessage;
                
                // IMPROVEMENT: Save the budget update message to make it available to other components
                // This is used by BudgetIndicator to directly display real-time changes without refetching
                setLastMessage({
                  type: 'budget_update',
                  mis: budgetUpdate.mis,
                  amount: budgetUpdate.amount,
                  timestamp: budgetUpdate.timestamp || new Date().toISOString(),
                  userId: budgetUpdate.userId,
                  sessionId: budgetUpdate.sessionId,
                  simpleBudgetData: budgetUpdate.simpleBudgetData
                });
                
                // Store unique client session ID in the sessionStorage to identify our own updates
                const clientSessionId = sessionStorage.getItem('clientSessionId');
                
                // Always process budget updates, even from our own session
                // This ensures all clients see updates in real-time
                // Received real-time budget update for project MIS
                
                // If we have the simplified budget data, log it
                if (budgetUpdate.simpleBudgetData) {
                  // Received simplified budget calculation data
                }
                
                // Force refetch of the budget validation to update all components showing this budget
                // This will update the budget indicator component with new values
                queryClient.invalidateQueries({ 
                  queryKey: ["budget-validation", budgetUpdate.mis]
                });
                
                // Also invalidate the budget data
                queryClient.invalidateQueries({ 
                  queryKey: ["budget", budgetUpdate.mis]
                });
                
                // Only show a toast if it's not our own update
                if (budgetUpdate.sessionId !== clientSessionId) {
                  // Display a subtle toast to inform the user about real-time updates
                  toast({
                    title: 'Συγχρονισμός κατανομών',
                    description: `Η κατανομή για το έργο MIS ${budgetUpdate.mis} ενημερώθηκε από άλλο χρήστη`,
                    variant: 'default'
                  });
                } else {
                  // Just log if it's our own update
                  // Processing our own budget update to refresh UI
                }
                break;

              case 'connection':
              case 'acknowledgment':
                // Processing server connection/acknowledgment message
                
                // When we connect, generate and store a unique session ID if we don't have one
                if (data.type === 'connection' && !sessionStorage.getItem('clientSessionId')) {
                  const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
                  sessionStorage.setItem('clientSessionId', newSessionId);
                  // Generated unique client session ID for WebSocket identification
                }
                break;

              case 'auth_required':
                console.warn('[WebSocket] Authentication required');
                // Force a session check
                queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
                break;
                
              case 'error':
                console.error('[WebSocket] Server reported error:', data);
                
                // If it's an auth error, check our session
                if (data.code === 401 || data.message?.includes('auth')) {
                  queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
                }
                
                toast({
                  title: 'Error',
                  description: data.message || 'An error occurred with the notification service',
                  variant: 'destructive'
                });
                break;

              default:
                // Received unhandled message type from WebSocket server
            }
          } catch (error) {
            console.error('[WebSocket] Error processing message:', error);
          }
        };

        ws.onerror = (error) => {
          console.error('[WebSocket] Connection error:', error);
          setIsConnected(false);
          
          // Check if our session is still valid when we have WebSocket errors
          checkSession();
        };

        ws.onclose = (event) => {
          // WebSocket connection closed, checking status code
          setIsConnected(false);
          
          // Clear connection timeout if it exists
          clearTimeout(connectionTimeout);
          
          // Properly clean up the WebSocket reference
          wsRef.current = null;

          // Check our session status on any connection close
          checkSession();

          // Specific error handling for common close codes
          const shouldAttemptReconnect = () => {
            switch (event.code) {
              // Normal closure (usually server-initiated)
              case 1000:
                // Normal WebSocket closure, will attempt reconnect
                return true;
                
              // Going away (browser navigating away)
              case 1001:
                // Browser navigation detected
                return document.visibilityState === 'visible'; // Only reconnect if page is visible
                
              // Protocol error
              case 1002:
                console.warn('[WebSocket] Protocol error');
                return true;
                
              // Unsupported data
              case 1003:
                console.warn('[WebSocket] Unsupported data received');
                return true;
                
              // No status (abnormal closure - common)
              case 1005:
                console.warn('[WebSocket] No status code in close frame');
                return true;
                
              // Abnormal closure (connection dropped)
              case 1006:
                console.warn('[WebSocket] Abnormal closure - connection dropped');
                return true;
                
              // Authentication issues
              case 4000:
              case 4001:
              case 4003:
                console.error('[WebSocket] Authentication error:', event.code);
                // Force a session refresh since we might need to re-authenticate
                queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
                return false; // Don't retry - we need to fix auth first
                
              // Server errors
              case 1011:
                console.error('[WebSocket] Server error');
                // Use a longer backoff for server errors
                return true;
                
              // Default - attempt reconnect for any other codes
              default:
                console.warn(`[WebSocket] Unhandled close code: ${event.code}`);
                return true;
            }
          };

          const shouldReconnect = shouldAttemptReconnect();

          // Only attempt reconnection if allowed and we haven't exceeded max retries
          if (shouldReconnect && retryCountRef.current < MAX_RETRIES) {
            // Exponential backoff with jitter for reconnection attempts
            const baseBackoff = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000);
            // Add randomness to prevent all clients hitting server at the same time
            const jitter = Math.floor(Math.random() * 1000);
            const backoff = baseBackoff + jitter;
            
            // Attempting reconnection with exponential backoff

            if (reconnectTimeoutRef.current) {
              clearTimeout(reconnectTimeoutRef.current);
            }

            reconnectTimeoutRef.current = window.setTimeout(() => {
              retryCountRef.current += 1;
              connect();
            }, backoff);
          } else if (!shouldReconnect) {
            // Not attempting reconnection due to specific close code
            // Still make sure the session is valid
            queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
          } else {
            console.warn('[WebSocket] Maximum reconnection attempts reached');
            
            // Reset retry count after a longer timeout to allow future reconnects
            setTimeout(() => {
              // Resetting retry count after cooldown period
              retryCountRef.current = 0;
            }, 60000); // 1 minute cooldown
            
            // Final check to see if our session is still valid
            queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
          }
        };
      } catch (error) {
        console.error('[WebSocket] Error creating WebSocket:', error);
        setIsConnected(false);
        isConnectingRef.current = false;
        checkSession();
      }
    } catch (outerError) {
      console.error('[WebSocket] Setup error:', outerError);
      setIsConnected(false);
      isConnectingRef.current = false;
    }
  }, [user, toast, checkSession, generateConnectionId]);

  // Stabilized WebSocket connection management
  useEffect(() => {
    if (user && !wsRef.current) {
      // Only connect if we don't already have a connection
      const timer = setTimeout(() => connect(), 200);
      return () => clearTimeout(timer);
    } else if (!user) {
      // Clean shutdown when user logs out
      if (wsRef.current) {
        wsRef.current.close(1000, 'User logged out');
        wsRef.current = null;
      }
      setIsConnected(false);
    }

    // Create event handlers for page visibility changes and offline/online status
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // When tab becomes visible, check connection and session
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          connect();
        }
        checkSession();
      }
    };

    const handleOnline = () => {
      // Network is back online, attempting to reconnect
      connect();
    };

    const handleOffline = () => {
      // Network connection is now offline
      setIsConnected(false);
    };

    // Listen for visibility and network status changes
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Cleanup function
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = undefined;
      }
      
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [user?.id]); // Only depend on user ID to prevent connection storms

  // Method to manually reconnect
  const reconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    retryCountRef.current = 0;
    connect();
  }, [connect]);

  return { isConnected, reconnect, lastMessage };
}