
const TOKEN_KEY = 'auth_token';
const STORAGE_TYPE = {
  LOCAL: 'localStorage',
  SESSION: 'sessionStorage',
  MEMORY: 'memory',
  COOKIE: 'cookie'
};

class TokenManagerClass {
  constructor() {
    this.token = null;
    this.memoryStorage = new Map();
    this.storageType = this.detectStorageType();
    this.initializeStorage();
  }

  initializeStorage() {
    try {
      const storedType = this.getStoredToken();
      if (storedType && this.storageType !== STORAGE_TYPE.MEMORY) {
        this.token = storedType;
      }
    } catch {
      this.fallbackToMemory();
    }
  }

  fallbackToMemory() {
    this.storageType = STORAGE_TYPE.MEMORY;
    console.warn('Falling back to memory storage');
  }

  encrypt(value) {
    if (!value) return null;
    try {
      const encrypted = btoa(encodeURIComponent(value));
      if (!encrypted) throw new Error('Encryption failed');
      return encrypted;
    } catch {
      return value;
    }
  }

  decrypt(value) {
    if (!value) return null;
    try {
      const decrypted = decodeURIComponent(atob(value));
      if (!decrypted) throw new Error('Decryption failed');
      return decrypted;
    } catch {
      return value;
    }
  }

  detectStorageType() {
    const types = ['cookie', 'localStorage', 'sessionStorage'];
    for (const type of types) {
      if (this.isStorageAvailable(type)) {
        return STORAGE_TYPE[type.toUpperCase()] || STORAGE_TYPE.MEMORY;
      }
    }
    return STORAGE_TYPE.MEMORY;
  }

  isStorageAvailable(type) {
    const testKey = `__test__${Date.now()}`;
    try {
      switch (type) {
        case 'cookie': {
          document.cookie = `${testKey}=1;path=/;max-age=1`;
          const hasCookie = document.cookie.indexOf(testKey) !== -1;
          document.cookie = `${testKey}=;path=/;expires=Thu, 01 Jan 1970 00:00:01 GMT`;
          return hasCookie;
        }
        case 'localStorage':
          localStorage.setItem(testKey, '1');
          localStorage.removeItem(testKey);
          return true;
        case 'sessionStorage':
          sessionStorage.setItem(testKey, '1');
          sessionStorage.removeItem(testKey);
          return true;
        default:
          return false;
      }
    } catch {
      return false;
    }
  }

  setCookie(value, options = {}) {
    const secure = window.location.protocol === 'https:';
    const sameSite = options.sameSite || 'Strict';
    const maxAge = options.maxAge || 86400;
    const encryptedValue = this.encrypt(value);
    
    if (!encryptedValue) return false;
    
    try {
      document.cookie = `${TOKEN_KEY}=${encryptedValue};path=/;max-age=${maxAge};${secure ? 'secure;' : ''}samesite=${sameSite}`;
      return true;
    } catch {
      return false;
    }
  }

  getCookie() {
    try {
      const match = document.cookie.match(new RegExp(`(^| )${TOKEN_KEY}=([^;]+)`));
      return match ? this.decrypt(match[2]) : null;
    } catch {
      return null;
    }
  }

  getStoredToken() {
    try {
      switch (this.storageType) {
        case STORAGE_TYPE.COOKIE:
          return this.getCookie();
        case STORAGE_TYPE.LOCAL: {
          const token = localStorage.getItem(TOKEN_KEY);
          return token ? this.decrypt(token) : null;
        }
        case STORAGE_TYPE.SESSION: {
          const token = sessionStorage.getItem(TOKEN_KEY);
          return token ? this.decrypt(token) : null;
        }
        default:
          return this.memoryStorage.get(TOKEN_KEY) || null;
      }
    } catch {
      return this.token;
    }
  }

  setToken(token) {
    if (!token) {
      this.clearToken();
      return false;
    }

    try {
      const encryptedToken = this.encrypt(token);
      if (!encryptedToken) return false;

      switch (this.storageType) {
        case STORAGE_TYPE.COOKIE:
          if (!this.setCookie(token)) throw new Error('Cookie storage failed');
          break;
        case STORAGE_TYPE.LOCAL:
          localStorage.setItem(TOKEN_KEY, encryptedToken);
          break;
        case STORAGE_TYPE.SESSION:
          sessionStorage.setItem(TOKEN_KEY, encryptedToken);
          break;
        default:
          this.memoryStorage.set(TOKEN_KEY, token);
      }
      this.token = token;
      return true;
    } catch {
      this.fallbackToMemory();
      this.token = token;
      this.memoryStorage.set(TOKEN_KEY, token);
      return true;
    }
  }

  clearToken() {
    try {
      switch (this.storageType) {
        case STORAGE_TYPE.COOKIE:
          document.cookie = `${TOKEN_KEY}=;path=/;expires=Thu, 01 Jan 1970 00:00:01 GMT`;
          break;
        case STORAGE_TYPE.LOCAL:
          localStorage.removeItem(TOKEN_KEY);
          break;
        case STORAGE_TYPE.SESSION:
          sessionStorage.removeItem(TOKEN_KEY);
          break;
        default:
          this.memoryStorage.delete(TOKEN_KEY);
      }
      this.token = null;
      return true;
    } catch {
      this.token = null;
      this.memoryStorage.clear();
      return false;
    }
  }
}

export const TokenManager = new TokenManagerClass();
