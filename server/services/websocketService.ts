import { WebSocket, WebSocketServer } from 'ws';
import type { Server } from 'http';

let wss: WebSocketServer;

interface DocumentUpdate {
  type: 'DOCUMENT_UPDATE' | 'PROTOCOL_UPDATE';
  documentId: number;
  data: any;
}

export function setupWebSocketServer(server: Server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    console.log('[WebSocket] Client connected');

    ws.on('error', console.error);

    ws.on('close', () => {
      console.log('[WebSocket] Client disconnected');
    });
  });

  return wss;
}

export function broadcastDocumentUpdate(update: DocumentUpdate) {
  if (!wss) {
    console.warn('[WebSocket] Server not initialized');
    return;
  }

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(update));
    }
  });
}
