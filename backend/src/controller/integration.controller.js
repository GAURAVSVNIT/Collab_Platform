import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import integrationManager from "../services/integrationManager.js";
import db from "../models/index.js";

const { integration: Integration, syncLog: SyncLog, entityMapping: EntityMapping } = db;

const getAllIntegrations = asyncHandler(async (req, res) => {
  const { workspaceId, platform, isActive } = req.query;
  
  const filter = {};
  if (workspaceId) filter.workspaceId = workspaceId;
  if (platform) filter.platform = platform;
  if (isActive !== undefined) filter.isActive = isActive === 'true';

  const integrations = await Integration.find(filter)
    .sort({ createdAt: -1 })
    .select('-accessToken -refreshToken'); // Don't expose tokens

  return res.status(200).json(
    new ApiResponse(200, integrations, "Integrations fetched successfully")
  );
});

const getIntegration = asyncHandler(async (req, res) => {
  const { integrationId } = req.params;

  const integration = await Integration.findById(integrationId)
    .select('-accessToken -refreshToken');

  if (!integration) {
    throw new ApiError(404, "Integration not found");
  }

  // Get additional status information
  const status = await integrationManager.getIntegrationStatus(integrationId);

  return res.status(200).json(
    new ApiResponse(200, { ...integration.toObject(), ...status }, "Integration fetched successfully")
  );
});

const createIntegration = asyncHandler(async (req, res) => {
  const {
    workspaceId,
    platform,
    name,
    config,
    accessToken,
    refreshToken,
    syncSettings
  } = req.body;

  if (!workspaceId || !platform || !name || !accessToken) {
    throw new ApiError(400, "Missing required fields: workspaceId, platform, name, accessToken");
  }

  const supportedPlatforms = ['slack', 'github', 'jira', 'figma', 'trello', 'google_workspace'];
  if (!supportedPlatforms.includes(platform)) {
    throw new ApiError(400, `Unsupported platform. Supported platforms: ${supportedPlatforms.join(', ')}`);
  }

  // Check if integration already exists for this workspace and platform
  const existingIntegration = await Integration.findOne({
    workspaceId,
    platform,
    isActive: true
  });

  if (existingIntegration) {
    throw new ApiError(409, `Active ${platform} integration already exists for this workspace`);
  }

  const integrationData = {
    workspaceId,
    platform,
    name,
    config: config || {},
    accessToken,
    refreshToken,
    syncSettings: {
      bidirectional: true,
      syncFrequency: 'realtime',
      autoSync: true,
      syncTypes: ['tasks', 'messages', 'files', 'comments'],
      ...syncSettings
    }
  };

  const integration = await integrationManager.addIntegration(integrationData);

  return res.status(201).json(
    new ApiResponse(201, integration, "Integration created successfully")
  );
});

const updateIntegration = asyncHandler(async (req, res) => {
  const { integrationId } = req.params;
  const updates = req.body;

  // Don't allow updating certain fields
  delete updates.workspaceId;
  delete updates.platform;
  delete updates.createdAt;
  delete updates.updatedAt;

  const integration = await Integration.findByIdAndUpdate(
    integrationId,
    updates,
    { new: true, runValidators: true }
  ).select('-accessToken -refreshToken');

  if (!integration) {
    throw new ApiError(404, "Integration not found");
  }

  // Reload integration in manager if it's active
  if (integration.isActive) {
    await integrationManager.removeIntegration(integrationId);
    await integrationManager.loadIntegration(integration);
  }

  return res.status(200).json(
    new ApiResponse(200, integration, "Integration updated successfully")
  );
});

const deleteIntegration = asyncHandler(async (req, res) => {
  const { integrationId } = req.params;

  const integration = await Integration.findById(integrationId);
  if (!integration) {
    throw new ApiError(404, "Integration not found");
  }

  // Remove from integration manager
  await integrationManager.removeIntegration(integrationId);

  // Soft delete - just mark as inactive
  await Integration.findByIdAndUpdate(integrationId, { isActive: false });

  return res.status(200).json(
    new ApiResponse(200, {}, "Integration deleted successfully")
  );
});

const syncIntegration = asyncHandler(async (req, res) => {
  const { integrationId } = req.params;
  const { syncType = 'bidirectional' } = req.body;

  const integration = await Integration.findById(integrationId);
  if (!integration) {
    throw new ApiError(404, "Integration not found");
  }

  if (!integration.isActive) {
    throw new ApiError(400, "Cannot sync inactive integration");
  }

  // Trigger sync
  try {
    await integrationManager.performFullSync(integrationId);
    
    return res.status(200).json(
      new ApiResponse(200, {}, "Sync completed successfully")
    );
  } catch (error) {
    throw new ApiError(500, `Sync failed: ${error.message}`);
  }
});

const getIntegrationStatus = asyncHandler(async (req, res) => {
  const { integrationId } = req.params;

  try {
    const status = await integrationManager.getIntegrationStatus(integrationId);
    
    return res.status(200).json(
      new ApiResponse(200, status, "Integration status fetched successfully")
    );
  } catch (error) {
    throw new ApiError(404, "Integration not found");
  }
});

const getSyncLogs = asyncHandler(async (req, res) => {
  const { integrationId } = req.params;
  const { 
    page = 1, 
    limit = 50, 
    status, 
    entityType, 
    operation,
    startDate,
    endDate 
  } = req.query;

  const filter = { integrationId };
  
  if (status) filter.status = status;
  if (entityType) filter.entityType = entityType;
  if (operation) filter.operation = operation;
  
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    sort: { createdAt: -1 }
  };

  const logs = await SyncLog.find(filter)
    .sort(options.sort)
    .limit(options.limit)
    .skip((options.page - 1) * options.limit);

  const total = await SyncLog.countDocuments(filter);

  return res.status(200).json(
    new ApiResponse(200, {
      logs,
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        pages: Math.ceil(total / options.limit)
      }
    }, "Sync logs fetched successfully")
  );
});

const getSyncStats = asyncHandler(async (req, res) => {
  const { integrationId } = req.params;
  const { timeRange = '24h' } = req.query;

  const integration = await Integration.findById(integrationId);
  if (!integration) {
    throw new ApiError(404, "Integration not found");
  }

  const stats = await integrationManager.getSyncStats(integration.workspaceId, timeRange);

  return res.status(200).json(
    new ApiResponse(200, stats, "Sync statistics fetched successfully")
  );
});

const retryFailedSync = asyncHandler(async (req, res) => {
  const { integrationId } = req.params;
  const { logIds } = req.body;

  if (!logIds || !Array.isArray(logIds)) {
    throw new ApiError(400, "logIds array is required");
  }

  // Mark logs for retry by updating retry count
  await SyncLog.updateMany(
    {
      _id: { $in: logIds },
      integrationId,
      status: 'error',
      retryCount: { $lt: 3 }
    },
    {
      $inc: { retryCount: 1 },
      $set: { status: 'pending' }
    }
  );

  // Trigger a new sync
  await integrationManager.performFullSync(integrationId);

  return res.status(200).json(
    new ApiResponse(200, {}, "Failed syncs queued for retry")
  );
});

const pauseIntegration = asyncHandler(async (req, res) => {
  const { integrationId } = req.params;

  await Integration.findByIdAndUpdate(integrationId, {
    syncStatus: 'paused',
    'syncSettings.autoSync': false
  });

  // Remove from active integrations
  await integrationManager.removeIntegration(integrationId);

  return res.status(200).json(
    new ApiResponse(200, {}, "Integration paused successfully")
  );
});

const resumeIntegration = asyncHandler(async (req, res) => {
  const { integrationId } = req.params;

  const integration = await Integration.findByIdAndUpdate(integrationId, {
    syncStatus: 'success',
    'syncSettings.autoSync': true
  }, { new: true });

  if (!integration) {
    throw new ApiError(404, "Integration not found");
  }

  // Load integration back into manager
  await integrationManager.loadIntegration(integration);

  return res.status(200).json(
    new ApiResponse(200, {}, "Integration resumed successfully")
  );
});

const testIntegration = asyncHandler(async (req, res) => {
  const { integrationId } = req.params;

  try {
    const status = await integrationManager.getIntegrationStatus(integrationId);
    
    if (status.health === 'healthy') {
      return res.status(200).json(
        new ApiResponse(200, { status: 'healthy' }, "Integration test successful")
      );
    } else {
      return res.status(400).json(
        new ApiResponse(400, { status: 'unhealthy' }, "Integration test failed")
      );
    }
  } catch (error) {
    throw new ApiError(500, `Integration test failed: ${error.message}`);
  }
});

export {
  getAllIntegrations,
  getIntegration,
  createIntegration,
  updateIntegration,
  deleteIntegration,
  syncIntegration,
  getIntegrationStatus,
  getSyncLogs,
  getSyncStats,
  retryFailedSync,
  pauseIntegration,
  resumeIntegration,
  testIntegration
};
