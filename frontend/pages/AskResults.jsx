import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, Table as TableIcon, BarChart3, PieChart } from 'lucide-react';
import BottomChatInput from '../components/input/InputComponent';
import TableComponent from '../components/Table/TableComponent';
import BarChartComponent from '../components/BarChart/BarChartComponent';
import PieChartComponent from '../components/PieChart/PieChartComponent';
import './style/ask.css';

const AskResults = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { company_id, application_id } = useParams();
  const [activeView, setActiveView] = useState('table');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Get data from navigation state
    if (location.state?.data) {
      setData(location.state.data);
    } else {
      // If no data in state, redirect back to home
      navigate(application_id ? `/company/${company_id}/application/${application_id}` : `/company/${company_id}/`);
    }
  }, [location.state, navigate, company_id, application_id]);

  if (!data) {
    return (
      <div className="ask-loading">
        <div className="loading-spinner"></div>
        <p>Loading results...</p>
      </div>
    );
  }

  const handleBackClick = () => {
    navigate(application_id ? `/company/${company_id}/application/${application_id}` : `/company/${company_id}/`);
  };

  const downloadData = () => {
    if (!data.result) return;
    
    const dataStr = JSON.stringify(data.result, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'analysis-results.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const renderContent = () => {
    switch (activeView) {
      case 'table':
        return <TableComponent data={data.result} />;
      case 'bar':
        return <BarChartComponent data={data.result} />;
      case 'pie':
        return <PieChartComponent data={data.result} />;
      default:
        return <TableComponent data={data.result} />;
    }
  };

  return (
    <div className="ask-results-container">
      {/* Header */}
      <div className="ask-header">
        <button onClick={handleBackClick} className="back-button">
          <ArrowLeft size={20} />
          <span>Back to Analysis</span>
        </button>
        <div className="header-actions">
          <button onClick={downloadData} className="download-button">
            <Download size={18} />
            <span>Download</span>
          </button>
        </div>
      </div>

      {/* Question Display */}
      <div className="question-display">
        <h2>Analysis Results</h2>
        {location.state?.question && (
          <p className="question-text">"{location.state.question}"</p>
        )}
      </div>

      {/* View Toggle */}
      <div className="view-toggle">
        <button 
          className={`toggle-btn ${activeView === 'table' ? 'active' : ''}`}
          onClick={() => setActiveView('table')}
        >
          <TableIcon size={18} />
          <span>Table</span>
        </button>
        <button 
          className={`toggle-btn ${activeView === 'bar' ? 'active' : ''}`}
          onClick={() => setActiveView('bar')}
        >
          <BarChart3 size={18} />
          <span>Bar Chart</span>
        </button>
        <button 
          className={`toggle-btn ${activeView === 'pie' ? 'active' : ''}`}
          onClick={() => setActiveView('pie')}
        >
          <PieChart size={18} />
          <span>Pie Chart</span>
        </button>
      </div>

      {/* Results Content */}
      <div className="results-content">
        {renderContent()}
      </div>

      {/* Code Display */}
      {data.code && (
        <div className="code-section">
          <h3>Generated Code</h3>
          <pre className="code-block">
            <code>{data.code}</code>
          </pre>
        </div>
      )}

      {/* File Info */}
      {data.file_info && (
        <div className="file-info">
          <h4>File Information</h4>
          <p><strong>Original Filename:</strong> {data.file_info.original_filename}</p>
          <p><strong>Converted from Excel:</strong> {data.file_info.converted_from_excel ? 'Yes' : 'No'}</p>
        </div>
      )}
      
      <BottomChatInput
        message={location.state?.question || ''}
        setMessage={() => {}}
        onSendMessage={() => {}}
        onKeyPress={() => {}}
        placeholder="Ask about your data..."
        disabled={true} // Disable input as this is a results page
      />
    </div>
  );
};

export default AskResults;