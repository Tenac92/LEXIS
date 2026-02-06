import { WebSocket, WebSocketServer } from 'ws';
import type { Server } from 'http';
import { EventEmitter } from 'events';
import type { BudgetNotification } from '@shared/schema';
import { wsConnectionManager } from './websocket-connection-manager';
import { wsSessionManager } from './websocket-session-manager';
import { sessionMiddleware } from './authentication';
import { getClientIpFromSocket, isGreekIp } from './middleware/geoIpMiddleware';
import { supabase } from './config/db';

const WS_PATH = '/ws';

let currentWss: WebSocketServer | null = null;

export function getWebSocketServer(): WebSocketServer | null {
  return currentWss;
}

interface ExtendedWebSocket extends WebSocket {
  isAlive: boolean;
  clientId?: string;
  geoVerified?: boolean;
  sessionId?: string;
  userId?: string;
  isAuthenticated?: boolean;
  unitIds?: number[]; // User's assigned unit IDs for scoped filtering
}

export interface BudgetUpdate {
  mis: string;  // The project MIS (identifier)
  amount: number;  // Current requested amount
  timestamp: string;  // When the update happened
  userId?: string;  // Which user initiated the update
  sessionId?: string;  // Session ID to filter out self-updates
  // IMPROVEMENT: Simple budget data for direct calculation
  simpleBudgetData?: {
    available_budget: number;
    yearly_available: number;
    quarter_available?: number;
  };
}

export function createWebSocketServer(server: Server) {
  try {
    const wss = new WebSocketServer({ 
      noServer: true,
      clientTracking: true,
      handleProtocols: () => 'notifications'
    });

    currentWss = wss;

    // Helper: determine if an IP is private (aligned with geo middleware)
    const isPrivateIp = (ip: string): boolean => {
      if (!ip) return false;
      const parts = ip.split('.').map(p => parseInt(p, 10));
      if (parts.length < 4 || parts.some(Number.isNaN)) return false;
      return ip.startsWith('10.') ||
        ip.startsWith('127.') ||
        ip === '::1' ||
        (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
        ip.startsWith('192.168.') ||
        (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127);
    };

    // Run the existing express-session middleware during WS upgrade
    const applySessionToRequest = (req: any) => new Promise<void>((resolve, reject) => {
      const fakeRes = new EventEmitter() as any;
      fakeRes.statusCode = 200;
      fakeRes.headersSent = false;
      fakeRes.getHeader = () => undefined;
      fakeRes.setHeader = () => {};
      fakeRes.writeHead = () => fakeRes;
      fakeRes.end = () => {
        fakeRes.emit('finish');
      };

      sessionMiddleware(req as any, fakeRes, (err?: any) => {
        if (err) {
          return reject(err);
        }
        // Ensure the session touch/save hooks fire
        fakeRes.emit('finish');
        resolve();
      });
    });

    // Manually handle upgrades so we can enforce auth/geo before accepting
    server.on('upgrade', async (req, socket, head) => {
      const url = req.url ? new URL(req.url, `http://${req.headers.host || 'localhost'}`) : null;
      if (!url || url.pathname !== WS_PATH) {
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
        return;
      }

      try {
        await applySessionToRequest(req);
      } catch (err) {
        console.error('[WebSocket] Session parse failed during upgrade:', err);
        socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
        socket.destroy();
        return;
      }

      const sessionInfo = wsSessionManager.validateSession(req as any);
      if (!sessionInfo) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      // Attach session info for the connection handler
      (req as any).__sessionInfo = sessionInfo;

      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    });

    console.log(`[WebSocket] Server initialized on path: ${WS_PATH}`);

    wss.on('connection', async (ws: ExtendedWebSocket, req) => {
      // Generate a more unique client ID with timestamp
      const clientId = `${Math.random().toString(36).substring(7)}${Date.now().toString(36)}`;
      ws.clientId = clientId;
      
      // SECURITY: Get client IP with proper proxy handling
      const socketIp = (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
      const isDirectPrivate = isPrivateIp(socketIp);
      
      // Only trust X-Forwarded-For if the direct connection is from a trusted proxy
      let clientIp = socketIp;
      if (isDirectPrivate) {
        clientIp = getClientIpFromSocket(req.socket.remoteAddress, req.headers as any);
      }
      
      console.log(`[WebSocket] New client attempting connection: ${clientId} from ${clientIp} (socket: ${socketIp})`);
      
      // GEO-VERIFICATION: Check if connection is from Greece unless the session was geo-verified earlier
      const sessionInfo = (req as any).__sessionInfo;
      const sessionGeoVerified = Boolean((req as any).session?.geoVerified);
      const isDirectSocket = clientIp === socketIp;
      const fromGreece = sessionGeoVerified || isGreekIp(clientIp, isDirectSocket && isDirectPrivate);
      ws.geoVerified = fromGreece;

      if (!fromGreece) {
        console.log(`[WebSocket] Connection DENIED - not from Greece: ${clientId} from ${clientIp}`);
        try {
          ws.close(4003, 'Access denied: Greece only');
        } catch (error) {
          console.error(`[WebSocket] Error closing unauthorized connection:`, error);
          ws.terminate();
        }
        return;
      }

      if (!sessionInfo) {
        console.log(`[WebSocket] Connection DENIED - missing session after upgrade: ${clientId}`);
        ws.close(4401, 'Authentication required');
        return;
      }
      ws.sessionId = sessionInfo.sessionId;
      ws.userId = sessionInfo.userId;
      ws.isAuthenticated = true;
      
      // Fetch user's unit_ids for scoped filtering
      try {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('unit_id')
          .eq('id', sessionInfo.userId)
          .single();
        
        if (!userError && userData?.unit_id) {
          ws.unitIds = userData.unit_id;
          console.log(`[WebSocket] User ${sessionInfo.userId} has units:`, ws.unitIds);
        }
      } catch (error) {
        console.error(`[WebSocket] Failed to fetch user units for ${sessionInfo.userId}:`, error);
      }
      
      console.log(`[WebSocket] Connection ALLOWED from Greece: ${clientId} from ${clientIp}`);

      // Mark as alive immediately
      ws.isAlive = true;

      // Add connection to manager without forced session validation
      wsConnectionManager.addConnection(ws, clientId, req as any, sessionInfo.userId);
      wsConnectionManager.setAuthenticated(clientId, true, sessionInfo.userId);
      wsSessionManager.updateActivity(sessionInfo.sessionId);
      
      // Log connection with user role for debugging
      const userRole = (req as any).session?.user?.role || 'unknown';
      console.log(`[WebSocket] Connection ${clientId} registered for user ${sessionInfo.userId} with role: ${userRole} and units: ${ws.unitIds?.join(',') || 'none'}`);

      // Try to send a welcome message
      try {
        const welcomeMessage = JSON.stringify({ 
          type: 'connection',
          message: 'Connected to notification service',
          clientId,
          geoVerified: true,
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
        wsConnectionManager.updateActivity(clientId);
        if (ws.sessionId) {
          wsSessionManager.updateActivity(ws.sessionId);
        }
      });

      // Handle incoming messages
      ws.on('message', (data) => {
        try {
          wsConnectionManager.updateActivity(clientId);
          if (ws.sessionId) {
            wsSessionManager.updateActivity(ws.sessionId);
          }
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
        wsConnectionManager.removeConnection(clientId);
      });
    });

    // Set up less aggressive heartbeat interval (30 seconds)
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
    }, 30000); // Run every 30 seconds

    // Make sure we clean up the interval when the server closes
    wss.on('close', () => {
      console.log('[WebSocket] Server closing, clearing heartbeat interval');
      clearInterval(heartbeatInterval);
      wsConnectionManager.destroy();
      wsSessionManager.destroy();
    });

    return wss;
  } catch (error) {
    console.error('[WebSocket] Failed to initialize:', error);
    throw error;
  }
}

export const broadcastDashboardRefresh = (payload?: { projectId?: number; changeType?: string; reason?: string; unitIds?: number[] }) => {
  if (!currentWss) {
    console.error('[WebSocket] Dashboard refresh broadcast failed: Server not initialized');
    return;
  }

  if (currentWss.clients.size === 0) {
    return;
  }

  const message = JSON.stringify({
    type: 'dashboard_refresh',
    data: payload || {},
    timestamp: new Date().toISOString()
  });

  const clientList = Array.from(currentWss.clients) as ExtendedWebSocket[];
  const openClients = clientList.filter(client => client.readyState === WebSocket.OPEN && client.isAuthenticated === true);

  // If specific units are provided, only broadcast to users who have those units
  let targetClients = openClients;
  if (payload?.unitIds && payload.unitIds.length > 0) {
    targetClients = openClients.filter(client => {
      // Send to admins (no unit restriction) and users whose units overlap with the event units
      if (!client.unitIds || client.unitIds.length === 0) {
        // Likely an admin with no unit restriction
        return true;
      }
      // Check if user has at least one unit that matches
      return payload.unitIds.some(unitId => client.unitIds!.includes(unitId));
    });
    console.log(`[WebSocket] Filtering broadcast for units ${payload.unitIds.join(',')}: targeting ${targetClients.length} of ${openClients.length} clients`);
  }

  targetClients.forEach((client) => {
    try {
      client.send(message);
      wsConnectionManager.updateActivity(client.clientId!);
      if (client.sessionId) {
        wsSessionManager.updateActivity(client.sessionId);
      }
    } catch (error) {
      console.error(`[WebSocket] Failed to send dashboard refresh to client ${client.clientId}:`, error);
      client.isAlive = false;
    }
  });
};

export interface DocumentUpdate {
  type: 'DOCUMENT_UPDATE' | 'PROTOCOL_UPDATE';
  documentId: number;
  data: any;
}

export const broadcastDocumentUpdate = (update: DocumentUpdate) => {
  if (!currentWss) {
    console.warn('[WebSocket] Document update broadcast failed: Server not initialized');
    return;
  }

  if (currentWss.clients.size === 0) {
    return;
  }

  const message = JSON.stringify({
    ...update,
    timestamp: new Date().toISOString()
  });

  const clientList = Array.from(currentWss.clients) as ExtendedWebSocket[];
  const openClients = clientList.filter(client => client.readyState === WebSocket.OPEN && client.isAuthenticated === true);

  openClients.forEach((client) => {
    try {
      client.send(message);
      wsConnectionManager.updateActivity(client.clientId!);
      if (client.sessionId) {
        wsSessionManager.updateActivity(client.sessionId);
      }
    } catch (error) {
      console.error(`[WebSocket] Failed to send document update to client ${client.clientId}:`, error);
      client.isAlive = false;
    }
  });
};

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
  const openClients = clientList.filter(client => client.readyState === WebSocket.OPEN && client.isAuthenticated === true);
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
      wsConnectionManager.updateActivity(client.clientId!);
      if (client.sessionId) {
        wsSessionManager.updateActivity(client.sessionId);
      }
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

/**
 * Broadcast a budget update to all connected clients
 * This allows real-time syncing of budget amounts between users
 * 
 * @param wss WebSocketServer instance
 * @param update Budget update information
 * @returns Status of the broadcast
 */
export const broadcastBudgetUpdate = (wss: WebSocketServer, update: BudgetUpdate) => {
  if (!wss) {
    console.error('[WebSocket] Budget update broadcast failed: Server not initialized');
    return;
  }

  // Early return if no clients connected
  if (wss.clients.size === 0) {
    console.log('[WebSocket] No clients connected, skipping budget update broadcast');
    return;
  }

  // IMPROVEMENT: Log if simplified budget data is included
  if (update.simpleBudgetData) {
    console.log(`[WebSocket] Budget update includes simplified data:`, update.simpleBudgetData);
  }

  // Create budget update message
  const message = JSON.stringify({
    type: 'budget_update',
    data: update,
    timestamp: new Date().toISOString()
  });

  // Keep track of successful sends and errors
  let sentCount = 0;
  let errorCount = 0;
  const clientList = Array.from(wss.clients) as ExtendedWebSocket[];
  
  // Only send to OPEN clients
  const openClients = clientList.filter(client => client.readyState === WebSocket.OPEN && client.isAuthenticated === true);
  
  // Only send to OPEN clients
  openClients.forEach((client) => {
    // Skip echoing back to the same session if provided
    if (update.sessionId && client.sessionId === update.sessionId) {
      return;
    }

    try {
      client.send(message);
      sentCount++;
      wsConnectionManager.updateActivity(client.clientId!);
      if (client.sessionId) {
        wsSessionManager.updateActivity(client.sessionId);
      }
    } catch (error) {
      errorCount++;
      console.error(`[WebSocket] Failed to send budget update to client ${client.clientId}:`, error);
      
      // Mark client as not alive so it will be cleaned up in next heartbeat
      client.isAlive = false;
    }
  });

  console.log(`[WebSocket] Budget update broadcast results: ${sentCount} successful, ${errorCount} failed`);
  
  return {
    success: sentCount > 0,
    sentCount,
    errorCount
  };
};

// Broadcast beneficiary payment updates with unit-scoped filtering
export const broadcastBeneficiaryUpdate = async (payload: { 
  beneficiaryId?: number; 
  paymentId?: number; 
  action: 'create' | 'update' | 'delete' | 'status_change';
  afm?: string;
  unitId?: number; // Unit ID for scoped filtering
}) => {
  if (!currentWss) {
    console.error('[WebSocket] Beneficiary update broadcast failed: Server not initialized');
    return;
  }

  if (currentWss.clients.size === 0) return;

  const message = JSON.stringify({
    type: 'beneficiary_update',
    data: payload,
    timestamp: new Date().toISOString()
  });

  const clientList = Array.from(currentWss.clients) as ExtendedWebSocket[];
  const openClients = clientList.filter(client => client.readyState === WebSocket.OPEN && client.isAuthenticated === true);

  openClients.forEach((client) => {
    // SECURITY: Only send to users who have access to this unit
    if (payload.unitId && client.unitIds && !client.unitIds.includes(payload.unitId)) {
      return; // Skip this client - they don't have access to this unit
    }

    try {
      client.send(message);
      wsConnectionManager.updateActivity(client.clientId!);
      if (client.sessionId) {
        wsSessionManager.updateActivity(client.sessionId);
      }
    } catch (error) {
      console.error(`[WebSocket] Failed to send beneficiary update to client ${client.clientId}:`, error);
      client.isAlive = false;
    }
  });
};

// Broadcast project updates with unit-scoped filtering
export const broadcastProjectUpdate = async (payload: {
  projectId: number;
  action: 'create' | 'update' | 'delete';
  changes?: string[];
  unitIds?: number[]; // Unit IDs associated with this project for scoped filtering
}) => {
  if (!currentWss) {
    console.error('[WebSocket] Project update broadcast failed: Server not initialized');
    return;
  }

  if (currentWss.clients.size === 0) return;

  const message = JSON.stringify({
    type: 'project_update',
    data: payload,
    timestamp: new Date().toISOString()
  });

  const clientList = Array.from(currentWss.clients) as ExtendedWebSocket[];
  const openClients = clientList.filter(client => client.readyState === WebSocket.OPEN && client.isAuthenticated === true);

  openClients.forEach((client) => {
    // SECURITY: Only send to users who have access to units associated with this project
    if (payload.unitIds && payload.unitIds.length > 0 && client.unitIds) {
      const hasAccess = payload.unitIds.some(unitId => client.unitIds!.includes(unitId));
      if (!hasAccess) {
        return; // Skip this client - they don't have access to any of the project's units
      }
    }

    try {
      client.send(message);
      wsConnectionManager.updateActivity(client.clientId!);
      if (client.sessionId) {
        wsSessionManager.updateActivity(client.sessionId);
      }
    } catch (error) {
      console.error(`[WebSocket] Failed to send project update to client ${client.clientId}:`, error);
      client.isAlive = false;
    }
  });
};

// Broadcast budget import progress
export const broadcastBudgetImportProgress = (payload: {
  stage: 'started' | 'processing' | 'completed' | 'error';
  processed?: number;
  total?: number;
  message?: string;
}) => {
  if (!currentWss) return;
  if (currentWss.clients.size === 0) return;

  const message = JSON.stringify({
    type: 'budget_import_progress',
    data: payload,
    timestamp: new Date().toISOString()
  });

  const clientList = Array.from(currentWss.clients) as ExtendedWebSocket[];
  const openClients = clientList.filter(client => client.readyState === WebSocket.OPEN && client.isAuthenticated === true);

  openClients.forEach((client) => {
    try {
      client.send(message);
    } catch (error) {
      console.error(`[WebSocket] Failed to send import progress:`, error);
    }
  });
};

// Broadcast admin operations
export const broadcastAdminOperation = (payload: {
  operation: 'quarter_transition' | 'year_end_closure' | 'system_maintenance';
  status: 'started' | 'completed' | 'error';
  message?: string;
  data?: any;
}) => {
  if (!currentWss) return;
  if (currentWss.clients.size === 0) return;

  const message = JSON.stringify({
    type: 'admin_operation',
    data: payload,
    timestamp: new Date().toISOString()
  });

  const clientList = Array.from(currentWss.clients) as ExtendedWebSocket[];
  const openClients = clientList.filter(client => client.readyState === WebSocket.OPEN && client.isAuthenticated === true);

  openClients.forEach((client) => {
    try {
      client.send(message);
    } catch (error) {
      console.error(`[WebSocket] Failed to send admin operation:`, error);
    }
  });
};

// Broadcast user management changes
export const broadcastUserUpdate = (payload: {
  userId: number;
  action: 'create' | 'update' | 'delete' | 'deactivate' | 'activate';
  userName?: string;
}) => {
  if (!currentWss) return;
  if (currentWss.clients.size === 0) return;

  const message = JSON.stringify({
    type: 'user_update',
    data: payload,
    timestamp: new Date().toISOString()
  });

  const clientList = Array.from(currentWss.clients) as ExtendedWebSocket[];
  const openClients = clientList.filter(client => client.readyState === WebSocket.OPEN && client.isAuthenticated === true);

  openClients.forEach((client) => {
    try {
      client.send(message);
    } catch (error) {
      console.error(`[WebSocket] Failed to send user update:`, error);
    }
  });
};

// Broadcast reference data changes
export const broadcastReferenceDataUpdate = (payload: {
  type: 'units' | 'event_types' | 'expenditure_types' | 'templates';
  action: 'create' | 'update' | 'delete';
}) => {
  if (!currentWss) return;
  if (currentWss.clients.size === 0) return;

  const message = JSON.stringify({
    type: 'reference_data_update',
    data: payload,
    timestamp: new Date().toISOString()
  });

  const clientList = Array.from(currentWss.clients) as ExtendedWebSocket[];
  const openClients = clientList.filter(client => client.readyState === WebSocket.OPEN && client.isAuthenticated === true);

  openClients.forEach((client) => {
    try {
      client.send(message);
    } catch (error) {
      console.error(`[WebSocket] Failed to send reference data update:`, error);
    }
  });
};

// Broadcast real-time notification
export const broadcastRealtimeNotification = (payload: {
  userId?: number;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  link?: string;
}) => {
  if (!currentWss) return;
  if (currentWss.clients.size === 0) return;

  const message = JSON.stringify({
    type: 'realtime_notification',
    data: payload,
    timestamp: new Date().toISOString()
  });

  const clientList = Array.from(currentWss.clients) as ExtendedWebSocket[];
  const openClients = clientList.filter(client => client.readyState === WebSocket.OPEN && client.isAuthenticated === true);

  openClients.forEach((client) => {
    // If userId specified, only send to that user
    if (payload.userId && client.userId !== payload.userId.toString()) {
      return;
    }

    try {
      client.send(message);
    } catch (error) {
      console.error(`[WebSocket] Failed to send notification:`, error);
    }
  });
};