import { useEffect, useRef, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { BudgetUpdate } from '@/lib/types';

// Connection states for better tracking
enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

export function useRobustWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectionIdRef = useRef<string>('');
  const retryCountRef = useRef<number>(0);
  const connectionStateRef = useRef<ConnectionState>(ConnectionState.DISCONNECTED);
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [lastMessage, setLastMessage] = useState<BudgetUpdate | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const MAX_RETRIES = 5;
  const BASE_RETRY_DELAY = 1000;
  const MAX_RETRY_DELAY = 30000;

  // Generate unique connection ID
  const generateConnectionId = useCallback(() => {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
          console.error('[RobustWebSocket] Error during disconnect:', error);
        }
      }
    }

    setConnectionState(ConnectionState.DISCONNECTED);
    connectionStateRef.current = ConnectionState.DISCONNECTED;
    connectionIdRef.current = '';
    retryCountRef.current = 0;
  }, []);

  // Robust connection function with proper cleanup
  const connect = useCallback(async () => {
    if (!user) {
      disconnect(4000, 'No authenticated user');
      return;
    }

    // Prevent duplicate connections - use ref state for accuracy
    if (connectionStateRef.current === ConnectionState.CONNECTING || connectionStateRef.current === ConnectionState.CONNECTED) {
      return;
    }

    // Clean up any existing connection only if it exists
    if (wsRef.current) {
      disconnect(1000, 'Creating new connection');
    }

    const connectionId = generateConnectionId();
    connectionIdRef.current = connectionId;
    setConnectionState(ConnectionState.CONNECTING);
    connectionStateRef.current = ConnectionState.CONNECTING;

    try {
      // Construct WebSocket URL with protocol detection
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const hostname = window.location.hostname;
      const port = window.location.port;
      
      // Validate essential components
      if (!hostname || hostname === 'undefined' || hostname === 'null') {
        console.error('[RobustWebSocket] Invalid hostname detected:', hostname);
        console.error('[RobustWebSocket] Window location:', window.location);
        throw new Error('Invalid WebSocket hostname - cannot connect');
      }
      
      // Construct WebSocket URL with proper port handling
      let wsUrl;
      console.log('[RobustWebSocket] URL construction:', { protocol, hostname, port });
      
      // Only include port if it's not a standard port and not empty/undefined
      const shouldIncludePort = port && 
                                port !== 'undefined' && 
                                port !== 'null' && 
                                port !== '' && 
                                port !== '80' && 
                                port !== '443';
      
      if (shouldIncludePort) {
        wsUrl = `${protocol}//${hostname}:${port}/ws?t=${Date.now()}`;
      } else {
        wsUrl = `${protocol}//${hostname}/ws?t=${Date.now()}`;
      }
      
      // Final validation for any undefined values
      if (wsUrl.includes('undefined') || wsUrl.includes('null')) {
        console.error('[RobustWebSocket] Invalid URL detected:', wsUrl);
        console.error('[RobustWebSocket] Window location:', window.location);
        throw new Error('Invalid WebSocket URL - contains undefined/null values');
      }
      
      console.log('[RobustWebSocket] Connecting to:', wsUrl);
      const ws = new WebSocket(wsUrl, ['notifications']);
      wsRef.current = ws;

      // Connection timeout
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN && connectionIdRef.current === connectionId) {
          console.warn('[RobustWebSocket] Connection timeout');
          ws.close(4001, 'Connection timeout');
        }
      }, 10000);

      // WebSocket event handlers
      ws.onopen = () => {
        if (connectionIdRef.current !== connectionId) return;
        
        clearTimeout(connectionTimeout);
        setConnectionState(ConnectionState.CONNECTED);
        connectionStateRef.current = ConnectionState.CONNECTED;
        retryCountRef.current = 0;

        // Send initial connection message
        try {
          ws.send(JSON.stringify({ 
            type: 'connect', 
            timestamp: new Date().toISOString(),
            connectionId 
          }));
        } catch (error) {
          console.error('[RobustWebSocket] Error sending initial message:', error);
        }
      };

      ws.onmessage = (event) => {
        if (connectionIdRef.current !== connectionId) return;

        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);

          // Handle different message types
          if (data.type === 'budget_update') {
            // Invalidate budget-related queries
            queryClient.invalidateQueries({ queryKey: ['/api/budget'] });
          } else if (data.type === 'project_update') {
            // Invalidate project-related queries
            queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
          } else if (data.type === 'DOCUMENT_CREATED') {
            // Invalidate documents-related queries
            queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
          }
        } catch (error) {
          console.error('[RobustWebSocket] Error parsing message:', error);
        }
      };

      ws.onerror = (error) => {
        if (connectionIdRef.current !== connectionId) return;
        
        console.error('[RobustWebSocket] Connection error:', error);
        setConnectionState(ConnectionState.ERROR);
        connectionStateRef.current = ConnectionState.ERROR;
      };

      ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        
        if (connectionIdRef.current !== connectionId) return;

        const wasConnected = connectionStateRef.current === ConnectionState.CONNECTED;
        setConnectionState(ConnectionState.DISCONNECTED);
        connectionStateRef.current = ConnectionState.DISCONNECTED;

        // Determine if we should attempt reconnection
        const shouldReconnect = 
          retryCountRef.current < MAX_RETRIES && 
          event.code !== 1000 && // Normal closure
          event.code !== 4000 && // Intentional disconnection
          user; // Only reconnect if user is still authenticated

        if (shouldReconnect && wasConnected) {
          setConnectionState(ConnectionState.RECONNECTING);
          connectionStateRef.current = ConnectionState.RECONNECTING;
          
          // Calculate retry delay with exponential backoff and jitter
          const baseDelay = Math.min(BASE_RETRY_DELAY * Math.pow(2, retryCountRef.current), MAX_RETRY_DELAY);
          const jitter = Math.random() * 1000;
          const retryDelay = baseDelay + jitter;

          retryCountRef.current += 1;

          reconnectTimeoutRef.current = setTimeout(() => {
            if (connectionIdRef.current === connectionId) {
              connect();
            }
          }, retryDelay);
        } else if (!shouldReconnect && event.code !== 1000) {
          // Check session validity on abnormal closure
          queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
        }
      };

    } catch (error) {
      console.error('[RobustWebSocket] Failed to create WebSocket:', error);
      setConnectionState(ConnectionState.ERROR);
      
      if (connectionIdRef.current === connectionId) {
        // Retry connection after delay if we haven't exceeded max retries
        if (retryCountRef.current < MAX_RETRIES) {
          const retryDelay = Math.min(BASE_RETRY_DELAY * Math.pow(2, retryCountRef.current), MAX_RETRY_DELAY);
          retryCountRef.current += 1;
          
          reconnectTimeoutRef.current = setTimeout(() => {
            if (connectionIdRef.current === connectionId) {
              connect();
            }
          }, retryDelay);
        }
      }
    }
  }, [user, connectionState, disconnect, generateConnectionId]);

  // Manual reconnection function
  const reconnect = useCallback(() => {
    retryCountRef.current = 0;
    connect();
  }, [connect]);

  // Effect for managing connection lifecycle
  useEffect(() => {
    if (user && connectionStateRef.current === ConnectionState.DISCONNECTED) {
      // Longer delay to prevent rapid connection attempts during React development mode
      const timer = setTimeout(() => {
        connect();
      }, 1000);
      
      return () => clearTimeout(timer);
    } else if (!user && connectionState !== ConnectionState.DISCONNECTED) {
      disconnect(4000, 'User logged out');
    }
  }, [user?.id, connect, disconnect, connectionState]);

  // Page visibility change handler
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user) {
        // Check connection when page becomes visible
        if (connectionState === ConnectionState.DISCONNECTED) {
          setTimeout(() => connect(), 500);
        }
        // Refresh user session
        queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user, connectionState, connect]);

  // Cleanup on unmount - only in production or when user logs out
  useEffect(() => {
    return () => {
      // In development mode, preserve connections to prevent constant reconnection
      if (process.env.NODE_ENV === 'production' || !user) {
        disconnect(1000, 'Component unmounting');
      }
    };
  }, [disconnect, user]);

  return {
    isConnected: connectionState === ConnectionState.CONNECTED,
    connectionState,
    lastMessage,
    reconnect,
    disconnect: () => disconnect(1000, 'Manual disconnect')
  };
}