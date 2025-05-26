import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, Table as TableIcon, BarChart3, PieChart, FileText, Eye, ToggleLeft, File } from 'lucide-react';
import BottomChatInput from '../components/input/InputComponent';
import TableComponent from '../components/Table/TableComponent';
import BarChartComponent from '../components/BarChart/BarChartComponent';
import PieChartComponent from '../components/PieChart/PieChartComponent';
import SummaryComponent from '../components/SummaryComponent/SummaryComponent';
import './style/ask.css';

const AskResults = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { company_id, application_id } = useParams();
  const [activeView, setActiveView] = useState('bar');
  
  // State for managing multiple Q&A pairs
  const [conversations, setConversations] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  
  // Initialize with first question/response from navigation state
  useEffect(() => {
    if (location.state?.data && location.state?.question) {
      const initialConversation = {
        id: Date.now(),
        question: location.state.question,
        data: location.state.data,
        summary: null,
        summaryLoading: true,
        summaryError: null,
        timestamp: new Date()
      };
      
      setConversations([initialConversation]);
      
      // Fetch summary for initial question
      fetchSummary(initialConversation.id, location.state.data, location.state.question);
    } else {
      navigate(application_id ? `/company/${company_id}/application/${application_id}` : `/company/${company_id}/`);
    }
  }, [location.state, navigate, company_id, application_id]);

  const fetchSummary = async (conversationId, data, question) => {
    try {
      const response = await fetch(`${window.location.origin}/api/route-summarize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-company-id': company_id,
        },
        body: JSON.stringify({
          data: data.result,
          question: question,
          language: 'en-IN'
        })
      });

      if (response.ok) {
        const result = await response.json();
        
        setConversations(prev => prev.map(conv => 
          conv.id === conversationId 
            ? { ...conv, summary: result.summary, summaryLoading: false }
            : conv
        ));
      } else {
        throw new Error('Failed to generate summary');
      }
    } catch (error) {
      console.error('Summary error:', error);
      setConversations(prev => prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, summaryError: 'Failed to generate summary. Please try again.', summaryLoading: false }
          : conv
      ));
    }
  };

  const handleSendMessage = async () => {
    if (!currentMessage.trim() || isAsking) return;
    
    setIsAsking(true);
    const questionText = currentMessage.trim();
    setCurrentMessage('');

    try {
      // Create FormData for the API call
      const formData = new FormData();
      formData.append('question', questionText);
      formData.append('session_id', 'session123');
      formData.append('language', 'en-IN');

      const response = await fetch(`${window.location.origin}/api/route-ask`, {
        method: 'POST',
        headers: {
          'x-company-id': company_id,
        },
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Ask API response:', result);
        
        // Create new conversation entry
        const newConversation = {
          id: Date.now(),
          question: questionText,
          data: result,
          summary: null,
          summaryLoading: true,
          summaryError: null,
          timestamp: new Date()
        };
        
        // Add to conversations
        setConversations(prev => [...prev, newConversation]);
        
        // Fetch summary for new question
        fetchSummary(newConversation.id, result, questionText);
        
      } else {
        throw new Error('Ask request failed');
      }
    } catch (error) {
      console.error('Ask error:', error);
      // You could add error handling here, maybe add an error conversation entry
    } finally {
      setIsAsking(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleRetry = (conversationId) => {
    const conversation = conversations.find(conv => conv.id === conversationId);
    if (conversation) {
      setConversations(prev => prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, summaryLoading: true, summaryError: null }
          : conv
      ));
      fetchSummary(conversationId, conversation.data, conversation.question);
    }
  };

  const handleBackClick = () => {
    navigate(application_id ? `/company/${company_id}/application/${application_id}` : `/company/${company_id}/`);
  };

  const downloadData = (data) => {
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

  const renderContent = (data, viewType = activeView) => {
    switch (viewType) {
      case 'table':
        return <TableComponent data={data.result} />;
      case 'bar':
        return <BarChartComponent data={data.result} />;
      case 'pie':
        return <PieChartComponent data={data.result} />;
      default:
        return <BarChartComponent data={data.result} />;
    }
  };

  if (conversations.length === 0) {
    return (
      <div className="ask-loading">
        <div className="loading-spinner"></div>
        <p>Loading results...</p>
      </div>
    );
  }

  return (
    <div className="ask-results-container-new">
      {/* Back Button */}
      <div className="back-button-container">
        <button onClick={handleBackClick} className="back-button">
          <ArrowLeft size={18} />
          Back to Upload
        </button>
      </div>

      {/* Scrollable Content Area */}
      <div className="conversations-container">
        {conversations.map((conversation, index) => (
          <div key={conversation.id} className="conversation-item">
            {/* Question Header */}
            <div className="question-header">
              <div className="question-content">
                <div className="question-icon">
                  <FileText size={20} />
                </div>
                <div className="question-details">
                  <h2 className="question-title">
                    {conversation.question}
                  </h2>
                  <div className="question-meta">
                    <span>{conversation.timestamp.toLocaleString()}</span>
                    {/* File Information in Header */}
                    {conversation.data.file_info && (
                      <div className="file-info-inline">
                        <File size={11} />
                        <span className="file-name">{conversation.data.file_info.original_filename}</span>
                        {conversation.data.file_info.converted_from_excel && (
                          <span className="file-type-badge">Excel</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="question-actions">
                <button 
                  className={`view-toggle-btn ${activeView === 'bar' ? 'active' : ''}`}
                  onClick={() => setActiveView('bar')}
                  title="Bar Chart"
                >
                  <BarChart3 size={18} />
                </button>
                <button 
                  className={`view-toggle-btn ${activeView === 'table' ? 'active' : ''}`}
                  onClick={() => setActiveView('table')}
                  title="Table View"
                >
                  <TableIcon size={18} />
                </button>
                <button 
                  className={`view-toggle-btn ${activeView === 'pie' ? 'active' : ''}`}
                  onClick={() => setActiveView('pie')}
                  title="Pie Chart"
                >
                  <PieChart size={18} />
                </button>
                <button 
                  className="action-button save-btn"
                  onClick={() => downloadData(conversation.data)}
                  title="Save"
                >
                  <Download size={18} />
                </button>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="main-content-area">
              <div className="chart-and-summary">
                {/* Chart Section */}
                <div className="chart-section-new">
                  <div className="chart-header">
                    <div className="chart-title">
                      Analysis Results for Question {index + 1}
                    </div>
                  </div>
                  <div className="chart-content">
                    {renderContent(conversation.data)}
                  </div>
                  
                  {/* Show Code Toggle */}
                  {conversation.data.code && (
                    <div className="code-toggle-section">
                      <details>
                        <summary className="show-code-btn">
                          <span>▷</span>
                          Show Code
                        </summary>
                        <div className="code-display">
                          <pre className="code-block-new">
                            <code>{conversation.data.code}</code>
                          </pre>
                        </div>
                      </details>
                    </div>
                  )}
                </div>

                {/* Summary Panel */}
                <div className="summary-panel">
                  <SummaryComponent 
                    summary={conversation.summary}
                    summaryLoading={conversation.summaryLoading}
                    summaryError={conversation.summaryError}
                    onRetry={() => handleRetry(conversation.id)}
                  />
                </div>
              </div>
            </div>
            
            {/* Separator between conversations */}
            {index < conversations.length - 1 && <div className="conversation-separator" />}
          </div>
        ))}
        
        {/* Loading indicator for new question */}
        {isAsking && (
          <div className="conversation-item loading">
            <div className="question-header">
              <div className="question-content">
                <div className="question-icon">
                  <FileText size={20} />
                </div>
                <div className="question-details">
                  <div className="loading-text">Processing your question...</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Fixed Bottom Input */}
      <BottomChatInput
        message={currentMessage}
        setMessage={setCurrentMessage}
        onSendMessage={handleSendMessage}
        onKeyPress={handleKeyPress}
        placeholder={isAsking ? "Processing your question..." : "Ask another question about your data..."}
        disabled={isAsking}
      />
    </div>
  );
};

export default AskResults;