import { WebSocket, WebSocketServer } from 'ws';
import type { Server } from 'http';
import type { BudgetNotification } from '@shared/schema';

let port = 5001; // Use a different port
const maxRetries = 3;

export function createWebSocketServer(server: Server) {
  let retries = 0;
  let wss: WebSocketServer | null = null;

  while (retries < maxRetries && !wss) {
    try {
      wss = new WebSocketServer({ 
        server,
        path: '/ws/notifications'
      });
      console.log(`[WebSocket] Server initialized on path: /ws/notifications`);
    } catch (error) {
      console.error(`[WebSocket] Failed to initialize on port ${port}:`, error);
      port++;
      retries++;
    }
  }

  if (!wss) {
    throw new Error('[WebSocket] Failed to initialize after maximum retries');
  }

  return wss;
}

let wss: WebSocketServer;

export const setupWebSocket = (server: Server) => {
  wss = new WebSocketServer({ 
    server,
    path: '/ws/notifications',
    clientTracking: true
  });

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

    // Handle incoming messages
    ws.on('message', (data) => {
      try {
        console.log('[WebSocket] Received message:', data.toString());
      } catch (error) {
        console.error('[WebSocket] Error processing message:', error);
      }
    });
  });

  wss.on('error', (error) => {
    console.error('[WebSocket] Server error:', error);
  });

  console.log('[WebSocket] Server initialized on path:', '/ws/notifications');
};

export const broadcastNotification = (notification: BudgetNotification) => {
  if (!wss) {
    console.error('[WebSocket] Broadcast failed: Server not initialized');
    return;
  }

  const connectedClients = Array.from(wss.clients).filter(
    client => client.readyState === WebSocket.OPEN
  );

  console.log('[WebSocket] Broadcasting notification:', {
    clientCount: connectedClients.length,
    notificationType: notification.type,
    notificationId: notification.id
  });

  for (const client of connectedClients) {
    try {
      client.send(JSON.stringify(notification));
    } catch (error) {
      console.error('[WebSocket] Failed to send to client:', error);
    }
  }
};