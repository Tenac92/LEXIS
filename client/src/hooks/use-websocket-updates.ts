import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

export function useWebSocketUpdates() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number>();
  const [isConnected, setIsConnected] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const MAX_RETRIES = 5;
    let retryCount = 0;

    function connect() {
      try {
        // Get the correct websocket URL based on current location
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // Ensure we have a valid host - use current window host
        const host = window.location.host || document.location.host;
        
        if (!host) {
          console.error('[WebSocket] Cannot connect: No valid host detected');
          return;
        }
        
        const wsUrl = `${protocol}//${host}/ws`;
        console.log('[WebSocket] Attempting to connect:', wsUrl);

        // Add error handling to WebSocket constructor
        let ws: WebSocket;
        try {
          ws = new WebSocket(wsUrl, ['notifications']);
          wsRef.current = ws;
        } catch (wsError) {
          console.error('[WebSocket] Failed to create WebSocket connection:', wsError);
          setIsConnected(false);
          
          // Don't attempt immediate reconnect on constructor error to avoid infinite loops
          if (retryCount < MAX_RETRIES) {
            const timeout = Math.min(1000 * Math.pow(2, retryCount), 10000);
            console.log(`[WebSocket] Will retry in ${timeout}ms after constructor error`);
            
            if (reconnectTimeoutRef.current) {
              clearTimeout(reconnectTimeoutRef.current);
            }
            
            reconnectTimeoutRef.current = window.setTimeout(() => {
              retryCount++;
              connect();
            }, timeout);
          }
          return;
        }

        // Now that we have a valid ws object, set up event handlers
        ws.onopen = () => {
          console.log('[WebSocket] Connected successfully');
          setIsConnected(true);
          retryCount = 0;

          // Send initial connection message
          try {
            ws.send(JSON.stringify({ 
              type: 'connect',
              timestamp: new Date().toISOString()
            }));
          } catch (error) {
            console.error('[WebSocket] Failed to send initial message:', error);
          }
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('[WebSocket] Received message:', data);

            switch (data.type) {
              case 'notification':
                // Handle new notification
                queryClient.invalidateQueries({ queryKey: ['/api/budget/notifications'] });
                toast({
                  title: data.data?.reason || 'New Budget Notification',
                  description: `MIS: ${data.data?.mis} • Amount: €${Number(data.data?.amount).toLocaleString()}`,
                  variant: data.data?.type === 'funding' ? 'destructive' : 'default'
                });
                break;

              case 'connection':
              case 'acknowledgment':
                console.log(`[WebSocket] ${data.type} received:`, data);
                break;

              case 'error':
                console.error('[WebSocket] Server reported error:', data);
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
        };

        ws.onclose = (event) => {
          console.log('[WebSocket] Connection closed:', event.code);
          setIsConnected(false);
          wsRef.current = null;

          // Only attempt reconnection if we haven't exceeded max retries
          if (retryCount < MAX_RETRIES) {
            const timeout = Math.min(1000 * Math.pow(2, retryCount), 10000);
            console.log(`[WebSocket] Attempting reconnect in ${timeout}ms`);

            if (reconnectTimeoutRef.current) {
              clearTimeout(reconnectTimeoutRef.current);
            }

            reconnectTimeoutRef.current = window.setTimeout(() => {
              retryCount++;
              connect();
            }, timeout);
          } else {
            toast({
              title: 'Connection Lost',
              description: 'Unable to connect to notification service. Please refresh the page.',
              variant: 'destructive'
            });
          }
        };
      } catch (error) {
        console.error('[WebSocket] Setup error:', error);
        setIsConnected(false);
      }
    }

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [toast]);

  return { isConnected };
}