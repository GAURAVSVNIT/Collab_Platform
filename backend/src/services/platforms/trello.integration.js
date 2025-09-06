import Trello from 'trello';
import { BaseIntegration } from './base.integration.js';

export class TrelloIntegration extends BaseIntegration {
  constructor(integrationConfig) {
    super(integrationConfig);
    this.trello = null;
    this.key = integrationConfig.config?.key;
    this.token = integrationConfig.accessToken;
  }

  async setupApiClient() {
    this.trello = new Trello(this.key, this.token);
  }

  async validateCredentials() {
    try {
      const member = await this.trello.makeRequest('get', '/1/members/me');
      if (!member) {
        throw new Error('Invalid Trello credentials');
      }
      
      this.memberId = member.id;
      this.memberName = member.fullName;
      
      return member;
    } catch (error) {
      throw new Error(`Trello auth validation failed: ${error.message}`);
    }
  }

  async fetchExternalData() {
    const data = [];
    
    try {
      // Fetch boards
      if (this.syncSettings.syncTypes.includes('projects')) {
        const boards = await this.fetchBoards();
        data.push(...boards);
      }

      // Fetch cards (tasks)
      if (this.syncSettings.syncTypes.includes('tasks')) {
        const cards = await this.fetchCards();
        data.push(...cards);
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

  async fetchBoards() {
    try {
      const boards = await this.trello.makeRequest('get', '/1/members/me/boards', {
        filter: 'open',
        fields: 'all',
        lists: 'open',
        list_fields: 'all'
      });

      return boards.map(board => ({
        id: board.id,
        type: 'project',
        name: board.name,
        description: board.desc || '',
        isPrivate: !board.prefs.permissionLevel === 'public',
        closed: board.closed,
        url: board.url,
        shortUrl: board.shortUrl,
        organization: board.idOrganization ? {
          id: board.idOrganization,
          name: board.organization?.displayName
        } : null,
        lists: board.lists?.map(list => ({
          id: list.id,
          name: list.name,
          pos: list.pos,
          closed: list.closed
        })) || [],
        labelNames: board.labelNames || {},
        created: this.normalizeDate(board.dateLastActivity),
        rawData: board
      }));
    } catch (error) {
      throw new Error(`Failed to fetch Trello boards: ${error.message}`);
    }
  }

  async fetchCards() {
    try {
      const boards = await this.fetchBoards();
      const cards = [];

      for (const board of boards.slice(0, 10)) { // Limit to avoid rate limits
        try {
          const boardCards = await this.trello.makeRequest('get', `/1/boards/${board.id}/cards`, {
            fields: 'all',
            members: 'true',
            member_fields: 'all',
            checklists: 'all',
            attachments: 'true',
            actions: 'commentCard'
          });

          const transformedCards = boardCards.map(card => ({
            id: card.id,
            type: 'task',
            name: card.name,
            description: card.desc || '',
            pos: card.pos,
            closed: card.closed,
            dueDate: this.normalizeDate(card.due),
            dueComplete: card.dueComplete,
            boardId: board.id,
            boardName: board.name,
            listId: card.idList,
            listName: board.lists?.find(l => l.id === card.idList)?.name || 'Unknown',
            members: card.members?.map(member => ({
              id: member.id,
              name: member.fullName,
              username: member.username,
              avatar: member.avatarUrl
            })) || [],
            labels: card.labels?.map(label => ({
              id: label.id,
              name: label.name,
              color: label.color
            })) || [],
            checklists: card.checklists?.map(checklist => ({
              id: checklist.id,
              name: checklist.name,
              checkItems: checklist.checkItems?.map(item => ({
                id: item.id,
                name: item.name,
                state: item.state,
                pos: item.pos
              })) || []
            })) || [],
            attachments: card.attachments?.map(attachment => ({
              id: attachment.id,
              name: attachment.name,
              url: attachment.url,
              mimeType: attachment.mimeType,
              bytes: attachment.bytes
            })) || [],
            created: this.normalizeDate(card.dateLastActivity),
            url: card.url,
            shortUrl: card.shortUrl,
            rawData: card
          }));

          cards.push(...transformedCards);
        } catch (boardError) {
          console.warn(`Failed to fetch cards for board ${board.name}:`, boardError.message);
        }
      }

      return cards;
    } catch (error) {
      throw new Error(`Failed to fetch Trello cards: ${error.message}`);
    }
  }

  async fetchComments() {
    try {
      const cards = await this.fetchCards();
      const comments = [];

      for (const card of cards.slice(0, 20)) { // Limit to avoid rate limits
        try {
          const actions = await this.trello.makeRequest('get', `/1/cards/${card.id}/actions`, {
            filter: 'commentCard',
            fields: 'all',
            memberCreator: 'true',
            memberCreator_fields: 'all'
          });

          const cardComments = actions.map(action => ({
            id: action.id,
            type: 'comment',
            content: action.data.text,
            cardId: card.id,
            cardName: card.name,
            author: {
              id: action.memberCreator.id,
              name: action.memberCreator.fullName,
              username: action.memberCreator.username,
              avatar: action.memberCreator.avatarUrl
            },
            created: this.normalizeDate(action.date),
            url: card.url,
            rawData: action
          }));

          comments.push(...cardComments);
        } catch (cardError) {
          console.warn(`Failed to fetch comments for card ${card.name}:`, cardError.message);
        }
      }

      return comments;
    } catch (error) {
      throw new Error(`Failed to fetch Trello comments: ${error.message}`);
    }
  }

  async fetchInternalData() {
    try {
      const data = [];
      
      // Example: Fetch internal tasks that should sync to Trello
      // const tasks = await Task.find({ workspaceId: this.workspaceId, syncToTrello: true });
      // data.push(...tasks.map(t => ({ ...t.toObject(), type: 'task' })));

      return data;
    } catch (error) {
      this.emitError(error, { operation: 'fetchInternalData' });
      throw error;
    }
  }

  async transformFromExternal(trelloData) {
    switch (trelloData.type) {
      case 'project':
        return this.transformTrelloBoard(trelloData);
      case 'task':
        return this.transformTrelloCard(trelloData);
      case 'comment':
        return this.transformTrelloComment(trelloData);
      default:
        throw new Error(`Unknown Trello data type: ${trelloData.type}`);
    }
  }

  transformTrelloBoard(board) {
    return {
      name: board.name,
      description: board.description,
      isPrivate: board.isPrivate,
      closed: board.closed,
      lists: board.lists,
      labelNames: board.labelNames,
      organizationId: board.organization?.id,
      createdAt: board.created,
      externalUrl: board.url,
      shortUrl: board.shortUrl,
      platform: 'trello',
      platformId: board.id,
      metadata: {
        trelloData: board.rawData
      }
    };
  }

  transformTrelloCard(card) {
    return {
      title: card.name,
      description: card.description,
      position: card.pos,
      closed: card.closed,
      dueDate: card.dueDate,
      dueComplete: card.dueComplete,
      boardId: card.boardId,
      boardName: card.boardName,
      listId: card.listId,
      listName: card.listName,
      members: card.members,
      labels: card.labels,
      checklists: card.checklists,
      attachments: card.attachments,
      createdAt: card.created,
      externalUrl: card.url,
      shortUrl: card.shortUrl,
      platform: 'trello',
      platformId: card.id,
      metadata: {
        trelloData: card.rawData
      }
    };
  }

  transformTrelloComment(comment) {
    return {
      content: comment.content,
      cardId: comment.cardId,
      cardName: comment.cardName,
      authorId: comment.author?.id,
      authorName: comment.author?.name,
      createdAt: comment.created,
      externalUrl: comment.url,
      platform: 'trello',
      platformId: comment.id,
      metadata: {
        trelloData: comment.rawData
      }
    };
  }

  async transformToExternal(internalData) {
    switch (internalData.type) {
      case 'project':
        return this.transformProjectToTrello(internalData);
      case 'task':
        return this.transformTaskToTrello(internalData);
      case 'comment':
        return this.transformCommentToTrello(internalData);
      default:
        throw new Error(`Cannot transform internal ${internalData.type} to Trello format`);
    }
  }

  transformProjectToTrello(project) {
    return {
      name: project.name,
      desc: project.description || '',
      prefs_permissionLevel: project.isPrivate ? 'private' : 'org'
    };
  }

  transformTaskToTrello(task) {
    return {
      name: task.title,
      desc: task.description || '',
      pos: task.position || 'bottom',
      due: task.dueDate ? new Date(task.dueDate).toISOString() : null,
      idList: task.listId
    };
  }

  transformCommentToTrello(comment) {
    return {
      text: comment.content
    };
  }

  async applyToInternal(transformedData, operation, existingId = null) {
    try {
      switch (transformedData.platform) {
        case 'trello':
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
          return await this.createInTrello(transformedData);
        case 'update':
          return await this.updateInTrello(transformedData, existingId);
        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }
    } catch (error) {
      this.emitError(error, { operation: 'applyToExternal', data: transformedData });
      throw error;
    }
  }

  async createInTrello(data) {
    if (data.name && !data.idList) {
      // Create board
      const response = await this.trello.makeRequest('post', '/1/boards', data);
      
      return {
        id: response.id,
        url: response.url
      };
    } else if (data.name && data.idList) {
      // Create card
      const response = await this.trello.makeRequest('post', '/1/cards', data);
      
      return {
        id: response.id,
        url: response.url
      };
    } else if (data.text && data.cardId) {
      // Create comment
      const response = await this.trello.makeRequest('post', `/1/cards/${data.cardId}/actions/comments`, {
        text: data.text
      });
      
      return {
        id: response.id,
        url: response.data?.card?.url || ''
      };
    }

    throw new Error('Invalid data for Trello creation');
  }

  async updateInTrello(data, existingId) {
    if (data.name && data.idList) {
      // Update card
      const response = await this.trello.makeRequest('put', `/1/cards/${existingId}`, data);
      
      return {
        id: response.id,
        url: response.url
      };
    } else if (data.name && !data.idList) {
      // Update board
      const response = await this.trello.makeRequest('put', `/1/boards/${existingId}`, data);
      
      return {
        id: response.id,
        url: response.url
      };
    }

    throw new Error('Update not supported for this Trello entity type');
  }

  async setupWebhooks() {
    try {
      const webhookUrl = `${process.env.APP_URL}/api/v1/integrations/webhooks/trello`;
      
      // Create webhooks for each board
      const boards = await this.fetchBoards();
      
      for (const board of boards.slice(0, 5)) { // Limit webhook creation
        try {
          await this.trello.makeRequest('post', '/1/webhooks', {
            description: `CollabPlatform webhook for ${board.name}`,
            callbackURL: webhookUrl,
            idModel: board.id
          });
          
          console.log(`✅ Trello webhook created for board: ${board.name}`);
        } catch (webhookError) {
          console.warn(`Failed to create webhook for board ${board.name}:`, webhookError.message);
        }
      }
    } catch (error) {
      console.error('Failed to setup Trello webhooks:', error);
    }
  }

  async refreshAccessToken() {
    // Trello tokens don't expire
    throw new Error('Trello token refresh not implemented');
  }
}
