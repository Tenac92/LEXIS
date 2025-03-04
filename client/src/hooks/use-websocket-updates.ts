import { useEffect, useRef } from 'react';
import { queryClient } from '@/lib/queryClient';

export function useWebSocketUpdates() {
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WebSocket] Connected to server');
    };

    ws.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data);
        console.log('[WebSocket] Received update:', update);

        if (update.type === 'DOCUMENT_UPDATE' || update.type === 'PROTOCOL_UPDATE') {
          // Invalidate and refetch documents query
          queryClient.invalidateQueries({ queryKey: ['/api/documents/generated'] });
        }
      } catch (error) {
        console.error('[WebSocket] Error processing message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
    };

    ws.onclose = () => {
      console.log('[WebSocket] Disconnected from server');
    };

    return () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, []);

  return wsRef.current;
}
