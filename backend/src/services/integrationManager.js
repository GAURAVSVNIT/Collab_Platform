import EventEmitter from 'events';
import cron from 'node-cron';
import db from '../models/index.js';

const { integration: Integration, syncLog: SyncLog, entityMapping: EntityMapping } = db;

class IntegrationManager extends EventEmitter {
  constructor() {
    super();
    this.integrations = new Map();
    this.cronJobs = new Map();
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Load all active integrations
      const activeIntegrations = await Integration.find({ isActive: true });
      
      for (const integration of activeIntegrations) {
        await this.loadIntegration(integration);
      }

      // Setup cron jobs for scheduled syncs
      this.setupCronJobs();
      
      this.isInitialized = true;
      console.log('✅ Integration Manager initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Integration Manager:', error);
      throw error;
    }
  }

  async loadIntegration(integration) {
    try {
      const IntegrationClass = await this.getIntegrationClass(integration.platform);
      const integrationInstance = new IntegrationClass(integration);
      
      await integrationInstance.initialize();
      this.integrations.set(integration._id.toString(), integrationInstance);
      
      // Setup real-time sync if enabled
      if (integration.syncSettings.syncFrequency === 'realtime') {
        await this.setupRealtimeSync(integration, integrationInstance);
      }

      console.log(`✅ Loaded ${integration.platform} integration for workspace ${integration.workspaceId}`);
    } catch (error) {
      console.error(`❌ Failed to load integration ${integration._id}:`, error);
      await this.logSyncError(integration._id, 'initialization', error);
    }
  }

  async getIntegrationClass(platform) {
    switch (platform) {
      case 'slack':
        const { SlackIntegration } = await import('./platforms/slack.integration.js');
        return SlackIntegration;
      case 'github':
        const { GitHubIntegration } = await import('./platforms/github.integration.js');
        return GitHubIntegration;
      case 'jira':
        const { JiraIntegration } = await import('./platforms/jira.integration.js');
        return JiraIntegration;
      case 'figma':
        const { FigmaIntegration } = await import('./platforms/figma.integration.js');
        return FigmaIntegration;
      case 'trello':
        const { TrelloIntegration } = await import('./platforms/trello.integration.js');
        return TrelloIntegration;
      case 'google_workspace':
        const { GoogleWorkspaceIntegration } = await import('./platforms/google.integration.js');
        return GoogleWorkspaceIntegration;
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  async setupRealtimeSync(integration, integrationInstance) {
    try {
      // Setup webhooks for real-time updates
      await integrationInstance.setupWebhooks();
      
      // Listen for platform-specific events
      integrationInstance.on('data_changed', async (data) => {
        await this.handleRealtimeSync(integration._id, data);
      });
    } catch (error) {
      console.error(`Failed to setup realtime sync for ${integration.platform}:`, error);
    }
  }

  async handleRealtimeSync(integrationId, data) {
    try {
      const integration = this.integrations.get(integrationId.toString());
      if (!integration) return;

      // Process the real-time data change
      await this.syncData(integrationId, data.entityType, data.operation, data.payload);
    } catch (error) {
      console.error('Realtime sync error:', error);
      await this.logSyncError(integrationId, 'realtime_sync', error);
    }
  }

  setupCronJobs() {
    // Hourly sync
    cron.schedule('0 * * * *', () => {
      this.runScheduledSync('hourly');
    });

    // Daily sync
    cron.schedule('0 0 * * *', () => {
      this.runScheduledSync('daily');
    });

    // Weekly sync
    cron.schedule('0 0 * * 0', () => {
      this.runScheduledSync('weekly');
    });
  }

  async runScheduledSync(frequency) {
    try {
      const integrations = await Integration.find({
        isActive: true,
        'syncSettings.autoSync': true,
        'syncSettings.syncFrequency': frequency
      });

      for (const integration of integrations) {
        await this.performFullSync(integration._id);
      }
    } catch (error) {
      console.error(`Scheduled sync (${frequency}) error:`, error);
    }
  }

  async performFullSync(integrationId) {
    const startTime = Date.now();
    
    try {
      const integration = await Integration.findById(integrationId);
      if (!integration || !integration.isActive) return;

      const integrationInstance = this.integrations.get(integrationId.toString());
      if (!integrationInstance) {
        await this.loadIntegration(integration);
        return this.performFullSync(integrationId);
      }

      // Perform bidirectional sync
      if (integration.syncSettings.bidirectional) {
        // Sync from external platform to internal
        await this.syncFromExternal(integrationInstance, integration);
        
        // Sync from internal to external platform
        await this.syncToExternal(integrationInstance, integration);
      } else {
        // One-way sync based on configuration
        await this.syncFromExternal(integrationInstance, integration);
      }

      // Update last sync timestamp
      await Integration.findByIdAndUpdate(integrationId, {
        lastSync: new Date(),
        syncStatus: 'success'
      });

      const processingTime = Date.now() - startTime;
      console.log(`✅ Full sync completed for ${integration.platform} in ${processingTime}ms`);

    } catch (error) {
      console.error(`❌ Full sync failed for integration ${integrationId}:`, error);
      
      await Integration.findByIdAndUpdate(integrationId, {
        syncStatus: 'error'
      });
      
      await this.logSyncError(integrationId, 'full_sync', error);
    }
  }

  async syncFromExternal(integrationInstance, integration) {
    try {
      const externalData = await integrationInstance.fetchExternalData();
      
      for (const item of externalData) {
        await this.processExternalItem(integration, item, 'from_external');
      }
    } catch (error) {
      console.error('Sync from external error:', error);
      throw error;
    }
  }

  async syncToExternal(integrationInstance, integration) {
    try {
      const internalData = await integrationInstance.fetchInternalData();
      
      for (const item of internalData) {
        await this.processInternalItem(integration, item, 'to_external');
      }
    } catch (error) {
      console.error('Sync to external error:', error);
      throw error;
    }
  }

  async processExternalItem(integration, item, direction) {
    const startTime = Date.now();
    
    try {
      // Check if mapping exists
      const mapping = await EntityMapping.findOne({
        integrationId: integration._id,
        entityType: item.type,
        externalId: item.id
      });

      let operation = 'create';
      let internalId = null;

      if (mapping) {
        operation = 'update';
        internalId = mapping.internalId;
      }

      // Transform external data to internal format
      const integrationInstance = this.integrations.get(integration._id.toString());
      const transformedData = await integrationInstance.transformFromExternal(item);

      // Apply changes to internal system
      const result = await integrationInstance.applyToInternal(transformedData, operation, internalId);
      
      // Create or update mapping
      if (!mapping) {
        await EntityMapping.create({
          integrationId: integration._id,
          workspaceId: integration.workspaceId,
          platform: integration.platform,
          entityType: item.type,
          internalId: result.id,
          externalId: item.id,
          externalUrl: item.url,
          bidirectional: integration.syncSettings.bidirectional
        });
      } else {
        await EntityMapping.findByIdAndUpdate(mapping._id, {
          lastSynced: new Date()
        });
      }

      // Log successful sync
      await this.logSync(integration._id, {
        syncType: 'import',
        operation,
        entityType: item.type,
        entityId: result.id,
        externalId: item.id,
        status: 'success',
        direction,
        processingTime: Date.now() - startTime
      });

    } catch (error) {
      await this.logSync(integration._id, {
        syncType: 'import',
        operation: 'sync',
        entityType: item.type,
        entityId: item.id,
        externalId: item.id,
        status: 'error',
        direction,
        error: {
          message: error.message,
          stack: error.stack
        },
        processingTime: Date.now() - startTime
      });
      throw error;
    }
  }

  async processInternalItem(integration, item, direction) {
    const startTime = Date.now();
    
    try {
      // Check if mapping exists
      const mapping = await EntityMapping.findOne({
        integrationId: integration._id,
        entityType: item.type,
        internalId: item.id
      });

      let operation = 'create';
      let externalId = null;

      if (mapping) {
        operation = 'update';
        externalId = mapping.externalId;
      }

      // Transform internal data to external format
      const integrationInstance = this.integrations.get(integration._id.toString());
      const transformedData = await integrationInstance.transformToExternal(item);

      // Apply changes to external system
      const result = await integrationInstance.applyToExternal(transformedData, operation, externalId);
      
      // Create or update mapping
      if (!mapping) {
        await EntityMapping.create({
          integrationId: integration._id,
          workspaceId: integration.workspaceId,
          platform: integration.platform,
          entityType: item.type,
          internalId: item.id,
          externalId: result.id,
          externalUrl: result.url,
          bidirectional: integration.syncSettings.bidirectional
        });
      } else {
        await EntityMapping.findByIdAndUpdate(mapping._id, {
          lastSynced: new Date()
        });
      }

      // Log successful sync
      await this.logSync(integration._id, {
        syncType: 'export',
        operation,
        entityType: item.type,
        entityId: item.id,
        externalId: result.id,
        status: 'success',
        direction,
        processingTime: Date.now() - startTime
      });

    } catch (error) {
      await this.logSync(integration._id, {
        syncType: 'export',
        operation: 'sync',
        entityType: item.type,
        entityId: item.id,
        externalId: null,
        status: 'error',
        direction,
        error: {
          message: error.message,
          stack: error.stack
        },
        processingTime: Date.now() - startTime
      });
      throw error;
    }
  }

  async logSync(integrationId, data) {
    try {
      const integration = await Integration.findById(integrationId);
      await SyncLog.create({
        integrationId,
        workspaceId: integration.workspaceId,
        platform: integration.platform,
        ...data
      });
    } catch (error) {
      console.error('Failed to log sync:', error);
    }
  }

  async logSyncError(integrationId, operation, error) {
    try {
      const integration = await Integration.findByIdAndUpdate(integrationId, {
        syncStatus: 'error',
        $push: {
          errorLog: {
            timestamp: new Date(),
            error: error.message,
            details: { operation, stack: error.stack }
          }
        }
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
  }

  async addIntegration(integrationData) {
    try {
      const integration = await Integration.create(integrationData);
      await this.loadIntegration(integration);
      return integration;
    } catch (error) {
      console.error('Failed to add integration:', error);
      throw error;
    }
  }

  async removeIntegration(integrationId) {
    try {
      // Remove from memory
      const integration = this.integrations.get(integrationId.toString());
      if (integration) {
        await integration.cleanup();
        this.integrations.delete(integrationId.toString());
      }

      // Deactivate in database
      await Integration.findByIdAndUpdate(integrationId, { isActive: false });
      
      console.log(`✅ Integration ${integrationId} removed successfully`);
    } catch (error) {
      console.error('Failed to remove integration:', error);
      throw error;
    }
  }

  async getIntegrationStatus(integrationId) {
    try {
      const integration = await Integration.findById(integrationId);
      const instance = this.integrations.get(integrationId.toString());
      
      return {
        ...integration.toObject(),
        isLoaded: !!instance,
        health: instance ? await instance.checkHealth() : 'not_loaded'
      };
    } catch (error) {
      console.error('Failed to get integration status:', error);
      throw error;
    }
  }

  async getSyncStats(workspaceId, timeRange = '24h') {
    try {
      const startDate = new Date();
      startDate.setHours(startDate.getHours() - parseInt(timeRange));

      const stats = await SyncLog.aggregate([
        {
          $match: {
            workspaceId: workspaceId,
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: {
              platform: '$platform',
              status: '$status'
            },
            count: { $sum: 1 },
            avgProcessingTime: { $avg: '$processingTime' }
          }
        }
      ]);

      return stats;
    } catch (error) {
      console.error('Failed to get sync stats:', error);
      throw error;
    }
  }
}

// Create singleton instance
const integrationManager = new IntegrationManager();

export default integrationManager;
