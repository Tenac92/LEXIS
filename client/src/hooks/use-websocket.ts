import { useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const hostname = window.location.hostname;
    const port = window.location.port || (protocol === 'wss:' ? '443' : '80');
    const wsUrl = `${protocol}//${hostname}:${port}/ws`;

    function connect() {
      try {
        console.log('[WebSocket] Attempting to connect to:', wsUrl);
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('[WebSocket] Connected successfully');
          toast({
            title: 'Connected',
            description: 'Real-time notifications enabled',
            variant: 'default'
          });
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'notification') {
              toast({
                title: data.title || 'New Notification',
                description: data.message,
                variant: data.variant || 'default'
              });
            }
          } catch (error) {
            console.error('[WebSocket] Failed to process message:', error);
          }
        };

        ws.onerror = (error) => {
          console.error('[WebSocket] Error:', error);
          toast({
            title: 'Connection Error',
            description: 'Failed to establish real-time connection',
            variant: 'destructive'
          });
        };

        ws.onclose = (event) => {
          console.log('[WebSocket] Disconnected with code:', event.code);
          setTimeout(connect, 5000); // Reconnect after 5 seconds
        };
      } catch (error) {
        console.error('[WebSocket] Connection failed:', error);
        setTimeout(connect, 5000); // Retry connection after 5 seconds
      }
    }

    connect();

    return () => {
      if (wsRef.current) {
        console.log('[WebSocket] Cleaning up connection');
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  return wsRef.current;
}