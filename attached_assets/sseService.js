import { getAuthToken } from './auth.js';
import { ErrorHandler } from './errorHandler.js';

class SSEService {
  constructor() {
    this.connections = new Map();
    this.retryConfig = {
      maxRetries: 3, // Using edited code's default
      initialDelay: 2000, // Using edited code's default
      maxDelay: 30000,
      backoffFactor: 1.5
    };
    this.connectionStatus = new Map();
    this.eventListeners = new Map();
  }

  async connect(endpoint, handlers = {}) {
    const token = await getAuthToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    const connectionId = this.generateConnectionId(endpoint);
    if (this.connections.has(connectionId)) {
      await this.disconnect(endpoint);
    }

    const url = this.buildEventSourceUrl(endpoint);
    url.searchParams.append('auth_token', token);

    const eventSource = new EventSource(url.toString(), {
      withCredentials: true
    });

    this.initializeConnectionStatus(connectionId);
    this.setupEventHandlers(connectionId, eventSource, handlers);
    this.connections.set(connectionId, {
      eventSource,
      handlers,
      timestamp: Date.now()
    });
    
    return eventSource;
  }

  setupEventHandlers(connectionId, eventSource, handlers) {
    const status = this.connectionStatus.get(connectionId);
    let retryCount = 0;


    eventSource.onopen = () => {
      console.debug(`SSE connection opened: ${connectionId}`);
      retryCount = 0;
      status.connected = true;
      status.lastConnected = Date.now();
      if (handlers.onOpen) handlers.onOpen();
    };

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      status.connected = false;
      status.lastError = Date.now();

      if (retryCount < this.retryConfig.maxRetries) {
        const delay = this.calculateRetryDelay(retryCount);
        retryCount++;
        status.nextRetryAttempt = Date.now() + delay;

        if (handlers.onRetry) {
          handlers.onRetry({
            retryCount,
            maxRetries: this.retryConfig.maxRetries,
            delay
          });
        }
        setTimeout(() => this.reconnect(connectionId), delay);
      } else {
        this.disconnect(connectionId);
        if (handlers.onMaxRetriesReached) handlers.onMaxRetriesReached();
      }
    };

    Object.entries(handlers).forEach(([event, handler]) => {
      eventSource.addEventListener(event, handler);
    });
  }


  calculateRetryDelay(retryCount) {
    return Math.min(
      this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffFactor, retryCount),
      this.retryConfig.maxDelay
    );
  }

  async reconnect(connectionId) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    await this.disconnect(connectionId);
    const endpoint = this.extractEndpoint(connectionId);
    await this.connect(endpoint, connection.handlers);
  }

  async disconnect(endpoint) {
    const connectionId = this.generateConnectionId(endpoint);
    const connection = this.connections.get(connectionId);

    if (connection) {
      connection.eventSource.close();
      this.connections.delete(connectionId);
      this.connectionStatus.delete(connectionId);
    }
  }

  async disconnectAll() {
    for (const connectionId of this.connections.keys()) {
      await this.disconnect(this.extractEndpoint(connectionId));
    }
  }

  buildEventSourceUrl(endpoint) {
    return new URL(endpoint, window.location.origin);
  }

  generateConnectionId(endpoint) {
    return `sse-${endpoint}-${Date.now()}`;
  }

  extractEndpoint(connectionId) {
    return connectionId.split('-')[1];
  }

  initializeConnectionStatus(connectionId) {
    this.connectionStatus.set(connectionId, {
      connected: false,
      retryCount: 0,
      lastConnected: null,
      lastMessageReceived: null,
      lastError: null,
      nextRetryAttempt: null
    });
  }
}

export const sseService = new SSEService();