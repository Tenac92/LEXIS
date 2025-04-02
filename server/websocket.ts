import { WebSocket, WebSocketServer } from 'ws';
import type { Server } from 'http';
import type { BudgetNotification } from '@shared/schema';

const WS_PATH = '/ws';

interface ExtendedWebSocket extends WebSocket {
  isAlive: boolean;
  clientId?: string;
}

export function createWebSocketServer(server: Server) {
  try {
    const wss = new WebSocketServer({ 
      server,
      path: WS_PATH,
      clientTracking: true,
      handleProtocols: () => 'notifications'
    });

    console.log(`[WebSocket] Server initialized on path: ${WS_PATH}`);

    wss.on('connection', (ws: ExtendedWebSocket, req) => {
      // Generate a more unique client ID with timestamp
      const clientId = `${Math.random().toString(36).substring(7)}${Date.now().toString(36)}`;
      ws.clientId = clientId;
      console.log(`[WebSocket] New client connected: ${clientId} from ${req.socket.remoteAddress}`);

      // Mark as alive immediately
      ws.isAlive = true;

      // Try to send a welcome message
      try {
        const welcomeMessage = JSON.stringify({ 
          type: 'connection',
          message: 'Connected to notification service',
          clientId,
          timestamp: new Date().toISOString()
        });
        
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(welcomeMessage);
        } else {
          console.warn(`[WebSocket] Cannot send welcome message to ${clientId}, socket not open`);
        }
      } catch (error) {
        console.error('[WebSocket] Failed to send welcome message:', error);
      }

      // Handle pong response (keep-alive)
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      // Handle incoming messages
      ws.on('message', (data) => {
        try {
          // Try to parse the message as JSON
          let message;
          try {
            message = JSON.parse(data.toString());
          } catch (parseError) {
            console.error(`[WebSocket] Invalid JSON from ${clientId}:`, data.toString().substring(0, 100));
            throw new Error('Invalid message format: expected JSON');
          }
          
          console.log(`[WebSocket] Received message from ${clientId}:`, message);

          // Send acknowledgment
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'acknowledgment',
              message: 'Message received',
              timestamp: new Date().toISOString()
            }));
          }
        } catch (error) {
          console.error(`[WebSocket] Error processing message from ${clientId}:`, error);

          // Send error notification back to client
          try {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'error',
                message: error instanceof Error ? error.message : 'Failed to process message',
                timestamp: new Date().toISOString()
              }));
            }
          } catch (sendError) {
            console.error(`[WebSocket] Failed to send error message to ${clientId}:`, sendError);
          }
        }
      });

      // Handle connection errors
      ws.on('error', (error) => {
        console.error('[WebSocket] Client error:', {
          clientId,
          address: req.socket.remoteAddress,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      });

      // Handle connection close
      ws.on('close', (code, reason) => {
        console.log('[WebSocket] Client disconnected:', {
          clientId,
          address: req.socket.remoteAddress,
          code,
          reason: reason.toString() || 'No reason provided',
          timestamp: new Date().toISOString()
        });

        // Cleanup
        ws.isAlive = false;
      });
    });

    // Set up more frequent heartbeat interval (15 seconds instead of 30)
    const heartbeatInterval = setInterval(() => {
      // Count active/inactive clients for logging
      let activeCount = 0;
      let inactiveCount = 0;
      
      (wss.clients as Set<ExtendedWebSocket>).forEach((ws) => {
        // Check if this client was marked as inactive in the previous cycle
        if (ws.isAlive === false) {
          console.log(`[WebSocket] Terminating inactive connection: ${ws.clientId}`);
          inactiveCount++;
          
          try {
            ws.terminate();
          } catch (error) {
            console.error(`[WebSocket] Error terminating client ${ws.clientId}:`, error);
          }
          return;
        }

        // Mark as inactive for this cycle (will be marked active again on pong)
        ws.isAlive = false;
        activeCount++;
        
        // Send ping and handle errors
        try {
          ws.ping(null, false, (err) => {
            if (err) {
              console.error(`[WebSocket] Ping error for client ${ws.clientId}:`, err);
              // Mark for termination in next cycle if ping fails
              ws.isAlive = false;
            }
          });
        } catch (error) {
          console.error(`[WebSocket] Failed to ping client ${ws.clientId}:`, error);
          // Terminate immediately if we can't even send a ping
          try {
            ws.terminate();
          } catch (terminateError) {
            console.error(`[WebSocket] Error terminating client after ping failure:`, terminateError);
          }
        }
      });
      
      // Log heartbeat results
      if (wss.clients.size > 0) {
        console.log(`[WebSocket] Heartbeat - Clients: ${wss.clients.size} (${activeCount} active, ${inactiveCount} terminated)`);
      }
    }, 15000); // Run every 15 seconds

    // Make sure we clean up the interval when the server closes
    wss.on('close', () => {
      console.log('[WebSocket] Server closing, clearing heartbeat interval');
      clearInterval(heartbeatInterval);
    });

    return wss;
  } catch (error) {
    console.error('[WebSocket] Failed to initialize:', error);
    throw error;
  }
}

export const broadcastNotification = (wss: WebSocketServer, notification: BudgetNotification) => {
  if (!wss) {
    console.error('[WebSocket] Broadcast failed: Server not initialized');
    return;
  }

  // Early return if no clients connected
  if (wss.clients.size === 0) {
    console.log('[WebSocket] No clients connected, skipping broadcast');
    return;
  }

  // Create notification message
  const message = JSON.stringify({
    type: 'notification',
    data: notification,
    timestamp: new Date().toISOString()
  });

  // Keep track of successful sends and errors
  let sentCount = 0;
  let errorCount = 0;
  const clientList = Array.from(wss.clients) as ExtendedWebSocket[];
  
  // Group clients by readyState for better logging
  const openClients = clientList.filter(client => client.readyState === WebSocket.OPEN);
  const closingClients = clientList.filter(client => client.readyState === WebSocket.CLOSING);
  const closedClients = clientList.filter(client => client.readyState === WebSocket.CLOSED);
  const connectingClients = clientList.filter(client => client.readyState === WebSocket.CONNECTING);
  
  // Log clients state
  console.log('[WebSocket] Client states before broadcast:', {
    total: wss.clients.size,
    open: openClients.length,
    closing: closingClients.length,
    closed: closedClients.length,
    connecting: connectingClients.length
  });

  // Only send to OPEN clients
  openClients.forEach((client) => {
    try {
      client.send(message);
      sentCount++;
    } catch (error) {
      errorCount++;
      console.error(`[WebSocket] Failed to send to client ${client.clientId}:`, error);
      
      // Mark client as not alive so it will be cleaned up in next heartbeat
      client.isAlive = false;
    }
  });

  console.log(`[WebSocket] Broadcast notification results: ${sentCount} successful, ${errorCount} failed`);
  
  return {
    success: sentCount > 0,
    sentCount,
    errorCount
  };
};