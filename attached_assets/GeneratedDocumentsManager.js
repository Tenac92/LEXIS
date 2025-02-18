import { TokenManager } from '../../utils/tokenManager.js';
import { DocumentUIManager } from './DocumentUIManager.js';
import { RecipientManager } from './RecipientManager.js';
import { OrthiEpanalipsiManager } from './OrthiEpanalipsiManager.js';
import { ProtocolManager } from './ProtocolManager.js';
import { createHeader } from '../../components/header.js';

export class GeneratedDocumentsManager {
  constructor() {
    this.state = {
      initialized: false,
      loading: false,
      error: null,
      currentView: 'grid'
    };
    this.uiManager = new DocumentUIManager(this);
    this.recipientManager = new RecipientManager(this);
    this.orthiManager = new OrthiEpanalipsiManager(this);
    this.protocolManager = new ProtocolManager(this);
    this.cache = new Map();
    this.setupErrorHandling();
  }

  clearCache() {
    this.cache.clear();
  }

  setupErrorHandling() {
    window.onerror = (msg, url, line, col, error) => {
      console.error('Global error:', { msg, url, line, col, error });
      this.showErrorMessage('An unexpected error occurred');
      return false;
    };

    window.onunhandledrejection = (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      const errorMessage = event.reason?.message || 'Failed to complete operation';
      this.showErrorMessage(errorMessage);
      event.preventDefault();
    };
  }

  async initialize() {
    try {
      this.setLoading(true);
      const isAuthenticated = await this.validateSession();
      if (!isAuthenticated) {
        window.location.href = '/index.html';
        return false;
      }

      try {
        const headerElement = createHeader();
        if (headerElement) {
          // Remove existing header if present
          const existingHeader = document.querySelector('header');
          if (existingHeader) {
            existingHeader.remove();
          }
          document.body.insertBefore(headerElement, document.body.firstChild);
        } else {
          console.warn('Header creation failed - header element is null');
        }
      } catch (error) {
        console.error('Header initialization error:', error);
      }

      const uiInitialized = await this.uiManager.initializeUI();
      if (!uiInitialized) {
        throw new Error('Failed to initialize UI');
      }
      // Initialize recipient handling
      if (!await this.recipientManager.initialize()) {
        throw new Error('Failed to initialize recipient manager');
      }

      this.state.initialized = true;
      return true;
    } catch (error) {
      console.error('Initialization error:', error);
      this.showErrorMessage(error.message);
      return false;
    } finally {
      this.setLoading(false);
    }
  }

  async validateSession() {
    try {
      const tokenManager = TokenManager.getInstance();
      const token = await tokenManager.getToken();
      if (!token) {
        console.error('No auth token found');
        return false;
      }
      
      const parsedToken = tokenManager.parseToken(token);
      if (!parsedToken) {
        console.error('Token parsing failed');
        return false;
      }

      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
      
      const userData = JSON.parse(window.atob(padded));
      if (!userData?.userId) {
        console.error('Missing user ID in token');
        return false;
      }

      this.userId = userData.userId;
      this.userRole = userData.role || 'user';
      this.userUnits = Array.isArray(userData.units) ? userData.units : [];
      this.userName = userData.name;
      this.userDepartment = userData.department;

      return true;
    } catch (error) {
      console.error('Session validation error:', error);
      localStorage.removeItem('authToken');
      return false;
    }
  }

  setLoading(loading) {
    this.state.loading = loading;
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
      loadingOverlay.classList.toggle('hidden', !loading);
    }
  }

  showErrorMessage(message) {
    const errorDiv = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    if (errorDiv && errorText) {
      errorText.textContent = message;
      errorDiv.classList.remove('hidden');
      setTimeout(() => errorDiv.classList.add('hidden'), 5000);
    } else {
      console.error('Error:', message);
    }
  }

  cleanup() {
    if (this.uiManager) this.uiManager.cleanup();
    if (this.recipientManager) this.recipientManager.cleanup();
    if (this.orthiManager) this.orthiManager.cleanup();
    if (this.protocolManager) this.protocolManager.cleanup();

    this.state.initialized = false;
    this.state.loading = false;
    window.docManager = null;
  }
}