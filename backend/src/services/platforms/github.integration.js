import { Octokit } from '@octokit/rest';
import { BaseIntegration } from './base.integration.js';

export class GitHubIntegration extends BaseIntegration {
  constructor(integrationConfig) {
    super(integrationConfig);
    this.octokit = null;
    this.owner = integrationConfig.config?.owner;
    this.repo = integrationConfig.config?.repo;
  }

  async setupApiClient() {
    this.octokit = new Octokit({
      auth: this.accessToken,
      userAgent: 'CollabPlatform/1.0.0'
    });
  }

  async validateCredentials() {
    try {
      const response = await this.octokit.rest.users.getAuthenticated();
      if (!response.data) {
        throw new Error('Invalid GitHub credentials');
      }
      
      this.username = response.data.login;
      this.userId = response.data.id;
      
      return response.data;
    } catch (error) {
      throw new Error(`GitHub auth validation failed: ${error.message}`);
    }
  }

  async fetchExternalData() {
    const data = [];
    
    try {
      // Fetch repositories
      if (this.syncSettings.syncTypes.includes('projects')) {
        const repos = await this.fetchRepositories();
        data.push(...repos);
      }

      // Fetch issues
      if (this.syncSettings.syncTypes.includes('tasks')) {
        const issues = await this.fetchIssues();
        data.push(...issues);
      }

      // Fetch pull requests
      if (this.syncSettings.syncTypes.includes('tasks')) {
        const pullRequests = await this.fetchPullRequests();
        data.push(...pullRequests);
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

  async fetchRepositories() {
    try {
      const response = await this.octokit.rest.repos.listForAuthenticatedUser({
        sort: 'updated',
        per_page: 100
      });

      return response.data.map(repo => ({
        id: repo.id.toString(),
        type: 'project',
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description || '',
        isPrivate: repo.private,
        language: repo.language,
        starCount: repo.stargazers_count,
        forkCount: repo.forks_count,
        created: this.normalizeDate(repo.created_at),
        updated: this.normalizeDate(repo.updated_at),
        url: repo.html_url,
        cloneUrl: repo.clone_url,
        owner: {
          id: repo.owner.id.toString(),
          name: repo.owner.login,
          avatar: repo.owner.avatar_url
        },
        rawData: repo
      }));
    } catch (error) {
      throw new Error(`Failed to fetch GitHub repositories: ${error.message}`);
    }
  }

  async fetchIssues() {
    try {
      const issues = [];
      
      if (this.owner && this.repo) {
        const response = await this.octokit.rest.issues.listForRepo({
          owner: this.owner,
          repo: this.repo,
          state: 'all',
          per_page: 100
        });

        issues.push(...response.data
          .filter(issue => !issue.pull_request) // Exclude PRs
          .map(issue => ({
            id: issue.id.toString(),
            type: 'task',
            number: issue.number,
            title: issue.title,
            description: issue.body || '',
            state: issue.state,
            priority: this.extractPriority(issue.labels),
            assignee: issue.assignee ? {
              id: issue.assignee.id.toString(),
              name: issue.assignee.login,
              avatar: issue.assignee.avatar_url
            } : null,
            author: {
              id: issue.user.id.toString(),
              name: issue.user.login,
              avatar: issue.user.avatar_url
            },
            labels: issue.labels.map(label => ({
              name: label.name,
              color: label.color,
              description: label.description
            })),
            milestone: issue.milestone ? {
              id: issue.milestone.id.toString(),
              title: issue.milestone.title,
              dueDate: this.normalizeDate(issue.milestone.due_on)
            } : null,
            created: this.normalizeDate(issue.created_at),
            updated: this.normalizeDate(issue.updated_at),
            closed: this.normalizeDate(issue.closed_at),
            url: issue.html_url,
            repository: {
              owner: this.owner,
              repo: this.repo
            },
            rawData: issue
          })));
      }

      return issues;
    } catch (error) {
      throw new Error(`Failed to fetch GitHub issues: ${error.message}`);
    }
  }

  async fetchPullRequests() {
    try {
      const prs = [];
      
      if (this.owner && this.repo) {
        const response = await this.octokit.rest.pulls.list({
          owner: this.owner,
          repo: this.repo,
          state: 'all',
          per_page: 100
        });

        prs.push(...response.data.map(pr => ({
          id: pr.id.toString(),
          type: 'task',
          subtype: 'pull_request',
          number: pr.number,
          title: pr.title,
          description: pr.body || '',
          state: pr.state,
          mergeable: pr.mergeable,
          merged: pr.merged,
          draft: pr.draft,
          author: {
            id: pr.user.id.toString(),
            name: pr.user.login,
            avatar: pr.user.avatar_url
          },
          assignee: pr.assignee ? {
            id: pr.assignee.id.toString(),
            name: pr.assignee.login,
            avatar: pr.assignee.avatar_url
          } : null,
          reviewers: pr.requested_reviewers?.map(reviewer => ({
            id: reviewer.id.toString(),
            name: reviewer.login,
            avatar: reviewer.avatar_url
          })) || [],
          labels: pr.labels.map(label => ({
            name: label.name,
            color: label.color,
            description: label.description
          })),
          head: {
            ref: pr.head.ref,
            sha: pr.head.sha
          },
          base: {
            ref: pr.base.ref,
            sha: pr.base.sha
          },
          created: this.normalizeDate(pr.created_at),
          updated: this.normalizeDate(pr.updated_at),
          merged: this.normalizeDate(pr.merged_at),
          url: pr.html_url,
          repository: {
            owner: this.owner,
            repo: this.repo
          },
          rawData: pr
        })));
      }

      return prs;
    } catch (error) {
      throw new Error(`Failed to fetch GitHub pull requests: ${error.message}`);
    }
  }

  async fetchComments() {
    try {
      const comments = [];
      
      if (this.owner && this.repo) {
        // Fetch issue comments
        const issueComments = await this.octokit.rest.issues.listCommentsForRepo({
          owner: this.owner,
          repo: this.repo,
          per_page: 100
        });

        comments.push(...issueComments.data.map(comment => ({
          id: comment.id.toString(),
          type: 'comment',
          content: comment.body,
          author: {
            id: comment.user.id.toString(),
            name: comment.user.login,
            avatar: comment.user.avatar_url
          },
          created: this.normalizeDate(comment.created_at),
          updated: this.normalizeDate(comment.updated_at),
          url: comment.html_url,
          issueUrl: comment.issue_url,
          repository: {
            owner: this.owner,
            repo: this.repo
          },
          rawData: comment
        })));
      }

      return comments;
    } catch (error) {
      throw new Error(`Failed to fetch GitHub comments: ${error.message}`);
    }
  }

  extractPriority(labels) {
    const priorityLabels = {
      'priority: low': 'low',
      'priority: medium': 'medium',
      'priority: high': 'high',
      'priority: critical': 'critical',
      'low': 'low',
      'medium': 'medium',
      'high': 'high',
      'critical': 'critical'
    };

    for (const label of labels) {
      const priority = priorityLabels[label.name.toLowerCase()];
      if (priority) return priority;
    }

    return 'medium'; // default
  }

  async fetchInternalData() {
    try {
      const data = [];
      
      // Example: Fetch internal tasks that should sync to GitHub
      // const tasks = await Task.find({ workspaceId: this.workspaceId, syncToGitHub: true });
      // data.push(...tasks.map(t => ({ ...t.toObject(), type: 'task' })));

      return data;
    } catch (error) {
      this.emitError(error, { operation: 'fetchInternalData' });
      throw error;
    }
  }

  async transformFromExternal(githubData) {
    switch (githubData.type) {
      case 'project':
        return this.transformGitHubRepo(githubData);
      case 'task':
        return githubData.subtype === 'pull_request' 
          ? this.transformGitHubPR(githubData)
          : this.transformGitHubIssue(githubData);
      case 'comment':
        return this.transformGitHubComment(githubData);
      default:
        throw new Error(`Unknown GitHub data type: ${githubData.type}`);
    }
  }

  transformGitHubRepo(repo) {
    return {
      name: repo.name,
      description: repo.description,
      isPrivate: repo.isPrivate,
      language: repo.language,
      starCount: repo.starCount,
      forkCount: repo.forkCount,
      createdAt: repo.created,
      updatedAt: repo.updated,
      externalUrl: repo.url,
      cloneUrl: repo.cloneUrl,
      platform: 'github',
      platformId: repo.id,
      owner: repo.owner,
      metadata: {
        githubData: repo.rawData
      }
    };
  }

  transformGitHubIssue(issue) {
    return {
      title: issue.title,
      description: issue.description,
      status: issue.state === 'open' ? 'open' : 'closed',
      priority: issue.priority,
      assigneeId: issue.assignee?.id,
      authorId: issue.author?.id,
      labels: issue.labels,
      milestone: issue.milestone,
      createdAt: issue.created,
      updatedAt: issue.updated,
      closedAt: issue.closed,
      externalUrl: issue.url,
      platform: 'github',
      platformId: issue.id,
      number: issue.number,
      repository: issue.repository,
      metadata: {
        githubData: issue.rawData
      }
    };
  }

  transformGitHubPR(pr) {
    return {
      title: pr.title,
      description: pr.description,
      status: pr.merged ? 'merged' : pr.state,
      priority: 'medium',
      assigneeId: pr.assignee?.id,
      authorId: pr.author?.id,
      reviewers: pr.reviewers,
      labels: pr.labels,
      mergeable: pr.mergeable,
      draft: pr.draft,
      head: pr.head,
      base: pr.base,
      createdAt: pr.created,
      updatedAt: pr.updated,
      mergedAt: pr.merged,
      externalUrl: pr.url,
      platform: 'github',
      platformId: pr.id,
      number: pr.number,
      repository: pr.repository,
      subtype: 'pull_request',
      metadata: {
        githubData: pr.rawData
      }
    };
  }

  transformGitHubComment(comment) {
    return {
      content: comment.content,
      authorId: comment.author?.id,
      createdAt: comment.created,
      updatedAt: comment.updated,
      externalUrl: comment.url,
      platform: 'github',
      platformId: comment.id,
      issueUrl: comment.issueUrl,
      repository: comment.repository,
      metadata: {
        githubData: comment.rawData
      }
    };
  }

  async transformToExternal(internalData) {
    switch (internalData.type) {
      case 'task':
        return this.transformTaskToGitHub(internalData);
      case 'comment':
        return this.transformCommentToGitHub(internalData);
      default:
        throw new Error(`Cannot transform internal ${internalData.type} to GitHub format`);
    }
  }

  transformTaskToGitHub(task) {
    return {
      title: task.title,
      body: task.description || '',
      labels: task.labels?.map(label => label.name) || [],
      assignees: task.assigneeId ? [task.assigneeId] : []
    };
  }

  transformCommentToGitHub(comment) {
    return {
      body: comment.content
    };
  }

  async applyToInternal(transformedData, operation, existingId = null) {
    try {
      switch (transformedData.platform) {
        case 'github':
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
          return await this.createInGitHub(transformedData);
        case 'update':
          return await this.updateInGitHub(transformedData, existingId);
        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }
    } catch (error) {
      this.emitError(error, { operation: 'applyToExternal', data: transformedData });
      throw error;
    }
  }

  async createInGitHub(data) {
    if (!this.owner || !this.repo) {
      throw new Error('GitHub owner and repo must be configured');
    }

    if (data.title && data.body !== undefined) {
      // Create issue
      const response = await this.octokit.rest.issues.create({
        owner: this.owner,
        repo: this.repo,
        title: data.title,
        body: data.body,
        labels: data.labels || [],
        assignees: data.assignees || []
      });

      return {
        id: response.data.id.toString(),
        url: response.data.html_url
      };
    } else if (data.body && data.issueNumber) {
      // Create comment
      const response = await this.octokit.rest.issues.createComment({
        owner: this.owner,
        repo: this.repo,
        issue_number: data.issueNumber,
        body: data.body
      });

      return {
        id: response.data.id.toString(),
        url: response.data.html_url
      };
    }

    throw new Error('Invalid data for GitHub creation');
  }

  async updateInGitHub(data, existingId) {
    if (!this.owner || !this.repo) {
      throw new Error('GitHub owner and repo must be configured');
    }

    if (data.title && data.body !== undefined && data.issueNumber) {
      // Update issue
      const response = await this.octokit.rest.issues.update({
        owner: this.owner,
        repo: this.repo,
        issue_number: data.issueNumber,
        title: data.title,
        body: data.body,
        labels: data.labels || [],
        assignees: data.assignees || []
      });

      return {
        id: response.data.id.toString(),
        url: response.data.html_url
      };
    } else if (data.body && data.commentId) {
      // Update comment
      const response = await this.octokit.rest.issues.updateComment({
        owner: this.owner,
        repo: this.repo,
        comment_id: data.commentId,
        body: data.body
      });

      return {
        id: response.data.id.toString(),
        url: response.data.html_url
      };
    }

    throw new Error('Update not supported for this GitHub entity type');
  }

  async setupWebhooks() {
    try {
      if (!this.owner || !this.repo) {
        console.log('GitHub webhooks require owner and repo configuration');
        return;
      }

      const webhookUrl = `${process.env.APP_URL}/api/v1/integrations/webhooks/github`;
      
      // Check if webhook already exists
      const hooks = await this.octokit.rest.repos.listWebhooks({
        owner: this.owner,
        repo: this.repo
      });

      const existingHook = hooks.data.find(hook => 
        hook.config.url === webhookUrl
      );

      if (!existingHook) {
        await this.octokit.rest.repos.createWebhook({
          owner: this.owner,
          repo: this.repo,
          config: {
            url: webhookUrl,
            content_type: 'json',
            secret: process.env.GITHUB_WEBHOOK_SECRET
          },
          events: ['issues', 'issue_comment', 'pull_request', 'pull_request_review']
        });

        console.log('✅ GitHub webhook created successfully');
      }
    } catch (error) {
      console.error('Failed to setup GitHub webhooks:', error);
    }
  }

  async refreshAccessToken() {
    // GitHub personal access tokens don't expire
    // For GitHub Apps, you would implement token refresh here
    throw new Error('GitHub token refresh not implemented');
  }
}
