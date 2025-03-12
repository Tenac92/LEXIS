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
        // Use window.location.host to get hostname:port
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;

        console.log('[WebSocket] Attempting to connect:', wsUrl);

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('[WebSocket] Connected successfully');
          setIsConnected(true);
          retryCount = 0;

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

            switch (data.type) {
              case 'notification':
                // Invalidate notifications cache
                queryClient.invalidateQueries({ queryKey: ['/api/budget/notifications'] });

                // Show toast notification
                toast({
                  title: data.title || 'New Notification',
                  description: data.message,
                  variant: data.variant || 'default'
                });
                break;

              case 'connection':
              case 'acknowledgment':
                console.log(`[WebSocket] ${data.type} received:`, data);
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