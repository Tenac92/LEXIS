import { useEffect, useRef, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { BudgetUpdate } from '@/lib/types';

/**
 * Stable WebSocket hook that prevents connection storms
 * Does not rely on session validation for connection management
 */
export function useStableWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef<number>(0);
  const connectionIdRef = useRef<string>('');
  const isConnectingRef = useRef<boolean>(false);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<BudgetUpdate | null>(null);
  const { toast } = useToast();

  const MAX_RETRIES = 3; // Reduced from 5
  const BASE_RETRY_DELAY = 5000; // Increased to 5 seconds
  const MAX_RETRY_DELAY = 30000;

  // Generate unique connection ID
  const generateConnectionId = useCallback(() => {
    return `stable_ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Clean disconnect function
  const disconnect = useCallback((code = 1000, reason = 'Disconnecting') => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      const currentWs = wsRef.current;
      wsRef.current = null;
      
      if (currentWs.readyState === WebSocket.OPEN || currentWs.readyState === WebSocket.CONNECTING) {
        try {
          currentWs.close(code, reason);
        } catch (error) {
          console.error('[StableWebSocket] Error during disconnect:', error);
        }
      }
    }

    setIsConnected(false);
    connectionIdRef.current = '';
    retryCountRef.current = 0;
    isConnectingRef.current = false;
  }, []);

  // Connect function without session dependency
  const connect = useCallback(() => {
    // Prevent multiple concurrent connections
    if (isConnectingRef.current || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    isConnectingRef.current = true;
    disconnect(); // Clean up any existing connection

    const connectionId = generateConnectionId();
    connectionIdRef.current = connectionId;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws?t=${Date.now()}`;

      const ws = new WebSocket(wsUrl, ['notifications']);
      wsRef.current = ws;

      // Connection timeout
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.warn('[StableWebSocket] Connection timeout');
          ws.close();
        }
      }, 15000); // Increased timeout

      ws.onopen = () => {
        if (connectionIdRef.current === connectionId) {
          clearTimeout(connectionTimeout);
          setIsConnected(true);
          retryCountRef.current = 0;
          isConnectingRef.current = false;

          console.log('[StableWebSocket] Connected successfully');

          // Send initial connection message
          try {
            ws.send(JSON.stringify({ 
              type: 'connect', 
              timestamp: new Date().toISOString() 
            }));
          } catch (error) {
            console.error('[StableWebSocket] Error sending initial message:', error);
          }
        }
      };

      ws.onmessage = (event) => {
        if (connectionIdRef.current !== connectionId) return;
        
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);

          // Handle different message types
          switch (data.type) {
            case 'budget_update':
              queryClient.invalidateQueries({ queryKey: ['/api/budget'] });
              queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
              if (data.message) {
                toast({
                  title: "Ενημέρωση Προϋπολογισμού",
                  description: data.message,
                });
              }
              break;
            case 'project_update':
              queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
              if (data.message) {
                toast({
                  title: "Ενημέρωση Έργου",
                  description: data.message,
                });
              }
              break;
            case 'beneficiary_update':
              queryClient.invalidateQueries({ queryKey: ['/api/beneficiaries'] });
              queryClient.invalidateQueries({ queryKey: ['/api/beneficiary-payments'] });
              break;
          }
        } catch (error) {
          console.error('[StableWebSocket] Error processing message:', error);
        }
      };

      ws.onerror = (error) => {
        if (connectionIdRef.current === connectionId) {
          console.error('[StableWebSocket] Connection error:', error);
          setIsConnected(false);
          isConnectingRef.current = false;
        }
      };

      ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        
        if (connectionIdRef.current === connectionId) {
          setIsConnected(false);
          isConnectingRef.current = false;
          wsRef.current = null;

          console.log(`[StableWebSocket] Connection closed with code: ${event.code}, reason: ${event.reason}`);

          // Only reconnect on unexpected closures and if we haven't exceeded retry limit
          const shouldReconnect = 
            retryCountRef.current < MAX_RETRIES && 
            event.code !== 1000 && // Normal closure
            document.visibilityState === 'visible';

          if (shouldReconnect) {
            const backoff = Math.min(
              BASE_RETRY_DELAY * Math.pow(2, retryCountRef.current), 
              MAX_RETRY_DELAY
            );
            
            console.log(`[StableWebSocket] Reconnecting in ${backoff}ms (attempt ${retryCountRef.current + 1})`);
            
            reconnectTimeoutRef.current = setTimeout(() => {
              if (connectionIdRef.current === connectionId) {
                retryCountRef.current += 1;
                connect();
              }
            }, backoff);
          } else {
            console.log('[StableWebSocket] Not reconnecting - normal closure or retry limit reached');
          }
        }
      };

    } catch (error) {
      console.error('[StableWebSocket] Setup error:', error);
      setIsConnected(false);
      isConnectingRef.current = false;
    }
  }, [generateConnectionId, disconnect, toast]);

  // Auto-connect on mount, disconnect on unmount
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Handle visibility changes to prevent unnecessary connections
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        disconnect();
      } else if (document.visibilityState === 'visible' && !wsRef.current) {
        setTimeout(() => connect(), 1000); // Delay reconnection
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [connect, disconnect]);

  return {
    isConnected,
    lastMessage,
    connect: () => {
      if (!isConnectingRef.current) {
        connect();
      }
    },
    disconnect
  };
}