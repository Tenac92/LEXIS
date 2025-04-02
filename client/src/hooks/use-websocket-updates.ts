import { useEffect, useRef, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';

export function useWebSocketUpdates() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | undefined>(undefined);
  const retryCountRef = useRef<number>(0);
  const [isConnected, setIsConnected] = useState(false);
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

  // Connect to WebSocket
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

    const MAX_RETRIES = 5;
    
    try {
      // Clean up any existing connection
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch (error) {
          console.error('[WebSocket] Error closing existing connection:', error);
        }
        wsRef.current = null;
      }

      // Get the correct websocket URL based on current location
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host || document.location.host;
      
      if (!host) {
        console.error('[WebSocket] Cannot connect: No valid host detected');
        return;
      }
      
      const wsUrl = `${protocol}//${host}/ws`;
      console.log('[WebSocket] Attempting to connect:', wsUrl);

      // Create new WebSocket connection
      try {
        const ws = new WebSocket(wsUrl, ['notifications']);
        wsRef.current = ws;

        // Set up event handlers
        ws.onopen = () => {
          console.log('[WebSocket] Connected successfully');
          setIsConnected(true);
          retryCountRef.current = 0;

          // Send initial connection message
          try {
            ws.send(JSON.stringify({ 
              type: 'connect',
              timestamp: new Date().toISOString()
            }));
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
                // Handle new notification
                queryClient.invalidateQueries({ queryKey: ['/api/budget/notifications'] });
                
                // Display toast notification
                toast({
                  title: data.data?.reason || 'New Budget Notification',
                  description: `MIS: ${data.data?.mis} • Amount: €${Number(data.data?.amount || 0).toLocaleString('el-GR')}`,
                  variant: data.data?.type === 'funding' ? 'destructive' : 'default'
                });
                
                // Verify our session is still valid
                checkSession();
                break;

              case 'connection':
              case 'acknowledgment':
                console.log(`[WebSocket] ${data.type} received:`, data);
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
          console.log('[WebSocket] Connection closed. Code:', event.code);
          setIsConnected(false);
          wsRef.current = null;

          // Check if our session is still valid
          checkSession();

          // Only attempt reconnection if we haven't exceeded max retries
          if (retryCountRef.current < MAX_RETRIES) {
            // Exponential backoff for reconnection attempts
            const backoff = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000);
            console.log(`[WebSocket] Attempting reconnect in ${backoff}ms (attempt ${retryCountRef.current + 1}/${MAX_RETRIES})`);

            if (reconnectTimeoutRef.current) {
              clearTimeout(reconnectTimeoutRef.current);
            }

            reconnectTimeoutRef.current = window.setTimeout(() => {
              retryCountRef.current += 1;
              connect();
            }, backoff);
          } else {
            console.warn('[WebSocket] Maximum reconnection attempts reached');
            
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

  return { isConnected, reconnect };
}