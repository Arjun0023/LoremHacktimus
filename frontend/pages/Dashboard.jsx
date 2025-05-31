import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3, PieChart, Table as TableIcon, Trash2, FileText, X } from 'lucide-react';
import TableComponent from '../components/Table/TableComponent';
import BarChartComponent from '../components/BarChart/BarChartComponent';
import PieChartComponent from '../components/PieChart/PieChartComponent';
import SummaryComponent from '../components/SummaryComponent/SummaryComponent';
import './style/dashboard.css';

const Dashboard = () => {
  const { company_id, application_id } = useParams();
  console.log('Company ID:', company_id, 'Application ID:', application_id);
  const navigate = useNavigate();
  const [dashboardItems, setDashboardItems] = useState([]);
  const [selectedSummary, setSelectedSummary] = useState(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [dashboardName, setDashboardName] = useState('');
  const [isSaving, setIsSaving] = useState(false);


  useEffect(() => {
    loadDashboardItems();
  }, []);

  const loadDashboardItems = () => {
    const items = JSON.parse(localStorage.getItem('dashboardItems') || '[]');
    setDashboardItems(items);
  };

  const handleBackClick = () => {
    navigate(application_id ? `/company/${company_id}/application/${application_id}` : `/company/${company_id}/`);
  };

  const removeItem = (itemId) => {
    const updatedItems = dashboardItems.filter(item => item.id !== itemId);
    setDashboardItems(updatedItems);
    localStorage.setItem('dashboardItems', JSON.stringify(updatedItems));
  };

  const clearAllItems = () => {
    if (window.confirm('Are you sure you want to clear all dashboard items?')) {
      setDashboardItems([]);
      localStorage.removeItem('dashboardItems');
    }
  };

  const showSummary = (item) => {
    setSelectedSummary(item);
  };

  const closeSummary = () => {
    setSelectedSummary(null);
  };

  const updateItemView = (itemId, viewType) => {
    setDashboardItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, activeView: viewType } : item
    ));
  };
const handleSaveDashboard = () => {
    setShowSaveModal(true);
};

const saveDashboardToMongoDB = async () => {
    if (!dashboardName.trim()) {
        alert('Please enter a dashboard name');
        return;
    }

    setIsSaving(true);
    try {
        const response = await fetch('/api/save-dashboard', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-company-id': company_id,
            },
            body: JSON.stringify({
                company_id,
                application_id,
                dashboard_name: dashboardName.trim(),
                dashboard_items: dashboardItems
            })
        });

        const result = await response.json();

        if (result.success) {
            alert('Dashboard saved successfully!');
            setShowSaveModal(false);
            setDashboardName('');
        } else {
            alert('Failed to save dashboard: ' + result.message);
        }
    } catch (error) {
        console.error('Save dashboard error:', error);
        alert('Error saving dashboard. Please try again.');
    } finally {
        setIsSaving(false);
    }
};

const closeSaveModal = () => {
    setShowSaveModal(false);
    setDashboardName('');
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

  if (dashboardItems.length === 0) {
    return (
      <div className="dashboard-container">
        <div className="back-button-container">
          <button onClick={handleBackClick} className="back-button">
            <ArrowLeft size={18} />
            Back to Upload
          </button>
        </div>
        
        <div className="dashboard-empty">
          <div className="empty-state">
            <FileText size={48} />
            <h2>No Dashboard Items</h2>
            <p>Start by adding charts from your analysis results to see them here.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-left">
          <button onClick={handleBackClick} className="back-button">
            <ArrowLeft size={18} />
            Back to Upload
          </button>
          <h1 className="dashboard-title">Dashboard</h1>
          <span className="dashboard-count">{dashboardItems.length} items</span>
        </div>
        <div className="header-actions">
    <button onClick={handleSaveDashboard} className="save-dashboard-btn">
        <FileText size={16} />
        Save Dashboard
    </button>
    <button onClick={clearAllItems} className="clear-all-btn">
        <Trash2 size={16} />
        Clear All
    </button>
</div>
      </div>

      {/* Dashboard Grid */}
      <div className="dashboard-grid">
        {dashboardItems.map((item) => (
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
                <button 
                  className="remove-btn"
                  onClick={() => removeItem(item.id)}
                  title="Remove"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Card Content */}
            <div className="card-content">
              <div className="chart-wrapper">
                {renderChart(item)}
              </div>
              
              {/* Summary Button */}
              {item.summary && (
                <div className="summary-button-wrapper">
                  <button 
                    className="show-summary-btn"
                    onClick={() => showSummary(item)}
                  >
                    <FileText size={14} />
                    View Summary
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Summary Modal */}
      {selectedSummary && (
        <div className="summary-modal-overlay" onClick={closeSummary}>
          <div className="summary-modal" onClick={(e) => e.stopPropagation()}>
            <div className="summary-modal-header">
              <h3>Analysis Summary</h3>
              <button className="close-btn" onClick={closeSummary}>
                <X size={20} />
              </button>
            </div>
            <div className="summary-modal-content">
              <div className="summary-question">
                <strong>Question:</strong> {selectedSummary.question}
              </div>
              <div className="summary-wrapper">
                <SummaryComponent 
                  summary={selectedSummary.summary}
                  summaryLoading={false}
                  summaryError={null}
                  onRetry={() => {}}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;