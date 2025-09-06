import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWorkspace } from '../hooks/useWorkspace';
import { ArrowLeft, Share2, Users, MessageCircle } from 'lucide-react';
import './DocumentEditor.css';

const DocumentEditor = () => {
  const { workspaceId, documentId } = useParams();
  const navigate = useNavigate();
  const { socket } = useWorkspace();
  const [document, setDocument] = useState(null);
  const [content, setContent] = useState('');
  const [activeUsers, setActiveUsers] = useState([]);
  const [comments, setComments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (socket && documentId) {
      // Join document room
      socket.emit('join-document', { documentId, workspaceId });

      // Listen for document events
      socket.on('document-joined', (data) => {
        setDocument(data.document);
        setContent(data.document.content || '');
        setActiveUsers(data.activeUsers);
        setIsLoading(false);
      });

      socket.on('document-operation', (data) => {
        if (data.operation === 'content-change') {
          setContent(data.content);
        }
      });

      socket.on('user-joined-document', (data) => {
        setActiveUsers(data.activeUsers);
      });

      socket.on('user-left-document', (data) => {
        setActiveUsers(prev => prev.filter(user => user._id !== data.user._id));
      });

      socket.on('comment-added', (data) => {
        setComments(prev => [...prev, data.comment]);
      });

      return () => {
        socket.emit('leave-document', documentId);
        socket.off('document-joined');
        socket.off('document-operation');
        socket.off('user-joined-document');
        socket.off('user-left-document');
        socket.off('comment-added');
      };
    }
  }, [socket, documentId, workspaceId]);

  const handleContentChange = (newContent) => {
    setContent(newContent);
    
    if (socket) {
      socket.emit('document-update', {
        documentId,
        operation: 'content-change',
        content: newContent
      });
    }
  };

  const handleBack = () => {
    navigate(`/workspaces/${workspaceId}`);
  };

  if (isLoading) {
    return (
      <div className="document-loading">
        <div className="loading-spinner"></div>
        <p>Loading document...</p>
      </div>
    );
  }

  return (
    <div className="document-editor">
      <div className="document-header">
        <div className="header-left">
          <button onClick={handleBack} className="back-btn">
            <ArrowLeft size={20} />
          </button>
          <div className="document-info">
            <h1>{document?.title || 'Untitled Document'}</h1>
            <span className="document-status">{document?.status || 'draft'}</span>
          </div>
        </div>
        
        <div className="header-right">
          <div className="active-users">
            <Users size={16} />
            <span>{activeUsers.length} active</span>
            <div className="user-avatars">
              {activeUsers.slice(0, 3).map(user => (
                <div key={user._id} className="user-avatar" title={user.fullName}>
                  {user.fullName?.charAt(0).toUpperCase()}
                </div>
              ))}
              {activeUsers.length > 3 && (
                <div className="user-avatar more">+{activeUsers.length - 3}</div>
              )}
            </div>
          </div>
          
          <button className="share-btn">
            <Share2 size={16} />
            Share
          </button>
          
          <button className="comments-btn">
            <MessageCircle size={16} />
            Comments ({comments.length})
          </button>
        </div>
      </div>

      <div className="document-body">
        <div className="document-content">
          <div className="editor-toolbar">
            <div className="format-buttons">
              <button className="format-btn">B</button>
              <button className="format-btn">I</button>
              <button className="format-btn">U</button>
              <div className="divider"></div>
              <button className="format-btn">H1</button>
              <button className="format-btn">H2</button>
              <button className="format-btn">H3</button>
              <div className="divider"></div>
              <button className="format-btn">•</button>
              <button className="format-btn">1.</button>
            </div>
          </div>
          
          <div className="editor">
            <textarea
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder="Start writing your document..."
              className="content-editor"
            />
          </div>
        </div>

        <div className="document-sidebar">
          <div className="sidebar-section">
            <h3>Comments</h3>
            <div className="comments-list">
              {comments.length === 0 ? (
                <p className="no-comments">No comments yet</p>
              ) : (
                comments.map(comment => (
                  <div key={comment.id} className="comment">
                    <div className="comment-author">
                      {comment.author.fullName}
                    </div>
                    <div className="comment-content">
                      {comment.content}
                    </div>
                    <div className="comment-time">
                      {new Date(comment.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="sidebar-section">
            <h3>Document Info</h3>
            <div className="document-meta">
              <div className="meta-item">
                <span className="meta-label">Created:</span>
                <span className="meta-value">
                  {document?.createdAt ? new Date(document.createdAt).toLocaleDateString() : 'Unknown'}
                </span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Modified:</span>
                <span className="meta-value">
                  {document?.updatedAt ? new Date(document.updatedAt).toLocaleDateString() : 'Unknown'}
                </span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Author:</span>
                <span className="meta-value">
                  {document?.author?.fullName || 'Unknown'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentEditor;
