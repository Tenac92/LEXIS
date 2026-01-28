import { useEffect, useRef, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { BudgetUpdate } from '@/lib/types';

// Global connection pool to prevent duplicate connections in dev mode
const globalConnections = new Map<string, WebSocket>();

enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting', 
  CONNECTED = 'connected',
  ERROR = 'error'
}

export function useStableWebSocket() {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [lastMessage, setLastMessage] = useState<BudgetUpdate | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const connectionKeyRef = useRef<string>('');
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef<number>(0);

  const MAX_RETRIES = 3;
  const RETRY_DELAY = 5000;

  // Generate stable connection key based on user
  const getConnectionKey = useCallback(() => {
    return user?.id ? `ws_${user.id}` : '';
  }, [user?.id]);

  // Clean disconnect function
  const disconnect = useCallback((code = 1000, reason = 'Normal closure') => {
    const key = connectionKeyRef.current;
    if (key && globalConnections.has(key)) {
      const ws = globalConnections.get(key);
      if (ws && ws.readyState === WebSocket.OPEN) {
        console.log(`[StableWebSocket] Disconnecting: ${reason}`);
        ws.close(code, reason);
      }
      globalConnections.delete(key);
    }
    setConnectionState(ConnectionState.DISCONNECTED);
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  // Connect function
  const connect = useCallback(() => {
    if (!user?.id) {
      console.log('[StableWebSocket] No user, skipping connection');
      return;
    }

    const key = getConnectionKey();
    connectionKeyRef.current = key;

    // Check if connection already exists and is healthy
    if (globalConnections.has(key)) {
      const existingWs = globalConnections.get(key);
      if (existingWs && existingWs.readyState === WebSocket.OPEN) {
        console.log('[StableWebSocket] Using existing connection');
        setConnectionState(ConnectionState.CONNECTED);
        return;
      } else {
        // Clean up stale connection
        globalConnections.delete(key);
      }
    }

    console.log('[StableWebSocket] Creating new connection');
    setConnectionState(ConnectionState.CONNECTING);

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const port = window.location.port;
      const hostname = window.location.hostname;
      
      // Construct WebSocket URL with proper port handling
      let wsUrl;
      console.log('[StableWebSocket] URL construction:', { protocol, hostname, port });
      
      // Handle various port scenarios more robustly
      // Check if port is a valid non-default port number
      const portNum = port ? parseInt(port, 10) : NaN;
      const isValidPort = !isNaN(portNum) && portNum > 0 && portNum !== 80 && portNum !== 443;
      const hasCustomPort = port && port !== '' && port !== 'undefined' && typeof port === 'string' && isValidPort;
      
      if (hasCustomPort) {
        wsUrl = `${protocol}//${hostname}:${port}/ws`;
      } else {
        // For default ports or missing ports, don't include port in URL
        wsUrl = `${protocol}//${hostname}/ws`;
      }
      
      // Additional validation to ensure no undefined values
      if (wsUrl.includes('undefined') || wsUrl.includes(':undefined') || !hostname || hostname === 'undefined') {
        console.error('[StableWebSocket] Invalid URL detected:', wsUrl);
        console.error('[StableWebSocket] Window location:', window.location);
        console.error('[StableWebSocket] Parsed values:', { protocol, hostname, port });
        throw new Error('Invalid WebSocket URL - contains undefined or invalid values');
      }
      
      console.log('[StableWebSocket] Connecting to:', wsUrl);
      const ws = new WebSocket(wsUrl);
      
      globalConnections.set(key, ws);

      ws.onopen = () => {
        console.log('[StableWebSocket] Connected successfully');
        setConnectionState(ConnectionState.CONNECTED);
        retryCountRef.current = 0;
        
        // Send initial message
        ws.send(JSON.stringify({
          type: 'connect',
          timestamp: new Date().toISOString()
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle different message types
          switch (data.type) {
            case 'budget_update':
              setLastMessage(data);
              queryClient.invalidateQueries({ queryKey: ['/api/budget'] });
              break;
              
            case 'dashboard_refresh':
              queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
              queryClient.invalidateQueries({ queryKey: ['/api/budget-history'] });
              queryClient.invalidateQueries({ queryKey: ['budget'] }); // Invalidate budget queries for CreateDocumentDialog
              queryClient.invalidateQueries({ queryKey: ['budget-validation'] }); // Invalidate budget validation queries
              break;
              
            case 'beneficiary_update':
              queryClient.invalidateQueries({ queryKey: ['/api/beneficiaries'] });
              queryClient.invalidateQueries({ queryKey: ['/api/beneficiary-payments'] });
              break;
              
            case 'project_update':
              queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
              break;
              
            case 'budget_import_progress':
              queryClient.invalidateQueries({ queryKey: ['/api/budget-upload'] });
              break;
              
            case 'admin_operation':
              queryClient.invalidateQueries({ queryKey: ['/api/admin'] });
              toast({
                title: data.data.operation === 'quarter_transition' ? 'Τριμηνιαία Μετάβαση' : 'Λειτουργία Συστήματος',
                description: data.data.message || 'Ενημέρωση συστήματος',
              });
              break;
              
            case 'user_update':
              queryClient.invalidateQueries({ queryKey: ['/api/users'] });
              queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
              break;
              
            case 'reference_data_update':
              queryClient.invalidateQueries({ queryKey: ['/api/public/units'] });
              queryClient.invalidateQueries({ queryKey: ['/api/public/event-types'] });
              queryClient.invalidateQueries({ queryKey: ['/api/public/expenditure-types'] });
              break;
              
            case 'DOCUMENT_UPDATE':
            case 'PROTOCOL_UPDATE':
              queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
              break;
              
            case 'realtime_notification':
              toast({
                title: data.data.title,
                description: data.data.message,
                variant: data.data.type === 'error' ? 'destructive' : 'default',
              });
              break;
          }
        } catch (error) {
          console.error('[StableWebSocket] Failed to parse message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[StableWebSocket] Connection error:', error);
        setConnectionState(ConnectionState.ERROR);
      };

      ws.onclose = (event) => {
        console.log(`[StableWebSocket] Connection closed with code: ${event.code}, reason: ${event.reason}`);
        globalConnections.delete(key);
        setConnectionState(ConnectionState.DISCONNECTED);

        // Only auto-reconnect if user is still logged in and we haven't exceeded retries
        if (user?.id && retryCountRef.current < MAX_RETRIES && event.code !== 1000) {
          retryCountRef.current += 1;
          console.log(`[StableWebSocket] Reconnecting in ${RETRY_DELAY}ms (attempt ${retryCountRef.current})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            if (user?.id && connectionKeyRef.current === key) {
              connect();
            }
          }, RETRY_DELAY);
        } else if (event.code !== 1000) {
          console.log('[StableWebSocket] Max retries reached or user logged out');
          setConnectionState(ConnectionState.ERROR);
          toast({
            title: "Σφάλμα Σύνδεσης",
            description: "Αποτυχία σύνδεσης με τον διακομιστή. Παρακαλώ ανανεώστε τη σελίδα.",
            variant: "destructive"
          });
        }
      };

    } catch (error) {
      console.error('[StableWebSocket] Failed to create connection:', error);
      setConnectionState(ConnectionState.ERROR);
      globalConnections.delete(key);
    }
  }, [user?.id, getConnectionKey, toast]);

  // Manual reconnection
  const reconnect = useCallback(() => {
    console.log('[StableWebSocket] Manual reconnect requested');
    retryCountRef.current = 0;
    disconnect(1000, 'Manual reconnect');
    setTimeout(() => connect(), 1000);
  }, [connect, disconnect]);

  // Connection management effect
  useEffect(() => {
    if (user?.id && connectionState === ConnectionState.DISCONNECTED) {
      // Delay connection to prevent rapid reconnections during navigation
      const timer = setTimeout(() => {
        connect();
      }, 2000);
      return () => clearTimeout(timer);
    } else if (!user?.id && connectionState !== ConnectionState.DISCONNECTED) {
      disconnect(1000, 'User logged out');
    }
  }, [user?.id, connectionState, connect, disconnect]);

  // Cleanup on unmount (only in production)
  useEffect(() => {
    return () => {
      if (process.env.NODE_ENV === 'production') {
        disconnect(1000, 'Component unmounting');
      }
    };
  }, [disconnect]);

  return {
    isConnected: connectionState === ConnectionState.CONNECTED,
    connectionState,
    lastMessage,
    reconnect,
    disconnect
  };
}