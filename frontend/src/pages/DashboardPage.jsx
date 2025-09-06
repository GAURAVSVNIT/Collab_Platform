import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import './DashboardPage.css';

const DashboardPage = () => {
  const { user, logout, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>Welcome to Collab Platform</h1>
          <div className="user-info">
            <div className="user-avatar">
              {user.avatar ? (
                <img 
                  src={user.avatar} 
                  alt={user.fullName}
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div 
                className="avatar-fallback"
                style={{
                  display: user.avatar ? 'none' : 'flex',
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: '#667eea',
                  color: 'white',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  fontWeight: 'bold'
                }}
              >
                {user.fullName?.charAt(0).toUpperCase() || 'U'}
              </div>
            </div>
            <div className="user-details">
              <h3>{user.fullName}</h3>
              <p>@{user.username}</p>
            </div>
            <button onClick={handleLogout} className="logout-button">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-content">
          <div className="welcome-section">
            <h2>Hello, {user.fullName}!</h2>
            <p>Welcome to your collaboration dashboard. Here you can manage your projects, collaborate with team members, and track your progress.</p>
          </div>

          <div className="dashboard-grid">
            <div className="dashboard-card">
              <div className="card-icon">📊</div>
              <h3>Analytics</h3>
              <p>View your project analytics and performance metrics.</p>
              <button className="card-button">View Analytics</button>
            </div>

            <div className="dashboard-card">
              <div className="card-icon">👥</div>
              <h3>Team</h3>
              <p>Manage your team members and collaboration settings.</p>
              <button className="card-button">Manage Team</button>
            </div>

            <div className="dashboard-card">
              <div className="card-icon">📁</div>
              <h3>Projects</h3>
              <p>Create and manage your collaboration projects.</p>
              <button className="card-button">View Projects</button>
            </div>

            <div className="dashboard-card">
              <div className="card-icon">⚙️</div>
              <h3>Settings</h3>
              <p>Update your account settings and preferences.</p>
              <button className="card-button">Open Settings</button>
            </div>
          </div>

          <div className="recent-activity">
            <h3>Recent Activity</h3>
            <div className="activity-list">
              <div className="activity-item">
                <div className="activity-icon">✅</div>
                <div className="activity-content">
                  <p>Account created successfully</p>
                  <span className="activity-time">Just now</span>
                </div>
              </div>
              <div className="activity-item">
                <div className="activity-icon">🔐</div>
                <div className="activity-content">
                  <p>Logged in to your account</p>
                  <span className="activity-time">Just now</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;
