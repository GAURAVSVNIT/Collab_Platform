import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { WorkspaceProvider } from './contexts/WorkspaceContext.jsx';
import LoginPage from './pages/SimpleLoginPage';
import SignupPage from './pages/SimpleSignupPage';
import DashboardPage from './pages/DashboardPage';
import WorkspaceDashboard from './components/WorkspaceDashboard';
import DocumentEditor from './components/DocumentEditor';
import KanbanBoard from './components/KanbanBoard';
import GanttChart from './components/GanttChart';
import Meet from './pages/meet';
import ProtectedRoute from './components/ProtectedRoute';
// import './App.css';

function App() {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <Router>
          <div className="App">
            <Routes>
              <Route path="/" element={<Navigate to="/workspaces" replace />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              
              {/* Legacy dashboard for backward compatibility */}
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                } 
              />
              
              {/* New Unified Workspace Routes */}
              <Route 
                path="/workspaces" 
                element={
                  <ProtectedRoute>
                    <WorkspaceDashboard />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/workspaces/:workspaceId" 
                element={
                  <ProtectedRoute>
                    <WorkspaceDashboard />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/workspaces/:workspaceId/documents/:documentId" 
                element={
                  <ProtectedRoute>
                    <DocumentEditor />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/workspaces/:workspaceId/projects/:projectId/kanban" 
                element={
                  <ProtectedRoute>
                    <KanbanBoard />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/workspaces/:workspaceId/projects/:projectId/gantt" 
                element={
                  <ProtectedRoute>
                    <GanttChart />
                  </ProtectedRoute>
                } 
              />
              
              <Route path="*" element={<Navigate to="/workspaces" replace />} />
            </Routes>
          </div>
        </Router>
      </WorkspaceProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/meet" 
              element={
                  <Meet />
              } 
            />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
