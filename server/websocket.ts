import { WebSocket, WebSocketServer } from 'ws';
import type { Server } from 'http';
import type { BudgetNotification } from '@shared/schema';

let wss: WebSocketServer;

export const setupWebSocket = (server: Server) => {
  wss = new WebSocketServer({ 
    server,
    path: '/ws/notifications',
    clientTracking: true
  });

  wss.on('connection', (ws, req) => {
    console.log('[WebSocket] New connection established:', {
      path: req.url,
      ip: req.socket.remoteAddress,
      headers: {
        origin: req.headers.origin,
        host: req.headers.host,
        cookie: req.headers.cookie ? 'present' : 'missing'
      }
    });

    // Send connection confirmation
    try {
      ws.send(JSON.stringify({ 
        type: 'connection',
        message: 'Connected to notification service',
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('[WebSocket] Failed to send welcome message:', error);
    }

    ws.on('error', (error) => {
      console.error('[WebSocket] Client connection error:', {
        error,
        ip: req.socket.remoteAddress
      });
    });

    ws.on('close', (code, reason) => {
      console.log('[WebSocket] Client disconnected:', {
        code,
        reason: reason.toString(),
        ip: req.socket.remoteAddress
      });
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