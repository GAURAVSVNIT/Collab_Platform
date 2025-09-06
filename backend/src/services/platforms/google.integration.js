import { google } from 'googleapis';
import { BaseIntegration } from './base.integration.js';

export class GoogleWorkspaceIntegration extends BaseIntegration {
  constructor(integrationConfig) {
    super(integrationConfig);
    this.auth = null;
    this.drive = null;
    this.calendar = null;
    this.gmail = null;
    this.docs = null;
    this.sheets = null;
    this.clientId = integrationConfig.config?.clientId;
    this.clientSecret = integrationConfig.config?.clientSecret;
  }

  async setupApiClient() {
    this.auth = new google.auth.OAuth2(
      this.clientId,
      this.clientSecret,
      `${process.env.APP_URL}/api/v1/auth/google/callback`
    );

    this.auth.setCredentials({
      access_token: this.accessToken,
      refresh_token: this.refreshToken
    });

    this.drive = google.drive({ version: 'v3', auth: this.auth });
    this.calendar = google.calendar({ version: 'v3', auth: this.auth });
    this.gmail = google.gmail({ version: 'v1', auth: this.auth });
    this.docs = google.docs({ version: 'v1', auth: this.auth });
    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
  }

  async validateCredentials() {
    try {
      const response = await this.drive.about.get({
        fields: 'user'
      });
      
      if (!response.data.user) {
        throw new Error('Invalid Google Workspace credentials');
      }
      
      this.userId = response.data.user.emailAddress;
      this.userName = response.data.user.displayName;
      
      return response.data.user;
    } catch (error) {
      throw new Error(`Google Workspace auth validation failed: ${error.message}`);
    }
  }

  async fetchExternalData() {
    const data = [];
    
    try {
      // Fetch Drive files
      if (this.syncSettings.syncTypes.includes('files')) {
        const files = await this.fetchDriveFiles();
        data.push(...files);
      }

      // Fetch Calendar events
      if (this.syncSettings.syncTypes.includes('tasks')) {
        const events = await this.fetchCalendarEvents();
        data.push(...events);
      }

      // Fetch Gmail messages (limited)
      if (this.syncSettings.syncTypes.includes('messages')) {
        const messages = await this.fetchGmailMessages();
        data.push(...messages);
      }

      return data;
    } catch (error) {
      this.emitError(error, { operation: 'fetchExternalData' });
      throw error;
    }
  }

  async fetchDriveFiles() {
    try {
      const response = await this.drive.files.list({
        pageSize: 100,
        fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, owners, permissions, webViewLink, thumbnailLink, description)',
        q: "trashed=false and (mimeType='application/vnd.google-apps.document' or mimeType='application/vnd.google-apps.spreadsheet' or mimeType='application/vnd.google-apps.presentation' or mimeType='application/vnd.google-apps.folder')"
      });

      return response.data.files.map(file => ({
        id: file.id,
        type: 'file',
        name: file.name,
        mimeType: file.mimeType,
        size: parseInt(file.size) || 0,
        description: file.description || '',
        created: this.normalizeDate(file.createdTime),
        modified: this.normalizeDate(file.modifiedTime),
        owners: file.owners?.map(owner => ({
          id: owner.emailAddress,
          name: owner.displayName,
          email: owner.emailAddress,
          avatar: owner.photoLink
        })) || [],
        url: file.webViewLink,
        thumbnail: file.thumbnailLink,
        isFolder: file.mimeType === 'application/vnd.google-apps.folder',
        rawData: file
      }));
    } catch (error) {
      throw new Error(`Failed to fetch Google Drive files: ${error.message}`);
    }
  }

  async fetchCalendarEvents() {
    try {
      const now = new Date();
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const oneMonthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const response = await this.calendar.events.list({
        calendarId: 'primary',
        timeMin: oneMonthAgo.toISOString(),
        timeMax: oneMonthFromNow.toISOString(),
        maxResults: 100,
        singleEvents: true,
        orderBy: 'startTime'
      });

      return response.data.items.map(event => ({
        id: event.id,
        type: 'task',
        subtype: 'event',
        title: event.summary || 'Untitled Event',
        description: event.description || '',
        location: event.location || '',
        status: event.status,
        startTime: this.normalizeDate(event.start?.dateTime || event.start?.date),
        endTime: this.normalizeDate(event.end?.dateTime || event.end?.date),
        allDay: !event.start?.dateTime,
        organizer: event.organizer ? {
          id: event.organizer.email,
          name: event.organizer.displayName || event.organizer.email,
          email: event.organizer.email
        } : null,
        attendees: event.attendees?.map(attendee => ({
          id: attendee.email,
          name: attendee.displayName || attendee.email,
          email: attendee.email,
          responseStatus: attendee.responseStatus,
          optional: attendee.optional
        })) || [],
        created: this.normalizeDate(event.created),
        updated: this.normalizeDate(event.updated),
        url: event.htmlLink,
        meetingUrl: event.hangoutLink || event.conferenceData?.entryPoints?.[0]?.uri,
        rawData: event
      }));
    } catch (error) {
      throw new Error(`Failed to fetch Google Calendar events: ${error.message}`);
    }
  }

  async fetchGmailMessages() {
    try {
      // Only fetch recent important messages to avoid overwhelming the system
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: 'is:important in:inbox',
        maxResults: 20
      });

      if (!response.data.messages) {
        return [];
      }

      const messages = [];
      for (const messageRef of response.data.messages) {
        try {
          const message = await this.gmail.users.messages.get({
            userId: 'me',
            id: messageRef.id,
            format: 'metadata',
            metadataHeaders: ['From', 'To', 'Subject', 'Date']
          });

          const headers = message.data.payload.headers;
          const getHeader = (name) => headers.find(h => h.name === name)?.value || '';

          messages.push({
            id: message.data.id,
            type: 'message',
            subject: getHeader('Subject'),
            from: getHeader('From'),
            to: getHeader('To'),
            date: this.normalizeDate(getHeader('Date')),
            threadId: message.data.threadId,
            snippet: message.data.snippet,
            labelIds: message.data.labelIds,
            url: `https://mail.google.com/mail/u/0/#inbox/${message.data.id}`,
            rawData: message.data
          });
        } catch (messageError) {
          console.warn(`Failed to fetch Gmail message ${messageRef.id}:`, messageError.message);
        }
      }

      return messages;
    } catch (error) {
      throw new Error(`Failed to fetch Gmail messages: ${error.message}`);
    }
  }

  async fetchInternalData() {
    try {
      const data = [];
      
      // Example: Fetch internal files/events that should sync to Google Workspace
      // const files = await File.find({ workspaceId: this.workspaceId, syncToGoogle: true });
      // data.push(...files.map(f => ({ ...f.toObject(), type: 'file' })));

      return data;
    } catch (error) {
      this.emitError(error, { operation: 'fetchInternalData' });
      throw error;
    }
  }

  async transformFromExternal(googleData) {
    switch (googleData.type) {
      case 'file':
        return this.transformGoogleFile(googleData);
      case 'task':
        return this.transformGoogleEvent(googleData);
      case 'message':
        return this.transformGoogleMessage(googleData);
      default:
        throw new Error(`Unknown Google Workspace data type: ${googleData.type}`);
    }
  }

  transformGoogleFile(file) {
    return {
      name: file.name,
      mimeType: file.mimeType,
      size: file.size,
      description: file.description,
      createdAt: file.created,
      modifiedAt: file.modified,
      owners: file.owners,
      isFolder: file.isFolder,
      externalUrl: file.url,
      thumbnail: file.thumbnail,
      platform: 'google_workspace',
      platformId: file.id,
      metadata: {
        googleData: file.rawData
      }
    };
  }

  transformGoogleEvent(event) {
    return {
      title: event.title,
      description: event.description,
      location: event.location,
      status: event.status,
      startTime: event.startTime,
      endTime: event.endTime,
      allDay: event.allDay,
      organizerId: event.organizer?.id,
      attendees: event.attendees,
      createdAt: event.created,
      updatedAt: event.updated,
      externalUrl: event.url,
      meetingUrl: event.meetingUrl,
      platform: 'google_workspace',
      platformId: event.id,
      subtype: 'event',
      metadata: {
        googleData: event.rawData
      }
    };
  }

  transformGoogleMessage(message) {
    return {
      subject: message.subject,
      from: message.from,
      to: message.to,
      date: message.date,
      threadId: message.threadId,
      snippet: message.snippet,
      labels: message.labelIds,
      externalUrl: message.url,
      platform: 'google_workspace',
      platformId: message.id,
      metadata: {
        googleData: message.rawData
      }
    };
  }

  async transformToExternal(internalData) {
    switch (internalData.type) {
      case 'file':
        return this.transformFileToGoogle(internalData);
      case 'task':
        return this.transformTaskToGoogle(internalData);
      default:
        throw new Error(`Cannot transform internal ${internalData.type} to Google Workspace format`);
    }
  }

  transformFileToGoogle(file) {
    return {
      name: file.name,
      parents: file.parentId ? [file.parentId] : undefined,
      description: file.description
    };
  }

  transformTaskToGoogle(task) {
    return {
      summary: task.title,
      description: task.description,
      location: task.location,
      start: {
        dateTime: task.startTime ? new Date(task.startTime).toISOString() : undefined,
        date: task.allDay ? new Date(task.startTime).toISOString().split('T')[0] : undefined
      },
      end: {
        dateTime: task.endTime ? new Date(task.endTime).toISOString() : undefined,
        date: task.allDay ? new Date(task.endTime).toISOString().split('T')[0] : undefined
      },
      attendees: task.attendees?.map(attendee => ({
        email: attendee.email,
        displayName: attendee.name,
        optional: attendee.optional
      }))
    };
  }

  async applyToInternal(transformedData, operation, existingId = null) {
    try {
      switch (transformedData.platform) {
        case 'google_workspace':
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
          return await this.createInGoogle(transformedData);
        case 'update':
          return await this.updateInGoogle(transformedData, existingId);
        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }
    } catch (error) {
      this.emitError(error, { operation: 'applyToExternal', data: transformedData });
      throw error;
    }
  }

  async createInGoogle(data) {
    if (data.name && data.parents !== undefined) {
      // Create file/folder in Drive
      const response = await this.drive.files.create({
        resource: data,
        fields: 'id, webViewLink'
      });
      
      return {
        id: response.data.id,
        url: response.data.webViewLink
      };
    } else if (data.summary && data.start) {
      // Create calendar event
      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        resource: data
      });
      
      return {
        id: response.data.id,
        url: response.data.htmlLink
      };
    }

    throw new Error('Invalid data for Google Workspace creation');
  }

  async updateInGoogle(data, existingId) {
    if (data.summary && data.start) {
      // Update calendar event
      const response = await this.calendar.events.update({
        calendarId: 'primary',
        eventId: existingId,
        resource: data
      });
      
      return {
        id: response.data.id,
        url: response.data.htmlLink
      };
    } else if (data.name) {
      // Update file metadata
      const response = await this.drive.files.update({
        fileId: existingId,
        resource: data,
        fields: 'id, webViewLink'
      });
      
      return {
        id: response.data.id,
        url: response.data.webViewLink
      };
    }

    throw new Error('Update not supported for this Google Workspace entity type');
  }

  async setupWebhooks() {
    try {
      const webhookUrl = `${process.env.APP_URL}/api/v1/integrations/webhooks/google`;
      
      // Setup Drive webhook
      await this.drive.changes.watch({
        resource: {
          id: this.generateId(),
          type: 'web_hook',
          address: webhookUrl,
          payload: true
        }
      });

      // Setup Calendar webhook
      await this.calendar.events.watch({
        calendarId: 'primary',
        resource: {
          id: this.generateId(),
          type: 'web_hook',
          address: webhookUrl,
          payload: true
        }
      });

      console.log('✅ Google Workspace webhooks created successfully');
    } catch (error) {
      console.error('Failed to setup Google Workspace webhooks:', error);
    }
  }

  async refreshAccessToken() {
    try {
      const { credentials } = await this.auth.refreshAccessToken();
      this.accessToken = credentials.access_token;
      
      // Update stored token in database
      // await Integration.findByIdAndUpdate(this.config._id, {
      //   accessToken: this.accessToken
      // });
      
      return credentials;
    } catch (error) {
      throw new Error(`Failed to refresh Google access token: ${error.message}`);
    }
  }
}
