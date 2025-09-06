import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ZoomIn, ZoomOut, Calendar, Filter } from 'lucide-react';
import './GanttChart.css';

const GanttChart = () => {
  const { workspaceId, projectId } = useParams();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [viewMode, setViewMode] = useState('weeks'); // days, weeks, months
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    // Fetch project tasks and timeline
    fetchProjectData();
  }, [projectId]);

  const fetchProjectData = async () => {
    // TODO: Implement API call to fetch project data
    // For now, using mock data
    const mockTasks = [
      {
        id: '1',
        title: 'Project Planning',
        startDate: new Date(2025, 8, 1),
        endDate: new Date(2025, 8, 7),
        progress: 100,
        assignee: 'Project Manager',
        dependencies: [],
        type: 'milestone'
      },
      {
        id: '2',
        title: 'UI/UX Design',
        startDate: new Date(2025, 8, 8),
        endDate: new Date(2025, 8, 21),
        progress: 75,
        assignee: 'Design Team',
        dependencies: ['1'],
        type: 'task'
      },
      {
        id: '3',
        title: 'Frontend Development',
        startDate: new Date(2025, 8, 15),
        endDate: new Date(2025, 9, 5),
        progress: 45,
        assignee: 'Frontend Team',
        dependencies: ['2'],
        type: 'task'
      },
      {
        id: '4',
        title: 'Backend Development',
        startDate: new Date(2025, 8, 22),
        endDate: new Date(2025, 9, 12),
        progress: 30,
        assignee: 'Backend Team',
        dependencies: ['1'],
        type: 'task'
      },
      {
        id: '5',
        title: 'Testing & QA',
        startDate: new Date(2025, 9, 6),
        endDate: new Date(2025, 9, 19),
        progress: 0,
        assignee: 'QA Team',
        dependencies: ['3', '4'],
        type: 'task'
      },
      {
        id: '6',
        title: 'Deployment',
        startDate: new Date(2025, 9, 20),
        endDate: new Date(2025, 9, 22),
        progress: 0,
        assignee: 'DevOps Team',
        dependencies: ['5'],
        type: 'milestone'
      }
    ];
    setTasks(mockTasks);
  };

  const handleBack = () => {
    navigate(`/workspaces/${workspaceId}`);
  };

  const generateTimelineHeaders = () => {
    const headers = [];
    const startDate = new Date(currentDate);
    startDate.setDate(1);
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(startDate);
      date.setMonth(startDate.getMonth() + i);
      
      if (viewMode === 'weeks') {
        for (let week = 0; week < 4; week++) {
          const weekStart = new Date(date);
          weekStart.setDate(1 + (week * 7));
          headers.push({
            key: `${date.getMonth()}-${week}`,
            label: `Week ${week + 1}`,
            date: weekStart
          });
        }
      } else {
        headers.push({
          key: date.getMonth(),
          label: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          date: new Date(date)
        });
      }
    }
    
    return headers;
  };

  const calculateTaskPosition = (task) => {
    const timelineStart = new Date(currentDate);
    timelineStart.setDate(1);
    
    const taskStart = new Date(task.startDate);
    const taskEnd = new Date(task.endDate);
    
    const totalDays = 365; // Roughly a year view
    const startOffset = Math.max(0, (taskStart - timelineStart) / (1000 * 60 * 60 * 24));
    const duration = (taskEnd - taskStart) / (1000 * 60 * 60 * 24);
    
    const leftPercent = (startOffset / totalDays) * 100;
    const widthPercent = (duration / totalDays) * 100;
    
    return {
      left: `${Math.max(0, leftPercent)}%`,
      width: `${Math.max(1, widthPercent)}%`
    };
  };

  const getTaskTypeColor = (type) => {
    return type === 'milestone' ? '#dc2626' : '#3b82f6';
  };

  return (
    <div className="gantt-chart">
      <div className="gantt-header">
        <div className="header-left">
          <button onClick={handleBack} className="back-btn">
            <ArrowLeft size={20} />
          </button>
          <div className="project-info">
            <h1>Project Timeline</h1>
            <p>Gantt chart view with dependencies</p>
          </div>
        </div>
        
        <div className="header-right">
          <div className="view-controls">
            <button 
              className={`view-btn ${viewMode === 'days' ? 'active' : ''}`}
              onClick={() => setViewMode('days')}
            >
              Days
            </button>
            <button 
              className={`view-btn ${viewMode === 'weeks' ? 'active' : ''}`}
              onClick={() => setViewMode('weeks')}
            >
              Weeks
            </button>
            <button 
              className={`view-btn ${viewMode === 'months' ? 'active' : ''}`}
              onClick={() => setViewMode('months')}
            >
              Months
            </button>
          </div>
          
          <button className="zoom-btn">
            <ZoomOut size={16} />
          </button>
          <button className="zoom-btn">
            <ZoomIn size={16} />
          </button>
          
          <button className="today-btn">
            <Calendar size={16} />
            Today
          </button>
          
          <button className="filter-btn">
            <Filter size={16} />
            Filter
          </button>
        </div>
      </div>

      <div className="gantt-content">
        <div className="gantt-sidebar">
          <div className="sidebar-header">
            <div className="column-header">Task</div>
            <div className="column-header">Assignee</div>
            <div className="column-header">Progress</div>
          </div>
          
          <div className="task-list">
            {tasks.map(task => (
              <div key={task.id} className="task-row">
                <div className="task-info">
                  <div className="task-name">
                    <div 
                      className="task-indicator"
                      style={{ backgroundColor: getTaskTypeColor(task.type) }}
                    ></div>
                    {task.title}
                  </div>
                </div>
                <div className="task-assignee">{task.assignee}</div>
                <div className="task-progress">
                  <div className="progress-bar">
                    <div 
                      className="progress-fill"
                      style={{ width: `${task.progress}%` }}
                    ></div>
                  </div>
                  <span className="progress-text">{task.progress}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="gantt-timeline">
          <div className="timeline-header">
            {generateTimelineHeaders().map(header => (
              <div key={header.key} className="timeline-column">
                {header.label}
              </div>
            ))}
          </div>
          
          <div className="timeline-body">
            {tasks.map(task => (
              <div key={task.id} className="timeline-row">
                <div 
                  className={`task-bar ${task.type}`}
                  style={{
                    ...calculateTaskPosition(task),
                    backgroundColor: getTaskTypeColor(task.type)
                  }}
                  title={`${task.title}: ${task.startDate.toLocaleDateString()} - ${task.endDate.toLocaleDateString()}`}
                >
                  <div 
                    className="task-progress-overlay"
                    style={{ width: `${task.progress}%` }}
                  ></div>
                  <span className="task-label">{task.title}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GanttChart;
