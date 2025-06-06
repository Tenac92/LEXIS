import { WebSocket, WebSocketServer } from 'ws';
import type { Server } from 'http';

let wss: WebSocketServer;

interface DocumentUpdate {
  type: 'DOCUMENT_UPDATE' | 'PROTOCOL_UPDATE';
  documentId: number;
  data: any;
}

interface BudgetUpdateData {
  available_budget: number;
  quarter_available: number;
  yearly_available: number;
  user_view: number;
  ethsia_pistosi: number;
  katanomes_etous: number;
}

interface BudgetUpdate {
  type: 'budget_update';
  mis: string;
  simpleBudgetData: BudgetUpdateData;
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

export async function broadcastBudgetUpdate(mis: string, budgetData: BudgetUpdateData) {
  if (!wss) {
    console.warn('[WebSocket] Server not initialized for budget broadcast');
    return;
  }

  const budgetUpdate: BudgetUpdate = {
    type: 'budget_update',
    mis,
    simpleBudgetData: budgetData
  };

  console.log(`[WebSocket] Broadcasting budget update for MIS ${mis} to ${wss.clients.size} clients`);

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(budgetUpdate));
    }
  });
}
