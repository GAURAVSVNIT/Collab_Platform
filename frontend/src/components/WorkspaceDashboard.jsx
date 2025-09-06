import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../hooks/useWorkspace';
import { useAuth } from '../hooks/useAuth';
import { Plus, Users, FileText, BarChart3, Settings, Search } from 'lucide-react';
import './WorkspaceDashboard.css';

const WorkspaceDashboard = () => {
    const { workspaces, loading, fetchWorkspaces, joinWorkspace } = useWorkspace();
  const { user } = useAuth();
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const handleWorkspaceSelect = (workspace) => {
    setSelectedWorkspace(workspace);
    joinWorkspace(workspace._id);
  };

  const filteredWorkspaces = workspaces.filter(workspace =>
    workspace.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleBasedDashboard = () => {
    if (!selectedWorkspace) return null;

    const userRole = selectedWorkspace.members.find(
      member => member.user._id === user._id
    )?.role || 'developer';

    switch (userRole) {
      case 'manager':
        return <ManagerDashboard workspace={selectedWorkspace} />;
      case 'developer':
        return <DeveloperDashboard workspace={selectedWorkspace} />;
      case 'designer':
        return <DesignerDashboard workspace={selectedWorkspace} />;
      case 'client':
        return <ClientDashboard workspace={selectedWorkspace} />;
      default:
        return <DefaultDashboard workspace={selectedWorkspace} />;
    }
  };

  if (loading) {
    return (
      <div className="workspace-loading">
        <div className="loading-spinner"></div>
        <p>Loading workspaces...</p>
      </div>
    );
  }

  return (
    <div className="workspace-dashboard">
      <div className="dashboard-sidebar">
        <div className="sidebar-header">
          <h2>Workspaces</h2>
          <button className="create-workspace-btn">
            <Plus size={20} />
          </button>
        </div>
        
        <div className="workspace-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search workspaces..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="workspace-list">
          {filteredWorkspaces.map(workspace => (
            <div
              key={workspace._id}
              className={`workspace-item ${selectedWorkspace?._id === workspace._id ? 'active' : ''}`}
              onClick={() => handleWorkspaceSelect(workspace)}
            >
              <div className="workspace-avatar">
                {workspace.name.charAt(0).toUpperCase()}
              </div>
              <div className="workspace-info">
                <h3>{workspace.name}</h3>
                <p>{workspace.members.length} members</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="dashboard-main">
        {selectedWorkspace ? (
          <>
            <div className="workspace-header">
              <div className="workspace-title">
                <h1>{selectedWorkspace.name}</h1>
                <p>{selectedWorkspace.description}</p>
              </div>
              <div className="workspace-tabs">
                <button
                  className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
                  onClick={() => setActiveTab('overview')}
                >
                  <BarChart3 size={16} />
                  Overview
                </button>
                <button
                  className={`tab ${activeTab === 'documents' ? 'active' : ''}`}
                  onClick={() => setActiveTab('documents')}
                >
                  <FileText size={16} />
                  Documents
                </button>
                <button
                  className={`tab ${activeTab === 'projects' ? 'active' : ''}`}
                  onClick={() => setActiveTab('projects')}
                >
                  <Users size={16} />
                  Projects
                </button>
                <button
                  className={`tab ${activeTab === 'settings' ? 'active' : ''}`}
                  onClick={() => setActiveTab('settings')}
                >
                  <Settings size={16} />
                  Settings
                </button>
              </div>
            </div>

            <div className="workspace-content">
              {activeTab === 'overview' && getRoleBasedDashboard()}
              {activeTab === 'documents' && <DocumentsTab workspace={selectedWorkspace} />}
              {activeTab === 'projects' && <ProjectsTab workspace={selectedWorkspace} />}
              {activeTab === 'settings' && <SettingsTab workspace={selectedWorkspace} />}
            </div>
          </>
        ) : (
          <div className="no-workspace-selected">
            <div className="empty-state">
              <div className="empty-icon">
                <Users size={48} />
              </div>
              <h2>Select a workspace to get started</h2>
              <p>Choose a workspace from the sidebar or create a new one to begin collaborating.</p>
              <button className="create-workspace-btn primary">
                <Plus size={20} />
                Create New Workspace
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Role-based dashboard components
const ManagerDashboard = ({ workspace }) => (
  <div className="manager-dashboard">
    <div className="dashboard-grid">
      <div className="dashboard-card metrics">
        <h3>Team Metrics</h3>
        <div className="metrics-grid">
          <div className="metric">
            <span className="metric-value">{workspace.members.length}</span>
            <span className="metric-label">Team Members</span>
          </div>
          <div className="metric">
            <span className="metric-value">12</span>
            <span className="metric-label">Active Projects</span>
          </div>
          <div className="metric">
            <span className="metric-value">85%</span>
            <span className="metric-label">Completion Rate</span>
          </div>
        </div>
      </div>
      <div className="dashboard-card">
        <h3>Project Timeline</h3>
        <p>Gantt chart view of all projects</p>
      </div>
      <div className="dashboard-card">
        <h3>Resource Allocation</h3>
        <p>Team workload and capacity planning</p>
      </div>
      <div className="dashboard-card">
        <h3>Budget Overview</h3>
        <p>Financial tracking across projects</p>
      </div>
    </div>
  </div>
);

const DeveloperDashboard = () => (
  <div className="developer-dashboard">
    <div className="dashboard-grid">
      <div className="dashboard-card">
        <h3>My Tasks</h3>
        <p>Current sprint tasks and assignments</p>
      </div>
      <div className="dashboard-card">
        <h3>Code Reviews</h3>
        <p>Pending reviews and pull requests</p>
      </div>
      <div className="dashboard-card">
        <h3>Recent Documents</h3>
        <p>Technical specs and documentation</p>
      </div>
      <div className="dashboard-card">
        <h3>Burndown Chart</h3>
        <p>Sprint progress visualization</p>
      </div>
    </div>
  </div>
);

const DesignerDashboard = () => (
  <div className="designer-dashboard">
    <div className="dashboard-grid">
      <div className="dashboard-card">
        <h3>Design Tasks</h3>
        <p>UI/UX assignments and mockups</p>
      </div>
      <div className="dashboard-card">
        <h3>Asset Library</h3>
        <p>Shared design resources</p>
      </div>
      <div className="dashboard-card">
        <h3>Feedback</h3>
        <p>Client comments and revisions</p>
      </div>
      <div className="dashboard-card">
        <h3>Design System</h3>
        <p>Components and style guide</p>
      </div>
    </div>
  </div>
);

const ClientDashboard = () => (
  <div className="client-dashboard">
    <div className="dashboard-grid">
      <div className="dashboard-card">
        <h3>Project Status</h3>
        <p>Overall progress and milestones</p>
      </div>
      <div className="dashboard-card">
        <h3>Deliverables</h3>
        <p>Completed work and previews</p>
      </div>
      <div className="dashboard-card">
        <h3>Communications</h3>
        <p>Messages and updates from team</p>
      </div>
      <div className="dashboard-card">
        <h3>Invoices</h3>
        <p>Billing and payment information</p>
      </div>
    </div>
  </div>
);

const DefaultDashboard = () => (
  <div className="default-dashboard">
    <div className="dashboard-grid">
      <div className="dashboard-card">
        <h3>Recent Activity</h3>
        <p>Latest updates in the workspace</p>
      </div>
      <div className="dashboard-card">
        <h3>Quick Actions</h3>
        <p>Common tasks and shortcuts</p>
      </div>
    </div>
  </div>
);

// Tab components
const DocumentsTab = () => (
  <div className="documents-tab">
    <div className="tab-header">
      <h2>Documents</h2>
      <button className="create-btn">
        <Plus size={16} />
        New Document
      </button>
    </div>
    <div className="documents-grid">
      {/* Document list will go here */}
      <p>Real-time collaborative documents coming soon...</p>
    </div>
  </div>
);

const ProjectsTab = () => (
  <div className="projects-tab">
    <div className="tab-header">
      <h2>Projects</h2>
      <button className="create-btn">
        <Plus size={16} />
        New Project
      </button>
    </div>
    <div className="projects-grid">
      {/* Project kanban board will go here */}
      <p>Kanban boards and project management coming soon...</p>
    </div>
  </div>
);

const SettingsTab = () => (
  <div className="settings-tab">
    <h2>Workspace Settings</h2>
    <div className="settings-sections">
      <div className="settings-section">
        <h3>General</h3>
        <p>Basic workspace information</p>
      </div>
      <div className="settings-section">
        <h3>Members</h3>
        <p>Manage team members and permissions</p>
      </div>
      <div className="settings-section">
        <h3>Integrations</h3>
        <p>Connect external tools</p>
      </div>
    </div>
  </div>
);

export default WorkspaceDashboard;
