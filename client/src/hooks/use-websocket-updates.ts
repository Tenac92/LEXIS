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
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/ws`;

        console.log('[WebSocket] Attempting to connect:', wsUrl);

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('[WebSocket] Connected successfully');
          setIsConnected(true);
          retryCount = 0; // Reset retry count on successful connection

          // Send initial connection message
          ws.send(JSON.stringify({ 
            type: 'connect',
            timestamp: new Date().toISOString()
          }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('[WebSocket] Received message:', data);

            // Handle different message types
            switch (data.type) {
              case 'notification':
                queryClient.invalidateQueries({ queryKey: ['/api/budget/notifications'] });
                toast({
                  title: 'New Notification',
                  description: data.message || 'New notification received',
                  variant: 'default'
                });
                break;
              case 'connection':
                console.log('[WebSocket] Connection confirmed:', data);
                break;
              case 'acknowledgment':
                console.log('[WebSocket] Acknowledgment received:', data);
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
          toast({
            title: 'Connection Error',
            description: 'Failed to connect to notification service',
            variant: 'destructive'
          });
        };

        ws.onclose = (event) => {
          console.log('[WebSocket] Connection closed:', event.code);
          setIsConnected(false);

          // Implement exponential backoff for reconnection
          if (retryCount < MAX_RETRIES) {
            const timeout = Math.min(1000 * Math.pow(2, retryCount), 10000);
            console.log(`[WebSocket] Attempting reconnect in ${timeout}ms`);

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

    // Cleanup function
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
