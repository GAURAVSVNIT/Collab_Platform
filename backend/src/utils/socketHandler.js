import jwt from 'jsonwebtoken';
import { User } from '../models/user.model.js';
import { Document } from '../models/document.model.js';

// Store active connections
const activeConnections = new Map();
const documentRooms = new Map();

export const setupSocketIO = (io) => {
  // Authentication middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace("Bearer ", "");
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      const user = await User.findById(decodedToken?._id).select("-password -refreshToken");
      
      if (!user) {
        return next(new Error('Invalid access token'));
      }

      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 User ${socket.user.username} connected: ${socket.id}`);
    
    // Store user connection
    activeConnections.set(socket.user._id.toString(), {
      socketId: socket.id,
      user: socket.user,
      lastSeen: new Date()
    });

    // Join workspace room
    socket.on('join-workspace', (workspaceId) => {
      socket.join(`workspace-${workspaceId}`);
      console.log(`👥 User ${socket.user.username} joined workspace: ${workspaceId}`);
      
      // Notify others in workspace
      socket.to(`workspace-${workspaceId}`).emit('user-joined-workspace', {
        user: socket.user,
        timestamp: new Date()
      });
    });

    // Join document room for real-time editing
    socket.on('join-document', async (data) => {
      const { documentId, workspaceId } = data;
      const roomId = `document-${documentId}`;
      
      try {
        // Verify user has access to this document
        const document = await Document.findById(documentId).populate('workspace');
        if (!document || document.workspace._id.toString() !== workspaceId) {
          socket.emit('error', { message: 'Document not found or access denied' });
          return;
        }

        socket.join(roomId);
        
        // Track document participants
        if (!documentRooms.has(documentId)) {
          documentRooms.set(documentId, new Set());
        }
        documentRooms.get(documentId).add(socket.user._id.toString());

        console.log(`📝 User ${socket.user.username} joined document: ${documentId}`);

        // Send current document content and active users
        const activeUsers = Array.from(documentRooms.get(documentId)).map(userId => {
          const connection = activeConnections.get(userId);
          return connection ? connection.user : null;
        }).filter(Boolean);

        socket.emit('document-joined', {
          document,
          activeUsers,
          timestamp: new Date()
        });

        // Notify others about new collaborator
        socket.to(roomId).emit('user-joined-document', {
          user: socket.user,
          activeUsers,
          timestamp: new Date()
        });

      } catch (error) {
        socket.emit('error', { message: 'Failed to join document' });
      }
    });

    // Handle real-time document updates
    socket.on('document-update', async (data) => {
      const { documentId, operation, content, cursorPosition } = data;
      const roomId = `document-${documentId}`;

      try {
        // Broadcast the update to all other users in the document
        socket.to(roomId).emit('document-operation', {
          operation,
          content,
          cursorPosition,
          user: socket.user,
          timestamp: new Date()
        });

        // Update document in database (debounced save)
        if (operation === 'content-change') {
          await Document.findByIdAndUpdate(documentId, {
            content,
            updatedAt: new Date()
          });
        }

      } catch (error) {
        socket.emit('error', { message: 'Failed to apply document update' });
      }
    });

    // Handle cursor movements
    socket.on('cursor-move', (data) => {
      const { documentId, position, selection } = data;
      const roomId = `document-${documentId}`;

      socket.to(roomId).emit('cursor-update', {
        user: socket.user,
        position,
        selection,
        timestamp: new Date()
      });
    });

    // Handle comments on documents
    socket.on('add-comment', async (data) => {
      const { documentId, content, position } = data;
      const roomId = `document-${documentId}`;

      try {
        const comment = {
          id: new Date().getTime().toString(),
          author: socket.user._id,
          content,
          position,
          timestamp: new Date()
        };

        // Broadcast comment to all users in document
        io.to(roomId).emit('comment-added', {
          comment: {
            ...comment,
            author: socket.user
          }
        });

      } catch (error) {
        socket.emit('error', { message: 'Failed to add comment' });
      }
    });

    // Handle task updates for Kanban boards
    socket.on('task-update', async (data) => {
      const { taskId, workspaceId, update } = data;

      try {
        // Broadcast task update to workspace
        socket.to(`workspace-${workspaceId}`).emit('task-updated', {
          taskId,
          update,
          user: socket.user,
          timestamp: new Date()
        });

      } catch (error) {
        socket.emit('error', { message: 'Failed to update task' });
      }
    });

    // Handle leaving document
    socket.on('leave-document', (documentId) => {
      const roomId = `document-${documentId}`;
      socket.leave(roomId);

      // Remove from document participants
      if (documentRooms.has(documentId)) {
        documentRooms.get(documentId).delete(socket.user._id.toString());
        
        if (documentRooms.get(documentId).size === 0) {
          documentRooms.delete(documentId);
        }
      }

      // Notify others
      socket.to(roomId).emit('user-left-document', {
        user: socket.user,
        timestamp: new Date()
      });

      console.log(`📝 User ${socket.user.username} left document: ${documentId}`);
    });

    // Handle typing indicators
    socket.on('typing-start', (data) => {
      const { documentId } = data;
      const roomId = `document-${documentId}`;
      
      socket.to(roomId).emit('user-typing', {
        user: socket.user,
        timestamp: new Date()
      });
    });

    socket.on('typing-stop', (data) => {
      const { documentId } = data;
      const roomId = `document-${documentId}`;
      
      socket.to(roomId).emit('user-stopped-typing', {
        user: socket.user,
        timestamp: new Date()
      });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`🔌 User ${socket.user.username} disconnected: ${socket.id}`);
      
      // Remove from active connections
      activeConnections.delete(socket.user._id.toString());

      // Remove from all document rooms
      for (const [documentId, participants] of documentRooms.entries()) {
        if (participants.has(socket.user._id.toString())) {
          participants.delete(socket.user._id.toString());
          
          // Notify others in the document
          socket.to(`document-${documentId}`).emit('user-left-document', {
            user: socket.user,
            timestamp: new Date()
          });

          if (participants.size === 0) {
            documentRooms.delete(documentId);
          }
        }
      }

      // Notify workspaces about user going offline
      socket.rooms.forEach(room => {
        if (room.startsWith('workspace-')) {
          socket.to(room).emit('user-left-workspace', {
            user: socket.user,
            timestamp: new Date()
          });
        }
      });
    });

    // Send active user count
    socket.emit('connection-established', {
      user: socket.user,
      activeUsers: activeConnections.size,
      timestamp: new Date()
    });
  });

  // Periodic cleanup of stale connections
  setInterval(() => {
    const now = new Date();
    for (const [userId, connection] of activeConnections.entries()) {
      if (now - connection.lastSeen > 300000) { // 5 minutes
        activeConnections.delete(userId);
      }
    }
  }, 60000); // Check every minute
};
