import React, { createContext, useReducer, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../hooks/useAuth';

const WorkspaceContext = createContext();

// Workspace reducer
const workspaceReducer = (state, action) => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    
    case 'SET_WORKSPACES':
      return { ...state, workspaces: action.payload, loading: false };
    
    case 'SET_CURRENT_WORKSPACE':
      return { ...state, currentWorkspace: action.payload };
    
    case 'ADD_WORKSPACE':
      return { 
        ...state, 
        workspaces: [...state.workspaces, action.payload] 
      };
    
    case 'UPDATE_WORKSPACE':
      return {
        ...state,
        workspaces: state.workspaces.map(ws => 
          ws._id === action.payload._id ? action.payload : ws
        ),
        currentWorkspace: state.currentWorkspace?._id === action.payload._id 
          ? action.payload 
          : state.currentWorkspace
      };
    
    case 'REMOVE_WORKSPACE':
      return {
        ...state,
        workspaces: state.workspaces.filter(ws => ws._id !== action.payload),
        currentWorkspace: state.currentWorkspace?._id === action.payload 
          ? null 
          : state.currentWorkspace
      };
    
    case 'SET_SOCKET':
      return { ...state, socket: action.payload };
    
    case 'SET_ONLINE_USERS':
      return { ...state, onlineUsers: action.payload };
    
    case 'USER_JOINED':
      return {
        ...state,
        onlineUsers: [...state.onlineUsers.filter(u => u._id !== action.payload._id), action.payload]
      };
    
    case 'USER_LEFT':
      return {
        ...state,
        onlineUsers: state.onlineUsers.filter(u => u._id !== action.payload._id)
      };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    
    default:
      return state;
  }
};

const initialState = {
  workspaces: [],
  currentWorkspace: null,
  socket: null,
  onlineUsers: [],
  loading: false,
  error: null
};

export const WorkspaceProvider = ({ children }) => {
  const [state, dispatch] = useReducer(workspaceReducer, initialState);
  const { user, token } = useAuth();

  // Initialize socket connection
  useEffect(() => {
    if (user && token) {
      const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:8000', {
        auth: {
          token: token
        }
      });

      socket.on('connect', () => {
        console.log('Connected to workspace server');
        dispatch({ type: 'SET_SOCKET', payload: socket });
      });

      socket.on('connection-established', (data) => {
        console.log('Workspace connection established', data);
      });

      socket.on('user-joined-workspace', (data) => {
        dispatch({ type: 'USER_JOINED', payload: data.user });
      });

      socket.on('user-left-workspace', (data) => {
        dispatch({ type: 'USER_LEFT', payload: data.user });
      });

      socket.on('error', (error) => {
        console.error('Workspace socket error:', error);
        dispatch({ type: 'SET_ERROR', payload: error.message });
      });

      socket.on('disconnect', () => {
        console.log('Disconnected from workspace server');
        dispatch({ type: 'SET_SOCKET', payload: null });
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [user, token]);

  // API functions - memoized to prevent infinite re-renders
  const fetchWorkspaces = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const response = await fetch('/api/v1/workspaces', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch workspaces');
      }

      const data = await response.json();
      dispatch({ type: 'SET_WORKSPACES', payload: data.data });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    }
  }, [token]);

  const createWorkspace = useCallback(async (workspaceData) => {
    try {
      const response = await fetch('/api/v1/workspaces', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(workspaceData)
      });

      if (!response.ok) {
        throw new Error('Failed to create workspace');
      }

      const data = await response.json();
      dispatch({ type: 'ADD_WORKSPACE', payload: data.data });
      return data.data;
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      throw error;
    }
  }, [token]);

  const updateWorkspace = useCallback(async (workspaceId, updates) => {
    try {
      const response = await fetch(`/api/v1/workspaces/${workspaceId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        throw new Error('Failed to update workspace');
      }

      const data = await response.json();
      dispatch({ type: 'UPDATE_WORKSPACE', payload: data.data });
      return data.data;
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      throw error;
    }
  }, [token]);

  const deleteWorkspace = useCallback(async (workspaceId) => {
    try {
      const response = await fetch(`/api/v1/workspaces/${workspaceId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete workspace');
      }

      dispatch({ type: 'REMOVE_WORKSPACE', payload: workspaceId });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      throw error;
    }
  }, [token]);

  const inviteToWorkspace = useCallback(async (workspaceId, email, role) => {
    try {
      const response = await fetch(`/api/v1/workspaces/${workspaceId}/invite`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, role })
      });

      if (!response.ok) {
        throw new Error('Failed to invite user');
      }

      const data = await response.json();
      dispatch({ type: 'UPDATE_WORKSPACE', payload: data.data });
      return data.data;
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      throw error;
    }
  }, [token]);

  const joinWorkspace = useCallback((workspaceId) => {
    if (state.socket) {
      state.socket.emit('join-workspace', workspaceId);
      dispatch({ type: 'SET_CURRENT_WORKSPACE', payload: state.workspaces.find(ws => ws._id === workspaceId) });
    }
  }, [state.socket, state.workspaces]);

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  const value = {
    ...state,
    fetchWorkspaces,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    inviteToWorkspace,
    joinWorkspace,
    clearError
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
};

export { WorkspaceContext };
