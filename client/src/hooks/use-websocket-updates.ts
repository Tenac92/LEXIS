import { useEffect, useRef, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { BudgetUpdate } from '@/lib/types';

export interface BudgetUpdateMessage extends BudgetUpdate {}

export function useWebSocketUpdates() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const retryCountRef = useRef<number>(0);
  const connectionIdRef = useRef<string>('');
  const isConnectingRef = useRef<boolean>(false);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<BudgetUpdate | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const MAX_RETRIES = 5;
  const BASE_RETRY_DELAY = 1000;

  // Generate unique connection ID for tracking
  const generateConnectionId = useCallback(() => {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Check session status when WebSocket issues occur
  const checkSession = useCallback(async () => {
    try {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    } catch (error) {
      console.error('[WebSocket] Error checking session:', error);
    }
  }, []);

  // Clean up existing connection
  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      try {
        wsRef.current.close(1000, 'Cleanup');
      } catch (error) {
        console.error('[WebSocket] Error during cleanup:', error);
      }
      wsRef.current = null;
    }

    setIsConnected(false);
    isConnectingRef.current = false;
  }, []);

  // Robust WebSocket connection with proper error handling
  const connect = useCallback(() => {
    if (!user || isConnectingRef.current) {
      return;
    }

    isConnectingRef.current = true;
    cleanup();

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
          console.warn('[WebSocket] Connection timeout');
          ws.close();
        }
      }, 10000);

      ws.onopen = () => {
        if (connectionIdRef.current === connectionId) {
          clearTimeout(connectionTimeout);
          setIsConnected(true);
          retryCountRef.current = 0;
          isConnectingRef.current = false;

          // Send initial connection message
          try {
            ws.send(JSON.stringify({ 
              type: 'connect', 
              timestamp: new Date().toISOString() 
            }));
          } catch (error) {
            console.error('[WebSocket] Error sending initial message:', error);
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
          console.error('[WebSocket] Error processing message:', error);
        }
      };

      ws.onerror = (error) => {
        if (connectionIdRef.current === connectionId) {
          console.error('[WebSocket] Connection error:', error);
          setIsConnected(false);
          isConnectingRef.current = false;
          checkSession();
        }
      };

      ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        
        if (connectionIdRef.current === connectionId) {
          setIsConnected(false);
          isConnectingRef.current = false;
          wsRef.current = null;

          console.log(`[WebSocket] Connection closed with code: ${event.code}`);

          // Check if this is a session expiry closure
          const isSessionExpired = event.reason === 'Session expired' || 
                                   event.code === 4001 || 
                                   (event.code === 1000 && event.reason === 'Session expired');

          // Determine if we should reconnect
          const shouldReconnect = 
            retryCountRef.current < MAX_RETRIES && 
            event.code !== 1000 && // Normal closure
            event.code !== 4000 && // Authentication error
            event.code !== 4001 && // Session expired
            !isSessionExpired && // Explicit session expiry check
            user && 
            document.visibilityState === 'visible';

          if (isSessionExpired) {
            console.log('[WebSocket] Connection closed due to session expiry, checking session status');
            // For session expiry, don't reconnect immediately - check session first
            checkSession();
          } else if (shouldReconnect) {
            const backoff = Math.min(
              BASE_RETRY_DELAY * Math.pow(2, retryCountRef.current), 
              30000
            );
            
            reconnectTimeoutRef.current = setTimeout(() => {
              if (connectionIdRef.current === connectionId) {
                retryCountRef.current += 1;
                connect();
              }
            }, backoff);
          } else if (event.code === 4000) {
            // Authentication issue - check session
            checkSession();
          }
        }
      };

    } catch (error) {
      console.error('[WebSocket] Setup error:', error);
      setIsConnected(false);
      isConnectingRef.current = false;
    }
  }, [user, cleanup, generateConnectionId, checkSession, toast]);

  // Connection management effect
  useEffect(() => {
    if (user && !wsRef.current && !isConnectingRef.current) {
      const timer = setTimeout(() => connect(), 100);
      return () => clearTimeout(timer);
    }
  }, [user, connect]);

  // Cleanup on unmount or user change
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Handle visibility changes to prevent unnecessary connections
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        cleanup();
      } else if (document.visibilityState === 'visible' && user && !wsRef.current) {
        setTimeout(() => connect(), 500);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user, connect, cleanup]);

  return {
    isConnected,
    lastMessage,
    connect: () => {
      if (!isConnectingRef.current) {
        connect();
      }
    },
    disconnect: cleanup
  };
}