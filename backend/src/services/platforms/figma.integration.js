import Figma from 'figma-api';
import { BaseIntegration } from './base.integration.js';

export class FigmaIntegration extends BaseIntegration {
  constructor(integrationConfig) {
    super(integrationConfig);
    this.figma = null;
    this.teamId = integrationConfig.config?.teamId;
  }

  async setupApiClient() {
    this.figma = new Figma.Api({
      personalAccessToken: this.accessToken
    });
  }

  async validateCredentials() {
    try {
      const response = await this.figma.getMe();
      if (!response) {
        throw new Error('Invalid Figma credentials');
      }
      
      this.userId = response.id;
      this.userHandle = response.handle;
      this.userEmail = response.email;
      
      return response;
    } catch (error) {
      throw new Error(`Figma auth validation failed: ${error.message}`);
    }
  }

  async fetchExternalData() {
    const data = [];
    
    try {
      // Fetch team projects
      if (this.syncSettings.syncTypes.includes('projects')) {
        const projects = await this.fetchProjects();
        data.push(...projects);
      }

      // Fetch files
      if (this.syncSettings.syncTypes.includes('files')) {
        const files = await this.fetchFiles();
        data.push(...files);
      }

      // Fetch comments
      if (this.syncSettings.syncTypes.includes('comments')) {
        const comments = await this.fetchComments();
        data.push(...comments);
      }

      return data;
    } catch (error) {
      this.emitError(error, { operation: 'fetchExternalData' });
      throw error;
    }
  }

  async fetchProjects() {
    try {
      if (!this.teamId) {
        throw new Error('Team ID is required for Figma integration');
      }

      const response = await this.figma.getTeamProjects(this.teamId);
      
      return response.projects.map(project => ({
        id: project.id,
        type: 'project',
        name: project.name,
        created: null, // Figma API doesn't provide creation date
        url: `https://www.figma.com/files/project/${project.id}`,
        rawData: project
      }));
    } catch (error) {
      throw new Error(`Failed to fetch Figma projects: ${error.message}`);
    }
  }

  async fetchFiles() {
    try {
      const projects = await this.fetchProjects();
      const files = [];

      for (const project of projects.slice(0, 5)) { // Limit to avoid rate limits
        try {
          const response = await this.figma.getProjectFiles(project.id);
          
          const projectFiles = response.files.map(file => ({
            id: file.key,
            type: 'file',
            name: file.name,
            thumbnail: file.thumbnail_url,
            lastModified: this.normalizeDate(file.last_modified),
            projectId: project.id,
            projectName: project.name,
            url: `https://www.figma.com/file/${file.key}`,
            rawData: file
          }));

          files.push(...projectFiles);
        } catch (projectError) {
          console.warn(`Failed to fetch files for project ${project.name}:`, projectError.message);
        }
      }

      return files;
    } catch (error) {
      throw new Error(`Failed to fetch Figma files: ${error.message}`);
    }
  }

  async fetchComments() {
    try {
      const files = await this.fetchFiles();
      const comments = [];

      for (const file of files.slice(0, 10)) { // Limit to avoid rate limits
        try {
          const response = await this.figma.getComments(file.id);
          
          const fileComments = response.comments.map(comment => ({
            id: comment.id,
            type: 'comment',
            content: comment.message,
            author: {
              id: comment.user.id,
              name: comment.user.handle,
              avatar: comment.user.img_url
            },
            fileId: file.id,
            fileName: file.name,
            created: this.normalizeDate(comment.created_at),
            resolved: comment.resolved,
            position: comment.client_meta ? {
              x: comment.client_meta.x,
              y: comment.client_meta.y,
              node_id: comment.client_meta.node_id
            } : null,
            url: `https://www.figma.com/file/${file.id}`,
            rawData: comment
          }));

          comments.push(...fileComments);
        } catch (fileError) {
          console.warn(`Failed to fetch comments for file ${file.name}:`, fileError.message);
        }
      }

      return comments;
    } catch (error) {
      throw new Error(`Failed to fetch Figma comments: ${error.message}`);
    }
  }

  async fetchInternalData() {
    try {
      const data = [];
      
      // Example: Fetch internal files/designs that should sync to Figma
      // const designs = await Design.find({ workspaceId: this.workspaceId, syncToFigma: true });
      // data.push(...designs.map(d => ({ ...d.toObject(), type: 'file' })));

      return data;
    } catch (error) {
      this.emitError(error, { operation: 'fetchInternalData' });
      throw error;
    }
  }

  async transformFromExternal(figmaData) {
    switch (figmaData.type) {
      case 'project':
        return this.transformFigmaProject(figmaData);
      case 'file':
        return this.transformFigmaFile(figmaData);
      case 'comment':
        return this.transformFigmaComment(figmaData);
      default:
        throw new Error(`Unknown Figma data type: ${figmaData.type}`);
    }
  }

  transformFigmaProject(project) {
    return {
      name: project.name,
      createdAt: project.created,
      externalUrl: project.url,
      platform: 'figma',
      platformId: project.id,
      metadata: {
        figmaData: project.rawData
      }
    };
  }

  transformFigmaFile(file) {
    return {
      name: file.name,
      thumbnail: file.thumbnail,
      lastModified: file.lastModified,
      projectId: file.projectId,
      projectName: file.projectName,
      externalUrl: file.url,
      platform: 'figma',
      platformId: file.id,
      metadata: {
        figmaData: file.rawData
      }
    };
  }

  transformFigmaComment(comment) {
    return {
      content: comment.content,
      authorId: comment.author?.id,
      authorName: comment.author?.name,
      fileId: comment.fileId,
      fileName: comment.fileName,
      createdAt: comment.created,
      resolved: comment.resolved,
      position: comment.position,
      externalUrl: comment.url,
      platform: 'figma',
      platformId: comment.id,
      metadata: {
        figmaData: comment.rawData
      }
    };
  }

  async transformToExternal(internalData) {
    switch (internalData.type) {
      case 'comment':
        return this.transformCommentToFigma(internalData);
      default:
        throw new Error(`Cannot transform internal ${internalData.type} to Figma format`);
    }
  }

  transformCommentToFigma(comment) {
    return {
      message: comment.content,
      client_meta: comment.position ? {
        x: comment.position.x,
        y: comment.position.y,
        node_id: comment.position.node_id
      } : undefined
    };
  }

  async applyToInternal(transformedData, operation, existingId = null) {
    try {
      switch (transformedData.platform) {
        case 'figma':
          if (operation === 'create') {
            // const result = await InternalModel.create(transformedData);
            // return { id: result._id.toString() };
            return { id: this.generateId() };
          } else if (operation === 'update' && existingId) {
            // const result = await InternalModel.findByIdAndUpdate(existingId, transformedData, { new: true });
            // return { id: result._id.toString() };
            return { id: existingId };
          }
          break;
        default:
          throw new Error(`Unknown platform: ${transformedData.platform}`);
      }
    } catch (error) {
      this.emitError(error, { operation: 'applyToInternal', data: transformedData });
      throw error;
    }
  }

  async applyToExternal(transformedData, operation, existingId = null) {
    try {
      switch (operation) {
        case 'create':
          return await this.createInFigma(transformedData);
        case 'update':
          return await this.updateInFigma(transformedData, existingId);
        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }
    } catch (error) {
      this.emitError(error, { operation: 'applyToExternal', data: transformedData });
      throw error;
    }
  }

  async createInFigma(data) {
    if (data.message && data.fileId) {
      // Create comment
      const response = await this.figma.postComment(data.fileId, data.message, data.client_meta);
      
      return {
        id: response.id,
        url: `https://www.figma.com/file/${data.fileId}`
      };
    }

    throw new Error('Invalid data for Figma creation');
  }

  async updateInFigma(data, existingId) {
    // Figma API doesn't support updating comments
    throw new Error('Update not supported for Figma entities');
  }

  async setupWebhooks() {
    try {
      const webhookUrl = `${process.env.APP_URL}/api/v1/integrations/webhooks/figma`;
      
      if (!this.teamId) {
        throw new Error('Team ID is required for Figma webhooks');
      }

      // Figma webhooks are set up through their webhook API
      const response = await this.figma.createWebhook({
        event_type: 'FILE_UPDATE',
        team_id: this.teamId,
        endpoint: webhookUrl,
        passcode: process.env.FIGMA_WEBHOOK_SECRET
      });

      console.log('✅ Figma webhook created successfully');
      return response;
    } catch (error) {
      console.error('Failed to setup Figma webhooks:', error);
    }
  }

  async refreshAccessToken() {
    // Figma personal access tokens don't expire
    throw new Error('Figma token refresh not implemented');
  }
}
