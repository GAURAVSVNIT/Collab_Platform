import EventEmitter from 'events';
import axios from 'axios';
import rateLimit from 'axios-rate-limit';

export class BaseIntegration extends EventEmitter {
  constructor(integrationConfig) {
    super();
    this.config = integrationConfig;
    this.platform = integrationConfig.platform;
    this.workspaceId = integrationConfig.workspaceId;
    this.accessToken = integrationConfig.accessToken;
    this.refreshToken = integrationConfig.refreshToken;
    this.syncSettings = integrationConfig.syncSettings;
    this.isInitialized = false;
    
    // Setup rate-limited HTTP client
    this.http = rateLimit(axios.create({
      timeout: 30000,
      headers: {
        'User-Agent': 'CollabPlatform/1.0.0'
      }
    }), { 
      maxRequests: 100, 
      perMilliseconds: 60000 // 100 requests per minute
    });
  }

  async initialize() {
    try {
      await this.validateCredentials();
      await this.setupApiClient();
      this.isInitialized = true;
      console.log(`✅ ${this.platform} integration initialized`);
    } catch (error) {
      console.error(`❌ Failed to initialize ${this.platform} integration:`, error);
      throw error;
    }
  }

  // Abstract methods that must be implemented by each platform
  async validateCredentials() {
    throw new Error('validateCredentials must be implemented by platform integration');
  }

  async setupApiClient() {
    throw new Error('setupApiClient must be implemented by platform integration');
  }

  async fetchExternalData() {
    throw new Error('fetchExternalData must be implemented by platform integration');
  }

  async fetchInternalData() {
    throw new Error('fetchInternalData must be implemented by platform integration');
  }

  async transformFromExternal(data) {
    throw new Error('transformFromExternal must be implemented by platform integration');
  }

  async transformToExternal(data) {
    throw new Error('transformToExternal must be implemented by platform integration');
  }

  async applyToInternal(data, operation, existingId = null) {
    throw new Error('applyToInternal must be implemented by platform integration');
  }

  async applyToExternal(data, operation, existingId = null) {
    throw new Error('applyToExternal must be implemented by platform integration');
  }

  async setupWebhooks() {
    // Optional: Override if platform supports webhooks
    console.log(`Webhook setup not implemented for ${this.platform}`);
  }

  async checkHealth() {
    try {
      await this.validateCredentials();
      return 'healthy';
    } catch (error) {
      return 'unhealthy';
    }
  }

  async cleanup() {
    // Override if platform needs cleanup
    console.log(`Cleaning up ${this.platform} integration`);
  }

  // Helper methods
  async refreshAccessToken() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }
    
    // This should be implemented by each platform
    throw new Error('refreshAccessToken must be implemented by platform integration');
  }

  async handleApiError(error, retryCount = 0) {
    const maxRetries = 3;
    
    if (error.response?.status === 401 && this.refreshToken && retryCount === 0) {
      try {
        await this.refreshAccessToken();
        return true; // Indicate that retry is possible
      } catch (refreshError) {
        console.error('Failed to refresh token:', refreshError);
        this.emit('auth_error', refreshError);
        throw refreshError;
      }
    }
    
    if (error.response?.status === 429 && retryCount < maxRetries) {
      // Rate limit hit, wait and retry
      const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
      return true;
    }
    
    if (retryCount < maxRetries && error.code === 'ECONNRESET') {
      // Network error, retry
      const delay = Math.pow(2, retryCount) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
      return true;
    }
    
    // Don't retry for other errors
    return false;
  }

  async makeApiRequest(config, retryCount = 0) {
    try {
      const response = await this.http(config);
      return response.data;
    } catch (error) {
      const shouldRetry = await this.handleApiError(error, retryCount);
      
      if (shouldRetry && retryCount < 3) {
        return this.makeApiRequest(config, retryCount + 1);
      }
      
      throw error;
    }
  }

  // Data transformation helpers
  normalizeDate(dateString) {
    if (!dateString) return null;
    return new Date(dateString);
  }

  normalizeUser(userObj) {
    return {
      id: userObj.id || userObj._id,
      name: userObj.name || userObj.displayName || userObj.username,
      email: userObj.email,
      avatar: userObj.avatar || userObj.avatarUrl || userObj.picture
    };
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Event emission helpers
  emitDataChange(entityType, operation, data) {
    this.emit('data_changed', {
      platform: this.platform,
      entityType,
      operation,
      payload: data,
      timestamp: new Date()
    });
  }

  emitError(error, context = {}) {
    this.emit('error', {
      platform: this.platform,
      error: error.message,
      stack: error.stack,
      context,
      timestamp: new Date()
    });
  }

  emitSync(type, status, data = {}) {
    this.emit('sync', {
      platform: this.platform,
      type,
      status,
      data,
      timestamp: new Date()
    });
  }
}
