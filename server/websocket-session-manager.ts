import { WebSocket } from 'ws';
import type { Request } from 'express';

interface SessionInfo {
  sessionId: string;
  userId?: string;
  lastActivity: number;
  isValid: boolean;
}

class WebSocketSessionManager {
  private sessions = new Map<string, SessionInfo>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired sessions every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60000);
  }

  validateSession(req: Request): SessionInfo | null {
    try {
      // Extract session from request
      const sessionId = req.sessionID;
      const user = req.session?.user;

      if (!sessionId) {
        console.log('[WSSession] No session ID found');
        return null;
      }

      // Check if session exists and has valid user
      if (!req.session || !user?.id) {
        console.log('[WSSession] No valid session or user found');
        return null;
      }

      const sessionInfo: SessionInfo = {
        sessionId,
        userId: user.id.toString(),
        lastActivity: Date.now(),
        isValid: true
      };

      this.sessions.set(sessionId, sessionInfo);
      console.log(`[WSSession] Session validated for user ${user.id}`);
      
      return sessionInfo;
    } catch (error) {
      console.error('[WSSession] Error validating session:', error);
      return null;
    }
  }

  updateActivity(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
      return true;
    }
    return false;
  }

  invalidateSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isValid = false;
      console.log(`[WSSession] Session ${sessionId} invalidated`);
    }
  }

  isSessionValid(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    // Check if session is still marked as valid
    if (!session.isValid) return false;

    // Check if session has been active recently (30 minutes)
    const maxInactivity = 30 * 60 * 1000;
    const timeSinceActivity = Date.now() - session.lastActivity;
    
    if (timeSinceActivity > maxInactivity) {
      console.log(`[WSSession] Session ${sessionId} expired due to inactivity`);
      session.isValid = false;
      return false;
    }

    return true;
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour

    this.sessions.forEach((session, sessionId) => {
      if (now - session.lastActivity > maxAge || !session.isValid) {
        this.sessions.delete(sessionId);
        console.log(`[WSSession] Cleaned up expired session ${sessionId}`);
      }
    });
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.sessions.clear();
  }

  getSessionCount(): number {
    return Array.from(this.sessions.values()).filter(s => s.isValid).length;
  }
}

export const wsSessionManager = new WebSocketSessionManager();
export type { SessionInfo };