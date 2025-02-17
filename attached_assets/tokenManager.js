export class TokenManager {
  static instance = null;
  static ERROR_MESSAGES = {
    INVALID_TOKEN: 'Invalid token format',
    TOKEN_REQUIRED: 'Token is required',
    TOKEN_EXPIRED: 'Token has expired',
    REFRESH_FAILED: 'Token refresh failed',
    NO_TOKEN: 'No token available'
  };

  constructor() {
    if (TokenManager.instance) {
      return TokenManager.instance;
    }
    this.TOKEN_KEY = 'authToken';
    this.REFRESH_TOKEN_KEY = 'refreshToken';
    this.TOKEN_REFRESH_THRESHOLD = 300;
    this.token = null;
    this.refreshTimeout = null;
    this.eventListeners = new Set();
    TokenManager.instance = this;
  }

  static getInstance() {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  addEventListener(listener) {
    this.eventListeners.add(listener);
  }

  removeEventListener(listener) {
    this.eventListeners.delete(listener);
  }

  notifyListeners(event) {
    this.eventListeners.forEach(listener => listener(event));
  }

  async getToken() {
    try {
      const token = localStorage.getItem(this.TOKEN_KEY);
      if (!token || token === 'undefined' || token === 'null') {
        this.clearToken();
        return null;
      }

      const payload = this.parseToken(token);
      if (!payload) {
        this.clearToken();
        return null;
      }

      if (this.isTokenExpiringSoon(payload)) {
        const refreshedToken = await this.refreshToken();
        return refreshedToken;
      }

      return token;
    } catch (error) {
      console.error('Token retrieval error:', error);
      return null;
    }
  }

  isTokenExpiringSoon(payload) {
    if (!payload?.exp) return true;
    const currentTime = Math.floor(Date.now() / 1000);
    return currentTime >= payload.exp - this.TOKEN_REFRESH_THRESHOLD;
  }

  scheduleTokenRefresh(expiresIn) {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }
    const refreshTime = (expiresIn - this.TOKEN_REFRESH_THRESHOLD) * 1000;
    this.refreshTimeout = setTimeout(() => this.refreshToken(), refreshTime);
  }

  async refreshToken() {
    try {
      const currentToken = localStorage.getItem(this.TOKEN_KEY);
      if (!currentToken) {
        throw new Error(TokenManager.ERROR_MESSAGES.NO_TOKEN);
      }

      const response = await fetch('/auth/refresh', {
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

      const payload = this.parseToken(token);
      if (payload?.exp) {
        this.scheduleTokenRefresh(payload.exp);
      }

      return token;
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.clearToken();
      window.location.href = '/index.html';
      return null;
    }
  }

  setToken(token) {
    localStorage.setItem(this.TOKEN_KEY, token);
    this.token = token;
    this.notifyListeners({ type: 'tokenChanged', token });
  }

  clearToken() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    this.token = null;
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }
    this.notifyListeners({ type: 'tokenCleared' });
  }

  parseToken(token) {
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
  async initializeUI() {
    // Add header
    if (document.body && !document.querySelector('header')) {
      const { createHeader } = await import('../components/header.js');
      document.body.insertBefore(createHeader(), document.body.firstChild);
    }

    // Initialize common UI elements
    this.elements = {
      catalogContainer: document.getElementById('catalogContainer'),
      searchInput: document.getElementById('searchInput'),
      loadingSpinner: document.getElementById('loadingSpinner'),
      filterTags: document.getElementById('filterTags')
    };

    return this.elements;
  }

  getUIElements() {
    return this.elements || this.initializeUI();
  }

  isUserAdmin() {
    const token = localStorage.getItem(this.TOKEN_KEY);
    if (!token) return false;
    
    const payload = this.parseToken(token);
    return payload?.role === 'admin';
  }
}

export default TokenManager;