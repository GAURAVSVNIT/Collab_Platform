import JiraApi from 'node-jira-client';
import { BaseIntegration } from './base.integration.js';

export class JiraIntegration extends BaseIntegration {
  constructor(integrationConfig) {
    super(integrationConfig);
    this.jira = null;
    this.host = integrationConfig.config?.host;
    this.username = integrationConfig.config?.username;
    this.projectKey = integrationConfig.config?.projectKey;
  }

  async setupApiClient() {
    this.jira = new JiraApi({
      protocol: 'https',
      host: this.host,
      username: this.username,
      password: this.accessToken, // API token for Jira Cloud
      apiVersion: '2',
      strictSSL: true
    });
  }

  async validateCredentials() {
    try {
      const response = await this.jira.getCurrentUser();
      if (!response) {
        throw new Error('Invalid Jira credentials');
      }
      
      this.userId = response.accountId;
      this.userDisplayName = response.displayName;
      
      return response;
    } catch (error) {
      throw new Error(`Jira auth validation failed: ${error.message}`);
    }
  }

  async fetchExternalData() {
    const data = [];
    
    try {
      // Fetch projects
      if (this.syncSettings.syncTypes.includes('projects')) {
        const projects = await this.fetchProjects();
        data.push(...projects);
      }

      // Fetch issues
      if (this.syncSettings.syncTypes.includes('tasks')) {
        const issues = await this.fetchIssues();
        data.push(...issues);
      }

      // Fetch comments
      if (this.syncSettings.syncTypes.includes('comments')) {
        const comments = await this.fetchComments();
        data.push(...comments);
      }

      // Fetch users
      if (this.syncSettings.syncTypes.includes('users')) {
        const users = await this.fetchUsers();
        data.push(...users);
      }

      return data;
    } catch (error) {
      this.emitError(error, { operation: 'fetchExternalData' });
      throw error;
    }
  }

  async fetchProjects() {
    try {
      const response = await this.jira.listProjects();

      return response.map(project => ({
        id: project.id,
        type: 'project',
        key: project.key,
        name: project.name,
        description: project.description || '',
        lead: project.lead ? {
          id: project.lead.accountId,
          name: project.lead.displayName,
          email: project.lead.emailAddress
        } : null,
        projectType: project.projectTypeKey,
        style: project.style,
        created: this.normalizeDate(project.created),
        url: `https://${this.host}/projects/${project.key}`,
        rawData: project
      }));
    } catch (error) {
      throw new Error(`Failed to fetch Jira projects: ${error.message}`);
    }
  }

  async fetchIssues() {
    try {
      const jql = this.projectKey 
        ? `project = ${this.projectKey} ORDER BY updated DESC`
        : 'ORDER BY updated DESC';

      const response = await this.jira.searchJira(jql, {
        expand: ['changelog', 'renderedFields'],
        fields: [
          'summary', 'description', 'status', 'priority', 'issuetype',
          'assignee', 'reporter', 'created', 'updated', 'resolutiondate',
          'labels', 'components', 'fixVersions', 'parent', 'subtasks',
          'comment', 'attachment', 'worklog'
        ],
        maxResults: 100
      });

      return response.issues.map(issue => ({
        id: issue.id,
        type: 'task',
        key: issue.key,
        summary: issue.fields.summary,
        description: issue.fields.description || '',
        status: {
          id: issue.fields.status.id,
          name: issue.fields.status.name,
          category: issue.fields.status.statusCategory.name
        },
        priority: issue.fields.priority ? {
          id: issue.fields.priority.id,
          name: issue.fields.priority.name,
          iconUrl: issue.fields.priority.iconUrl
        } : null,
        issueType: {
          id: issue.fields.issuetype.id,
          name: issue.fields.issuetype.name,
          iconUrl: issue.fields.issuetype.iconUrl,
          subtask: issue.fields.issuetype.subtask
        },
        assignee: issue.fields.assignee ? {
          id: issue.fields.assignee.accountId,
          name: issue.fields.assignee.displayName,
          email: issue.fields.assignee.emailAddress,
          avatar: issue.fields.assignee.avatarUrls?.['48x48']
        } : null,
        reporter: issue.fields.reporter ? {
          id: issue.fields.reporter.accountId,
          name: issue.fields.reporter.displayName,
          email: issue.fields.reporter.emailAddress,
          avatar: issue.fields.reporter.avatarUrls?.['48x48']
        } : null,
        labels: issue.fields.labels || [],
        components: issue.fields.components?.map(comp => ({
          id: comp.id,
          name: comp.name,
          description: comp.description
        })) || [],
        fixVersions: issue.fields.fixVersions?.map(version => ({
          id: version.id,
          name: version.name,
          released: version.released,
          releaseDate: this.normalizeDate(version.releaseDate)
        })) || [],
        parent: issue.fields.parent ? {
          id: issue.fields.parent.id,
          key: issue.fields.parent.key,
          summary: issue.fields.parent.fields.summary
        } : null,
        subtasks: issue.fields.subtasks?.map(subtask => ({
          id: subtask.id,
          key: subtask.key,
          summary: subtask.fields.summary,
          status: subtask.fields.status.name
        })) || [],
        created: this.normalizeDate(issue.fields.created),
        updated: this.normalizeDate(issue.fields.updated),
        resolved: this.normalizeDate(issue.fields.resolutiondate),
        url: `https://${this.host}/browse/${issue.key}`,
        rawData: issue
      }));
    } catch (error) {
      throw new Error(`Failed to fetch Jira issues: ${error.message}`);
    }
  }

  async fetchComments() {
    try {
      const comments = [];
      const issues = await this.fetchIssues();

      for (const issue of issues.slice(0, 20)) { // Limit to avoid rate limits
        try {
          const response = await this.jira.getComments(issue.key);
          
          const issueComments = response.comments.map(comment => ({
            id: comment.id,
            type: 'comment',
            content: comment.body,
            author: {
              id: comment.author.accountId,
              name: comment.author.displayName,
              email: comment.author.emailAddress,
              avatar: comment.author.avatarUrls?.['48x48']
            },
            issueId: issue.id,
            issueKey: issue.key,
            created: this.normalizeDate(comment.created),
            updated: this.normalizeDate(comment.updated),
            url: `https://${this.host}/browse/${issue.key}?focusedCommentId=${comment.id}`,
            rawData: comment
          }));

          comments.push(...issueComments);
        } catch (commentError) {
          console.warn(`Failed to fetch comments for issue ${issue.key}:`, commentError.message);
        }
      }

      return comments;
    } catch (error) {
      throw new Error(`Failed to fetch Jira comments: ${error.message}`);
    }
  }

  async fetchUsers() {
    try {
      // Jira Cloud doesn't allow listing all users for privacy reasons
      // We'll return users from recent issues and comments
      const usersMap = new Map();
      
      const issues = await this.fetchIssues();
      
      issues.forEach(issue => {
        if (issue.assignee) {
          usersMap.set(issue.assignee.id, {
            id: issue.assignee.id,
            type: 'user',
            name: issue.assignee.name,
            email: issue.assignee.email,
            avatar: issue.assignee.avatar,
            isActive: true,
            url: `https://${this.host}/jira/people/${issue.assignee.id}`,
            rawData: issue.assignee
          });
        }
        
        if (issue.reporter) {
          usersMap.set(issue.reporter.id, {
            id: issue.reporter.id,
            type: 'user',
            name: issue.reporter.name,
            email: issue.reporter.email,
            avatar: issue.reporter.avatar,
            isActive: true,
            url: `https://${this.host}/jira/people/${issue.reporter.id}`,
            rawData: issue.reporter
          });
        }
      });

      return Array.from(usersMap.values());
    } catch (error) {
      throw new Error(`Failed to fetch Jira users: ${error.message}`);
    }
  }

  async fetchInternalData() {
    try {
      const data = [];
      
      // Example: Fetch internal tasks that should sync to Jira
      // const tasks = await Task.find({ workspaceId: this.workspaceId, syncToJira: true });
      // data.push(...tasks.map(t => ({ ...t.toObject(), type: 'task' })));

      return data;
    } catch (error) {
      this.emitError(error, { operation: 'fetchInternalData' });
      throw error;
    }
  }

  async transformFromExternal(jiraData) {
    switch (jiraData.type) {
      case 'project':
        return this.transformJiraProject(jiraData);
      case 'task':
        return this.transformJiraIssue(jiraData);
      case 'comment':
        return this.transformJiraComment(jiraData);
      case 'user':
        return this.transformJiraUser(jiraData);
      default:
        throw new Error(`Unknown Jira data type: ${jiraData.type}`);
    }
  }

  transformJiraProject(project) {
    return {
      name: project.name,
      key: project.key,
      description: project.description,
      lead: project.lead,
      projectType: project.projectType,
      style: project.style,
      createdAt: project.created,
      externalUrl: project.url,
      platform: 'jira',
      platformId: project.id,
      metadata: {
        jiraData: project.rawData
      }
    };
  }

  transformJiraIssue(issue) {
    return {
      title: issue.summary,
      description: issue.description,
      key: issue.key,
      status: issue.status.name,
      statusCategory: issue.status.category,
      priority: issue.priority?.name || 'Medium',
      issueType: issue.issueType.name,
      isSubtask: issue.issueType.subtask,
      assigneeId: issue.assignee?.id,
      reporterId: issue.reporter?.id,
      labels: issue.labels,
      components: issue.components,
      fixVersions: issue.fixVersions,
      parentId: issue.parent?.id,
      subtasks: issue.subtasks,
      createdAt: issue.created,
      updatedAt: issue.updated,
      resolvedAt: issue.resolved,
      externalUrl: issue.url,
      platform: 'jira',
      platformId: issue.id,
      metadata: {
        jiraData: issue.rawData
      }
    };
  }

  transformJiraComment(comment) {
    return {
      content: comment.content,
      authorId: comment.author?.id,
      issueId: comment.issueId,
      issueKey: comment.issueKey,
      createdAt: comment.created,
      updatedAt: comment.updated,
      externalUrl: comment.url,
      platform: 'jira',
      platformId: comment.id,
      metadata: {
        jiraData: comment.rawData
      }
    };
  }

  transformJiraUser(user) {
    return {
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      isActive: user.isActive,
      externalUrl: user.url,
      platform: 'jira',
      platformId: user.id,
      metadata: {
        jiraData: user.rawData
      }
    };
  }

  async transformToExternal(internalData) {
    switch (internalData.type) {
      case 'task':
        return this.transformTaskToJira(internalData);
      case 'comment':
        return this.transformCommentToJira(internalData);
      default:
        throw new Error(`Cannot transform internal ${internalData.type} to Jira format`);
    }
  }

  transformTaskToJira(task) {
    return {
      fields: {
        project: { key: this.projectKey },
        summary: task.title,
        description: task.description || '',
        issuetype: { name: task.issueType || 'Task' },
        priority: { name: task.priority || 'Medium' },
        assignee: task.assigneeId ? { accountId: task.assigneeId } : null,
        labels: task.labels || []
      }
    };
  }

  transformCommentToJira(comment) {
    return {
      body: comment.content
    };
  }

  async applyToInternal(transformedData, operation, existingId = null) {
    try {
      switch (transformedData.platform) {
        case 'jira':
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
          return await this.createInJira(transformedData);
        case 'update':
          return await this.updateInJira(transformedData, existingId);
        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }
    } catch (error) {
      this.emitError(error, { operation: 'applyToExternal', data: transformedData });
      throw error;
    }
  }

  async createInJira(data) {
    if (!this.projectKey) {
      throw new Error('Jira project key must be configured');
    }

    if (data.fields) {
      // Create issue
      const response = await this.jira.addNewIssue(data);
      
      return {
        id: response.id,
        key: response.key,
        url: `https://${this.host}/browse/${response.key}`
      };
    } else if (data.body && data.issueKey) {
      // Create comment
      const response = await this.jira.addComment(data.issueKey, data.body);
      
      return {
        id: response.id,
        url: `https://${this.host}/browse/${data.issueKey}?focusedCommentId=${response.id}`
      };
    }

    throw new Error('Invalid data for Jira creation');
  }

  async updateInJira(data, existingKey) {
    if (!this.projectKey) {
      throw new Error('Jira project key must be configured');
    }

    if (data.fields && existingKey) {
      // Update issue
      await this.jira.updateIssue(existingKey, data);
      
      return {
        key: existingKey,
        url: `https://${this.host}/browse/${existingKey}`
      };
    } else if (data.body && data.commentId && data.issueKey) {
      // Update comment
      await this.jira.updateComment(data.issueKey, data.commentId, data.body);
      
      return {
        id: data.commentId,
        url: `https://${this.host}/browse/${data.issueKey}?focusedCommentId=${data.commentId}`
      };
    }

    throw new Error('Update not supported for this Jira entity type');
  }

  async setupWebhooks() {
    try {
      const webhookUrl = `${process.env.APP_URL}/api/v1/integrations/webhooks/jira`;
      
      console.log('Jira webhooks must be configured manually in Jira administration');
      console.log(`Webhook URL: ${webhookUrl}`);
      console.log('Events to enable: issue_created, issue_updated, issue_deleted, comment_created, comment_updated');
    } catch (error) {
      console.error('Failed to setup Jira webhooks:', error);
    }
  }

  async refreshAccessToken() {
    // Jira API tokens don't expire
    // For OAuth 2.0, you would implement token refresh here
    throw new Error('Jira token refresh not implemented');
  }
}
