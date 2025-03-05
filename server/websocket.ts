import { WebSocket, WebSocketServer } from 'ws';
import type { Server } from 'http';
import type { BudgetNotification } from '@shared/schema';

const WS_PATH = '/ws';

export function createWebSocketServer(server: Server) {
  try {
    const wss = new WebSocketServer({ 
      server,
      path: WS_PATH,
      clientTracking: true
    });

    console.log(`[WebSocket] Server initialized on path: ${WS_PATH}`);

    wss.on('connection', (ws, req) => {
      const clientId = Math.random().toString(36).substring(7);
      console.log(`[WebSocket] New client connected: ${clientId}`);

      // Enhanced connection logging
      const connectionInfo = {
        clientId,
        path: req.url,
        ip: req.socket.remoteAddress,
        timestamp: new Date().toISOString()
      };

      console.log('[WebSocket] Connection details:', connectionInfo);

      // Send connection confirmation
      try {
        ws.send(JSON.stringify({ 
          type: 'connection',
          message: 'Connected to notification service',
          clientId,
          timestamp: new Date().toISOString()
        }));
      } catch (error) {
        console.error('[WebSocket] Failed to send welcome message:', error);
      }

      // Heartbeat mechanism
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      }, 30000);

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log(`[WebSocket] Received message from ${clientId}:`, message);
        } catch (error) {
          console.error('[WebSocket] Error processing message:', error);
        }
      });

      ws.on('error', (error) => {
        console.error('[WebSocket] Client error:', {
          clientId,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      });

      ws.on('close', (code, reason) => {
        clearInterval(pingInterval);
        console.log('[WebSocket] Client disconnected:', {
          clientId,
          code,
          reason: reason.toString(),
          timestamp: new Date().toISOString()
        });
      });

      ws.on('pong', () => {
        ws.isAlive = true;
      });
    });

    // Cleanup dead connections
    const interval = setInterval(() => {
      wss.clients.forEach((ws: any) => {
        if (ws.isAlive === false) {
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);

    wss.on('close', () => {
      clearInterval(interval);
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

  const message = JSON.stringify({
    type: 'notification',
    data: notification,
    timestamp: new Date().toISOString()
  });

  let sentCount = 0;
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
        sentCount++;
      } catch (error) {
        console.error('[WebSocket] Failed to send to client:', error);
      }
    }
  });

  console.log(`[WebSocket] Broadcast notification to ${sentCount} clients`);
};