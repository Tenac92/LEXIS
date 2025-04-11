import { useEffect, useRef, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { BudgetUpdate } from '@/lib/types';

// For backward compatibility, keep the old type name as well
export interface BudgetUpdateMessage extends BudgetUpdate {}

export function useWebSocketUpdates() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | undefined>(undefined);
  const retryCountRef = useRef<number>(0);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<BudgetUpdate | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Function to check session status
  const checkSession = useCallback(async () => {
    try {
      await queryClient.refetchQueries({ queryKey: ['/api/auth/me'] });
    } catch (error) {
      console.error('[WebSocket] Session check failed:', error);
    }
  }, []);

  // Connect to WebSocket with improved error handling
  const connect = useCallback(() => {
    if (!user) {
      console.log('[WebSocket] Not connecting, no authenticated user');
      return;
    }

    // If we already have a connection, don't reconnect
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] Already connected');
      return;
    }

    // Careful shutdown of any existing connection
    if (wsRef.current) {
      try {
        // Only close if not already closed or closing
        if (wsRef.current.readyState !== WebSocket.CLOSED && 
            wsRef.current.readyState !== WebSocket.CLOSING) {
          wsRef.current.close();
        }
      } catch (error) {
        console.error('[WebSocket] Error closing existing connection:', error);
      } finally {
        // Always null out the reference to prevent memory leaks
        wsRef.current = null;
      }
    }

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
      console.log('[WebSocket] Attempting to connect:', wsUrl);

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

        // Set up event handlers
        ws.onopen = () => {
          console.log('[WebSocket] Connected successfully');
          clearTimeout(connectionTimeout); // Clear the timeout on successful connection
          setIsConnected(true);
          retryCountRef.current = 0;

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
            console.log('[WebSocket] Received message:', data);

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
                console.log(`[WebSocket] Received budget update for MIS ${budgetUpdate.mis}: €${budgetUpdate.amount.toLocaleString('el-GR')}`);
                
                // If we have the simplified budget data, log it
                if (budgetUpdate.simpleBudgetData) {
                  console.log('[WebSocket] Received simplified budget data:', budgetUpdate.simpleBudgetData);
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
                  console.log('[WebSocket] Processing our own budget update to update UI');
                }
                break;

              case 'connection':
              case 'acknowledgment':
                console.log(`[WebSocket] ${data.type} received:`, data);
                
                // When we connect, generate and store a unique session ID if we don't have one
                if (data.type === 'connection' && !sessionStorage.getItem('clientSessionId')) {
                  const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
                  sessionStorage.setItem('clientSessionId', newSessionId);
                  console.log(`[WebSocket] Generated new client session ID: ${newSessionId}`);
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
                console.log('[WebSocket] Unhandled message type:', data.type);
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
          console.log('[WebSocket] Connection closed:', event.code, event.reason);
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
                console.log('[WebSocket] Clean closure, will reconnect');
                return true;
                
              // Going away (browser navigating away)
              case 1001:
                console.log('[WebSocket] Browser navigating away');
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
            
            console.log(`[WebSocket] Attempting reconnect in ${backoff}ms (attempt ${retryCountRef.current + 1}/${MAX_RETRIES})`);

            if (reconnectTimeoutRef.current) {
              clearTimeout(reconnectTimeoutRef.current);
            }

            reconnectTimeoutRef.current = window.setTimeout(() => {
              retryCountRef.current += 1;
              connect();
            }, backoff);
          } else if (!shouldReconnect) {
            console.log('[WebSocket] Not attempting reconnect due to close code');
            // Still make sure the session is valid
            queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
          } else {
            console.warn('[WebSocket] Maximum reconnection attempts reached');
            
            // Reset retry count after a longer timeout to allow future reconnects
            setTimeout(() => {
              console.log('[WebSocket] Resetting retry count after cooldown');
              retryCountRef.current = 0;
            }, 60000); // 1 minute cooldown
            
            // Final check to see if our session is still valid
            queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
          }
        };
      } catch (error) {
        console.error('[WebSocket] Error creating WebSocket:', error);
        setIsConnected(false);
        
        // Check our session if WebSocket creation fails
        checkSession();
      }
    } catch (error) {
      console.error('[WebSocket] Setup error:', error);
      setIsConnected(false);
    }
  }, [user, toast, checkSession]);

  // Effect to connect WebSocket and manage reconnection
  useEffect(() => {
    if (user) {
      connect();
    } else {
      // If no user, close any existing connection
      if (wsRef.current) {
        wsRef.current.close();
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
      console.log('[WebSocket] Network online, reconnecting...');
      connect();
    };

    const handleOffline = () => {
      console.log('[WebSocket] Network offline');
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
  }, [user, connect, checkSession]);

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