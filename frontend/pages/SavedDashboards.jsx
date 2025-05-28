import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3, PieChart, Table as TableIcon, Trash2, FileText, X, Calendar, ChevronRight, Sparkles } from 'lucide-react';
import TableComponent from '../components/Table/TableComponent';
import BarChartComponent from '../components/BarChart/BarChartComponent';
import PieChartComponent from '../components/PieChart/PieChartComponent';
import './style/SavedDashboards.css';

const SavedDashboards = () => {
  const { company_id, application_id } = useParams();
  const navigate = useNavigate();
  const [dashboards, setDashboards] = useState([]);
  const [selectedDashboard, setSelectedDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    fetchDashboards();
  }, [company_id, application_id]);

  const fetchDashboards = async () => {
    try {
      setLoading(true);
      const url = application_id 
        ? `/api/get-dashboards/${company_id}?application_id=${application_id}`
        : `/api/get-dashboards/${company_id}`;
      
      const response = await fetch(url, {
        headers: {
          'x-company-id': company_id,
        }
      });

      const result = await response.json();

      if (result.success) {
        setDashboards(result.dashboards);
      } else {
        setError(result.message);
      }
    } catch (error) {
      console.error('Fetch dashboards error:', error);
      setError('Failed to load dashboards');
    } finally {
      setLoading(false);
    }
  };

  const handleBackClick = () => {
    navigate(application_id ? `/company/${company_id}/application/${application_id}` : `/company/${company_id}/`);
  };

  const selectDashboard = async (dashboard) => {
    try {
      const response = await fetch(`/api/get-dashboard/${dashboard._id}`);
      const result = await response.json();
      
      if (result.success) {
        setSelectedDashboard(result.dashboard);
        setSidebarCollapsed(true);
      } else {
        alert('Failed to load dashboard details');
      }
    } catch (error) {
      console.error('Load dashboard error:', error);
      alert('Error loading dashboard');
    }
  };

  const deleteDashboard = async (dashboardId, e) => {
    e.stopPropagation();
    
    if (!window.confirm('Are you sure you want to delete this dashboard?')) {
      return;
    }

    try {
      const response = await fetch(`/api/delete-dashboard/${dashboardId}`, {
        method: 'DELETE',
        headers: {
          'x-company-id': company_id,
        }
      });

      const result = await response.json();

      if (result.success) {
        setDashboards(prev => prev.filter(d => d._id !== dashboardId));
        if (selectedDashboard && selectedDashboard.id === dashboardId) {
          setSelectedDashboard(null);
          setSidebarCollapsed(false);
        }
      } else {
        alert('Failed to delete dashboard');
      }
    } catch (error) {
      console.error('Delete dashboard error:', error);
      alert('Error deleting dashboard');
    }
  };

  const updateItemView = (itemId, viewType) => {
    setSelectedDashboard(prev => ({
      ...prev,
      dashboard_items: prev.dashboard_items.map(item => 
        item.id === itemId ? { ...item, activeView: viewType } : item
      )
    }));
  };

  const renderChart = (item) => {
    const viewType = item.activeView || 'bar';
    
    switch (viewType) {
      case 'table':
        return <TableComponent data={item.data.result} />;
      case 'bar':
        return <BarChartComponent data={item.data.result} />;
      case 'pie':
        return <PieChartComponent data={item.data.result} />;
      default:
        return <BarChartComponent data={item.data.result} />;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="saved-dashboards-container">
        <div className="loading-state">
          <Sparkles className="loading-icon" />
          <p>Loading dashboards...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="saved-dashboards-container">
        <div className="error-state">
          <FileText size={48} />
          <h2>Error Loading Dashboards</h2>
          <p>{error}</p>
          <button onClick={handleBackClick} className="back-button">
            <ArrowLeft size={18} />
            Back to Upload
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="saved-dashboards-container">
      {/* Header */}
      <div className="saved-dashboards-header">
        <div className="header-left">
          <button onClick={handleBackClick} className="back-button">
            <ArrowLeft size={18} />
            Back to Upload
          </button>
          <div className="header-info">
            <div className="logo">
              <Sparkles className="logo-icon" />
            </div>
            <div className="header-text">
              <h1 className="main-title">My Dashboards</h1>
              <p className="subtitle">{dashboards.length} saved dashboards</p>
            </div>
          </div>
        </div>
      </div>

      <div className="saved-dashboards-layout">
        {/* Sidebar */}
        <div className={`dashboards-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <div className="sidebar-header">
            <h3>Saved Dashboards</h3>
            {selectedDashboard && (
              <button 
                className="expand-sidebar-btn"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              >
                <ChevronRight className={`chevron ${sidebarCollapsed ? 'rotated' : ''}`} />
              </button>
            )}
          </div>
          
          {dashboards.length === 0 ? (
            <div className="empty-sidebar">
              <FileText size={32} />
              <p>No saved dashboards</p>
            </div>
          ) : (
            <div className="dashboards-list">
              {dashboards.map((dashboard) => (
                <div 
                  key={dashboard._id}
                  className={`dashboard-item ${selectedDashboard?.id === dashboard._id ? 'active' : ''}`}
                  onClick={() => selectDashboard(dashboard)}
                >
                  <div className="dashboard-item-content">
                    <div className="dashboard-item-header">
                      <h4 className="dashboard-item-title">{dashboard.dashboard_name}</h4>
                      <button 
                        className="delete-dashboard-btn"
                        onClick={(e) => deleteDashboard(dashboard._id, e)}
                        title="Delete Dashboard"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="dashboard-item-meta">
                      <span className="dashboard-item-count">
                        {dashboard.dashboard_items?.length || 0} items
                      </span>
                      <span className="dashboard-item-date">
                        <Calendar size={12} />
                        {formatDate(dashboard.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="dashboards-main-content">
          {!selectedDashboard ? (
            <div className="dashboard-empty">
              <div className="empty-state">
                <BarChart3 size={48} />
                <h2>Select a Dashboard</h2>
                <p>Choose a dashboard from the sidebar to view its contents.</p>
              </div>
            </div>
          ) : (
            <div className="dashboard-viewer">
              <div className="dashboard-viewer-header">
                <h2>{selectedDashboard.dashboard_name}</h2>
                <span className="dashboard-items-count">
                  {selectedDashboard.dashboard_items?.length || 0} items
                </span>
              </div>

              <div className="dashboard-grid">
                {selectedDashboard.dashboard_items?.map((item) => (
                  <div key={item.id} className="dashboard-card">
                    {/* Card Header */}
                    <div className="card-header">
                      <div className="card-title-section">
                        <div className="card-icon">
                          <FileText size={16} />
                        </div>
                        <div className="card-details">
                          <h3 className="card-title">{item.question}</h3>
                          <span className="card-timestamp">
                            {new Date(item.addedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="card-actions">
                        <div className="view-toggles">
                          <button 
                            className={`view-toggle-btn ${(item.activeView || 'bar') === 'bar' ? 'active' : ''}`}
                            onClick={() => updateItemView(item.id, 'bar')}
                            title="Bar Chart"
                          >
                            <BarChart3 size={14} />
                          </button>
                          <button 
                            className={`view-toggle-btn ${item.activeView === 'table' ? 'active' : ''}`}
                            onClick={() => updateItemView(item.id, 'table')}
                            title="Table View"
                          >
                            <TableIcon size={14} />
                          </button>
                          <button 
                            className={`view-toggle-btn ${item.activeView === 'pie' ? 'active' : ''}`}
                            onClick={() => updateItemView(item.id, 'pie')}
                            title="Pie Chart"
                          >
                            <PieChart size={14} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="card-content">
                      <div className="chart-wrapper">
                        {renderChart(item)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SavedDashboards;