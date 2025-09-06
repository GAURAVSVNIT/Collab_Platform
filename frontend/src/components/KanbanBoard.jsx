import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Filter, Search } from 'lucide-react';
import './KanbanBoard.css';

const KanbanBoard = () => {
  const { workspaceId, projectId } = useParams();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [columns] = useState([
    { id: 'backlog', title: 'Backlog', color: '#6b7280' },
    { id: 'todo', title: 'To Do', color: '#3b82f6' },
    { id: 'in-progress', title: 'In Progress', color: '#f59e0b' },
    { id: 'review', title: 'Review', color: '#8b5cf6' },
    { id: 'testing', title: 'Testing', color: '#06b6d4' },
    { id: 'done', title: 'Done', color: '#10b981' }
  ]);

  useEffect(() => {
    // Fetch tasks for this project
    fetchTasks();
  }, [projectId]);

  const fetchTasks = async () => {
    // TODO: Implement API call to fetch tasks
    // For now, using mock data
    const mockTasks = [
      {
        id: '1',
        title: 'Design user interface mockups',
        description: 'Create wireframes and mockups for the main dashboard',
        status: 'in-progress',
        priority: 'high',
        assignee: 'John Doe',
        storyPoints: 8,
        labels: ['design', 'ui']
      },
      {
        id: '2',
        title: 'Implement authentication system',
        description: 'Set up JWT-based authentication with refresh tokens',
        status: 'todo',
        priority: 'high',
        assignee: 'Jane Smith',
        storyPoints: 13,
        labels: ['backend', 'security']
      },
      {
        id: '3',
        title: 'Write unit tests',
        description: 'Add comprehensive test coverage for user management',
        status: 'backlog',
        priority: 'medium',
        assignee: 'Mike Johnson',
        storyPoints: 5,
        labels: ['testing']
      }
    ];
    setTasks(mockTasks);
  };

  const handleBack = () => {
    navigate(`/workspaces/${workspaceId}`);
  };

  const getTasksByStatus = (status) => {
    return tasks.filter(task => task.status === status);
  };

  const getPriorityColor = (priority) => {
    const colors = {
      lowest: '#10b981',
      low: '#3b82f6',
      medium: '#f59e0b',
      high: '#ef4444',
      highest: '#dc2626'
    };
    return colors[priority] || '#6b7280';
  };

  return (
    <div className="kanban-board">
      <div className="kanban-header">
        <div className="header-left">
          <button onClick={handleBack} className="back-btn">
            <ArrowLeft size={20} />
          </button>
          <div className="project-info">
            <h1>Project Kanban Board</h1>
            <p>Manage tasks and track progress</p>
          </div>
        </div>
        
        <div className="header-right">
          <div className="search-box">
            <Search size={16} />
            <input type="text" placeholder="Search tasks..." />
          </div>
          <button className="filter-btn">
            <Filter size={16} />
            Filter
          </button>
          <button className="add-task-btn">
            <Plus size={16} />
            Add Task
          </button>
        </div>
      </div>

      <div className="kanban-content">
        <div className="kanban-columns">
          {columns.map(column => (
            <div key={column.id} className="kanban-column">
              <div className="column-header">
                <div className="column-title">
                  <div 
                    className="column-indicator" 
                    style={{ backgroundColor: column.color }}
                  ></div>
                  <h3>{column.title}</h3>
                  <span className="task-count">
                    {getTasksByStatus(column.id).length}
                  </span>
                </div>
                <button className="add-column-task">
                  <Plus size={16} />
                </button>
              </div>
              
              <div className="column-tasks">
                {getTasksByStatus(column.id).map(task => (
                  <div key={task.id} className="task-card">
                    <div className="task-header">
                      <div className="task-labels">
                        {task.labels.map(label => (
                          <span key={label} className="task-label">
                            {label}
                          </span>
                        ))}
                      </div>
                      <div 
                        className="task-priority"
                        style={{ backgroundColor: getPriorityColor(task.priority) }}
                        title={`Priority: ${task.priority}`}
                      ></div>
                    </div>
                    
                    <h4 className="task-title">{task.title}</h4>
                    <p className="task-description">{task.description}</p>
                    
                    <div className="task-footer">
                      <div className="task-assignee">
                        <div className="assignee-avatar">
                          {task.assignee?.charAt(0).toUpperCase()}
                        </div>
                        <span>{task.assignee}</span>
                      </div>
                      <div className="task-points">
                        {task.storyPoints} pts
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default KanbanBoard;
