import { User } from "@shared/schema";

export class TokenManager {
  private static instance: TokenManager | null = null;
  private TOKEN_KEY = 'authToken';
  private refreshTimeout: NodeJS.Timeout | null = null;
  private eventListeners = new Set<(event: TokenEvent) => void>();

  static readonly ERROR_MESSAGES = {
    INVALID_TOKEN: 'Invalid token format',
    TOKEN_REQUIRED: 'Token is required',
    TOKEN_EXPIRED: 'Token has expired',
    REFRESH_FAILED: 'Token refresh failed',
    NO_TOKEN: 'No token available'
  };

  private constructor() {}

  static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  addEventListener(listener: (event: TokenEvent) => void) {
    this.eventListeners.add(listener);
  }

  removeEventListener(listener: (event: TokenEvent) => void) {
    this.eventListeners.delete(listener);
  }

  private notifyListeners(event: TokenEvent) {
    this.eventListeners.forEach(listener => listener(event));
  }

  async getToken(): Promise<string | null> {
    const token = localStorage.getItem(this.TOKEN_KEY);
    if (!token || token === 'undefined' || token === 'null') {
      this.clearToken();
      return null;
    }
    return token;
  }

  setToken(token: string) {
    localStorage.setItem(this.TOKEN_KEY, token);
    this.notifyListeners({ type: 'tokenChanged', token });

    // Schedule token refresh
    const payload = this.parseToken(token);
    if (payload?.exp) {
      this.scheduleTokenRefresh(payload.exp);
    }
  }

  clearToken() {
    localStorage.removeItem(this.TOKEN_KEY);
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }
    this.notifyListeners({ type: 'tokenCleared' });
  }

  parseToken(token: string): TokenPayload | null {
    try {
      if (!token || typeof token !== 'string') {
        return null;
      }

      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      const base64Url = parts[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));

      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Token parsing error:', error);
      return null;
    }
  }

  private scheduleTokenRefresh(expiresIn: number) {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const timeUntilRefresh = Math.max(0, expiresIn - currentTime - 300) * 1000; // Refresh 5 minutes before expiry

    this.refreshTimeout = setTimeout(() => this.refreshToken(), timeUntilRefresh);
  }

  private async refreshToken(): Promise<string | null> {
    try {
      const currentToken = await this.getToken();
      if (!currentToken) {
        throw new Error(TokenManager.ERROR_MESSAGES.NO_TOKEN);
      }

      const response = await fetch('/api/refresh', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${currentToken}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          this.clearToken();
        }
        throw new Error(TokenManager.ERROR_MESSAGES.REFRESH_FAILED);
      }

      const { token } = await response.json();
      this.setToken(token);
      return token;
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.clearToken();
      window.location.href = '/auth';
      return null;
    }
  }

  isUserAdmin(): boolean {
    const token = localStorage.getItem(this.TOKEN_KEY);
    if (!token) return false;

    const payload = this.parseToken(token);
    return payload?.role === 'admin';
  }
}

interface TokenEvent {
  type: 'tokenChanged' | 'tokenCleared';
  token?: string;
}

interface TokenPayload {
  userId: number;
  email: string;
  name: string;
  role: string;
  units?: string;
  department?: string;
  exp?: number;
}

export default TokenManager;