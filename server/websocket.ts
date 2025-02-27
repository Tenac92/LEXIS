import { WebSocket, WebSocketServer } from 'ws';
import type { Server } from 'http';
import type { BudgetNotification } from '@shared/schema';

const WS_PATH = '/ws';

export function createWebSocketServer(server: Server) {
  try {
    const wss = new WebSocketServer({ 
      server,
      path: WS_PATH
    });

    console.log(`[WebSocket] Server initialized on path: ${WS_PATH}`);

    wss.on('connection', (ws, req) => {
      // Enhanced connection logging
      const connectionInfo = {
        path: req.url,
        ip: req.socket.remoteAddress,
        headers: {
          origin: req.headers.origin,
          host: req.headers.host,
          cookie: req.headers.cookie ? 'present' : 'missing',
          upgrade: req.headers.upgrade,
          connection: req.headers.connection,
          'sec-websocket-key': req.headers['sec-websocket-key'] ? 'present' : 'missing'
        },
        url: req.url,
        method: req.method,
        sessionPresent: req.headers.cookie?.includes('sid=')
      };

      console.log('[WebSocket] New connection attempt:', connectionInfo);

      // Send connection confirmation
      try {
        ws.send(JSON.stringify({ 
          type: 'connection',
          message: 'Connected to notification service',
          timestamp: new Date().toISOString()
        }));
        console.log('[WebSocket] Welcome message sent successfully');
      } catch (error) {
        console.error('[WebSocket] Failed to send welcome message:', error);
      }

      ws.on('message', (data) => {
        try {
          console.log('[WebSocket] Received message:', data.toString());
        } catch (error) {
          console.error('[WebSocket] Error processing message:', error);
        }
      });

      ws.on('error', (error) => {
        console.error('[WebSocket] Client connection error:', {
          error,
          ip: req.socket.remoteAddress,
          headers: connectionInfo.headers
        });
      });

      ws.on('close', (code, reason) => {
        console.log('[WebSocket] Client disconnected:', {
          code,
          reason: reason.toString(),
          ip: req.socket.remoteAddress,
          headers: connectionInfo.headers
        });
      });
    });

    wss.on('error', (error) => {
      console.error('[WebSocket] Server error:', error);
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

  const message = JSON.stringify(notification);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (error) {
        console.error('[WebSocket] Failed to send to client:', error);
      }
    }
  });
};