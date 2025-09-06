import { WebClient } from '@slack/web-api';
import { BaseIntegration } from './base.integration.js';

export class SlackIntegration extends BaseIntegration {
  constructor(integrationConfig) {
    super(integrationConfig);
    this.slack = null;
  }

  async setupApiClient() {
    this.slack = new WebClient(this.accessToken);
  }

  async validateCredentials() {
    try {
      const response = await this.slack.auth.test();
      if (!response.ok) {
        throw new Error('Invalid Slack credentials');
      }
      
      this.teamId = response.team_id;
      this.botId = response.bot_id;
      this.userId = response.user_id;
      
      return response;
    } catch (error) {
      throw new Error(`Slack auth validation failed: ${error.message}`);
    }
  }

  async fetchExternalData() {
    const data = [];
    
    try {
      // Fetch channels
      if (this.syncSettings.syncTypes.includes('projects')) {
        const channels = await this.fetchChannels();
        data.push(...channels);
      }

      // Fetch messages
      if (this.syncSettings.syncTypes.includes('messages')) {
        const messages = await this.fetchMessages();
        data.push(...messages);
      }

      // Fetch users
      if (this.syncSettings.syncTypes.includes('users')) {
        const users = await this.fetchUsers();
        data.push(...users);
      }

      // Fetch files
      if (this.syncSettings.syncTypes.includes('files')) {
        const files = await this.fetchFiles();
        data.push(...files);
      }

      return data;
    } catch (error) {
      this.emitError(error, { operation: 'fetchExternalData' });
      throw error;
    }
  }

  async fetchChannels() {
    try {
      const response = await this.slack.conversations.list({
        types: 'public_channel,private_channel',
        limit: 1000
      });

      return response.channels.map(channel => ({
        id: channel.id,
        type: 'project',
        name: channel.name,
        description: channel.purpose?.value || '',
        isPrivate: channel.is_private,
        memberCount: channel.num_members,
        created: this.normalizeDate(channel.created * 1000),
        url: `https://${this.teamId}.slack.com/channels/${channel.name}`,
        rawData: channel
      }));
    } catch (error) {
      throw new Error(`Failed to fetch Slack channels: ${error.message}`);
    }
  }

  async fetchMessages() {
    try {
      const channels = await this.fetchChannels();
      const messages = [];
      
      for (const channel of channels.slice(0, 10)) { // Limit to avoid rate limits
        try {
          const response = await this.slack.conversations.history({
            channel: channel.id,
            limit: 100
          });

          const channelMessages = response.messages.map(message => ({
            id: message.ts,
            type: 'message',
            content: message.text || '',
            author: {
              id: message.user,
              name: message.username || 'Unknown'
            },
            channelId: channel.id,
            channelName: channel.name,
            timestamp: this.normalizeDate(parseFloat(message.ts) * 1000),
            threadId: message.thread_ts,
            url: `https://${this.teamId}.slack.com/archives/${channel.id}/p${message.ts.replace('.', '')}`,
            rawData: message
          }));

          messages.push(...channelMessages);
        } catch (channelError) {
          console.warn(`Failed to fetch messages for channel ${channel.name}:`, channelError.message);
        }
      }

      return messages;
    } catch (error) {
      throw new Error(`Failed to fetch Slack messages: ${error.message}`);
    }
  }

  async fetchUsers() {
    try {
      const response = await this.slack.users.list({ limit: 1000 });

      return response.members
        .filter(user => !user.deleted && !user.is_bot)
        .map(user => ({
          id: user.id,
          type: 'user',
          name: user.real_name || user.name,
          email: user.profile?.email,
          username: user.name,
          avatar: user.profile?.image_192,
          isActive: !user.deleted,
          timezone: user.tz,
          url: `https://${this.teamId}.slack.com/team/${user.id}`,
          rawData: user
        }));
    } catch (error) {
      throw new Error(`Failed to fetch Slack users: ${error.message}`);
    }
  }

  async fetchFiles() {
    try {
      const response = await this.slack.files.list({
        count: 100,
        page: 1
      });

      return response.files.map(file => ({
        id: file.id,
        type: 'file',
        name: file.name,
        title: file.title,
        url: file.url_private,
        downloadUrl: file.url_private_download,
        mimeType: file.mimetype,
        size: file.size,
        author: {
          id: file.user,
          name: 'Unknown'
        },
        created: this.normalizeDate(file.created * 1000),
        channels: file.channels || [],
        rawData: file
      }));
    } catch (error) {
      throw new Error(`Failed to fetch Slack files: ${error.message}`);
    }
  }

  async fetchInternalData() {
    // This would fetch data from your internal system
    // Implementation depends on your internal data models
    try {
      const data = [];
      
      // Example: Fetch internal projects that should sync to Slack
      // const projects = await Project.find({ workspaceId: this.workspaceId, syncToSlack: true });
      // data.push(...projects.map(p => ({ ...p.toObject(), type: 'project' })));

      return data;
    } catch (error) {
      this.emitError(error, { operation: 'fetchInternalData' });
      throw error;
    }
  }

  async transformFromExternal(slackData) {
    switch (slackData.type) {
      case 'project':
        return this.transformSlackChannel(slackData);
      case 'message':
        return this.transformSlackMessage(slackData);
      case 'user':
        return this.transformSlackUser(slackData);
      case 'file':
        return this.transformSlackFile(slackData);
      default:
        throw new Error(`Unknown Slack data type: ${slackData.type}`);
    }
  }

  transformSlackChannel(channel) {
    return {
      name: channel.name,
      description: channel.description,
      isPrivate: channel.isPrivate,
      memberCount: channel.memberCount,
      createdAt: channel.created,
      externalUrl: channel.url,
      platform: 'slack',
      platformId: channel.id,
      metadata: {
        slackData: channel.rawData
      }
    };
  }

  transformSlackMessage(message) {
    return {
      content: message.content,
      authorId: message.author.id,
      authorName: message.author.name,
      channelId: message.channelId,
      channelName: message.channelName,
      timestamp: message.timestamp,
      threadId: message.threadId,
      externalUrl: message.url,
      platform: 'slack',
      platformId: message.id,
      metadata: {
        slackData: message.rawData
      }
    };
  }

  transformSlackUser(user) {
    return {
      name: user.name,
      email: user.email,
      username: user.username,
      avatar: user.avatar,
      isActive: user.isActive,
      timezone: user.timezone,
      externalUrl: user.url,
      platform: 'slack',
      platformId: user.id,
      metadata: {
        slackData: user.rawData
      }
    };
  }

  transformSlackFile(file) {
    return {
      name: file.name,
      title: file.title,
      url: file.url,
      downloadUrl: file.downloadUrl,
      mimeType: file.mimeType,
      size: file.size,
      authorId: file.author.id,
      createdAt: file.created,
      channels: file.channels,
      platform: 'slack',
      platformId: file.id,
      metadata: {
        slackData: file.rawData
      }
    };
  }

  async transformToExternal(internalData) {
    switch (internalData.type) {
      case 'project':
        return this.transformProjectToSlack(internalData);
      case 'message':
        return this.transformMessageToSlack(internalData);
      default:
        throw new Error(`Cannot transform internal ${internalData.type} to Slack format`);
    }
  }

  transformProjectToSlack(project) {
    return {
      name: project.name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      purpose: project.description || '',
      is_private: project.isPrivate || false
    };
  }

  transformMessageToSlack(message) {
    return {
      text: message.content,
      channel: message.channelId,
      thread_ts: message.threadId
    };
  }

  async applyToInternal(transformedData, operation, existingId = null) {
    // This would apply changes to your internal system
    // Implementation depends on your internal data models
    
    try {
      switch (transformedData.platform) {
        case 'slack':
          // Example implementation
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
          return await this.createInSlack(transformedData);
        case 'update':
          return await this.updateInSlack(transformedData, existingId);
        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }
    } catch (error) {
      this.emitError(error, { operation: 'applyToExternal', data: transformedData });
      throw error;
    }
  }

  async createInSlack(data) {
    if (data.name && data.purpose !== undefined) {
      // Create channel
      const response = await this.slack.conversations.create({
        name: data.name,
        is_private: data.is_private || false
      });

      if (data.purpose) {
        await this.slack.conversations.setPurpose({
          channel: response.channel.id,
          purpose: data.purpose
        });
      }

      return {
        id: response.channel.id,
        url: `https://${this.teamId}.slack.com/channels/${data.name}`
      };
    } else if (data.text && data.channel) {
      // Send message
      const response = await this.slack.chat.postMessage(data);
      return {
        id: response.ts,
        url: `https://${this.teamId}.slack.com/archives/${data.channel}/p${response.ts.replace('.', '')}`
      };
    }

    throw new Error('Invalid data for Slack creation');
  }

  async updateInSlack(data, existingId) {
    if (data.text && data.channel) {
      // Update message
      const response = await this.slack.chat.update({
        channel: data.channel,
        ts: existingId,
        text: data.text
      });

      return {
        id: response.ts,
        url: `https://${this.teamId}.slack.com/archives/${data.channel}/p${response.ts.replace('.', '')}`
      };
    }

    throw new Error('Update not supported for this Slack entity type');
  }

  async setupWebhooks() {
    // Slack uses Events API for real-time updates
    // This would typically be configured in the Slack app settings
    console.log('Slack webhooks should be configured in your Slack app settings');
    console.log('Events API URL should point to your webhook endpoint');
  }

  async refreshAccessToken() {
    // Slack tokens don't typically expire, but you might need to handle token refresh
    // This depends on your OAuth implementation
    throw new Error('Slack token refresh not implemented');
  }
}
