/**
 * WebSocket Connection Manager
 * 
 * Handles WebSocket connections without forcing session-based closures
 * Prevents connection storms by managing reconnection logic properly
 */

import { WebSocket } from 'ws';
import type { Request } from 'express';

interface ManagedConnection {
  ws: WebSocket;
  clientId: string;
  connectedAt: number;
  lastActivity: number;
  isAuthenticated: boolean;
}

class WebSocketConnectionManager {
  private connections = new Map<string, ManagedConnection>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up stale connections every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleConnections();
    }, 5 * 60 * 1000);
  }

  addConnection(ws: WebSocket, clientId: string, req: Request): void {
    const connection: ManagedConnection = {
      ws,
      clientId,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      isAuthenticated: false // Start as unauthenticated
    };

    this.connections.set(clientId, connection);
    console.log(`[WSManager] Added connection ${clientId}, total: ${this.connections.size}`);
  }

  removeConnection(clientId: string): void {
    const connection = this.connections.get(clientId);
    if (connection) {
      this.connections.delete(clientId);
      console.log(`[WSManager] Removed connection ${clientId}, total: ${this.connections.size}`);
    }
  }

  updateActivity(clientId: string): void {
    const connection = this.connections.get(clientId);
    if (connection) {
      connection.lastActivity = Date.now();
    }
  }

  setAuthenticated(clientId: string, authenticated: boolean): void {
    const connection = this.connections.get(clientId);
    if (connection) {
      connection.isAuthenticated = authenticated;
      console.log(`[WSManager] Connection ${clientId} authentication: ${authenticated}`);
    }
  }

  private cleanupStaleConnections(): void {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes of inactivity

    const staleConnections: string[] = [];

    this.connections.forEach((connection, clientId) => {
      if (now - connection.lastActivity > maxAge) {
        staleConnections.push(clientId);
      }
    });

    staleConnections.forEach(clientId => {
      const connection = this.connections.get(clientId);
      if (connection && connection.ws.readyState === WebSocket.OPEN) {
        console.log(`[WSManager] Closing stale connection ${clientId}`);
        connection.ws.close(1000, 'Inactivity timeout');
      }
      this.removeConnection(clientId);
    });

    if (staleConnections.length > 0) {
      console.log(`[WSManager] Cleaned up ${staleConnections.length} stale connections`);
    }
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  getActiveConnections(): number {
    let active = 0;
    this.connections.forEach(connection => {
      if (connection.ws.readyState === WebSocket.OPEN) {
        active++;
      }
    });
    return active;
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Close all connections gracefully
    this.connections.forEach((connection, clientId) => {
      if (connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.close(1000, 'Server shutdown');
      }
    });
    
    this.connections.clear();
  }
}

export const wsConnectionManager = new WebSocketConnectionManager();
export type { ManagedConnection };