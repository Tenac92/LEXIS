import { WebSocket, WebSocketServer } from 'ws';
import type { Server } from 'http';
import type { BudgetNotification } from '@shared/schema';

let wss: WebSocketServer;

export const setupWebSocket = (server: Server) => {
  wss = new WebSocketServer({ server, path: '/ws/notifications' });

  wss.on('connection', (ws) => {
    console.log('New WebSocket connection established');

    ws.on('error', console.error);
  });
};

export const broadcastNotification = (notification: BudgetNotification) => {
  if (!wss) return;

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(notification));
    }
  });
};
