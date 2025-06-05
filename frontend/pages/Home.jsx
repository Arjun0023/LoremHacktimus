import React, { useState, useEffect, useRef } from "react";
import { Upload, FileSpreadsheet, X, Send, Sparkles, FileText, BarChart3, Mic } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import "./style/home.css"; // Make sure to create this CSS file
import BottomChatInput from "../components/input/InputComponent";
import FilePreview from "../components/FilePreview/FilePreview";
import FileUpload from "../components/FileUpload/FileUpload";

const EXAMPLE_MAIN_URL = window.location.origin;

export const Home = () => {
  const [pageLoading, setPageLoading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [message, setMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isAsking, setIsAsking] = useState(false); // New state for ask loading
  const [chatHistory, setChatHistory] = useState([
    {
      type: 'ai',
      content: 'Hello! I\'m your AI assistant. Upload an Excel (.xlsx, .xls) or CSV file and ask me questions about your data.',
      timestamp: new Date()
    }
  ]);
  const [orderPreview, setOrderPreview] = useState(null);
  const [showSyncDropdown, setShowSyncDropdown] = useState(false);
const [syncType, setSyncType] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [isOrdersData, setIsOrdersData] = useState(false); // Track if current data is from orders
  const { company_id } = useParams();
  const application_id = '682b353767354dde698f64a9'; // Get application_id from URL params
  console.log('Company ID:', company_id, 'Application ID:', application_id);
  const navigate = useNavigate(); // Add navigate hook
  const fileInputRef = useRef(null);
  const [selectedLanguage, setSelectedLanguage] = useState('en-US');

  const [isLoadingOrders, setIsLoadingOrders] = useState(false);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv' // .csv
    ];
    
    if (!allowedTypes.includes(file.type) && !file.name.toLowerCase().endsWith('.csv')) {
      alert('Please upload only Excel (.xlsx, .xls) or CSV files.');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('company_id', company_id);
    formData.append('session_id', 'session123');
    if (application_id) {
      formData.append('application_id', application_id);
    }

    try {
      const response = await fetch(`${EXAMPLE_MAIN_URL}/api/upload-file`, {
        method: 'POST',
        body: formData,
        headers: {
          'x-company-id': company_id,
        }
      });

      if (response.ok) {
        const result = await response.json();
        console.log('File upload response:', result);
        setFilePreview(result);
        setUploadedFile({
          name: file.name,
          size: file.size,
          type: file.type
        });
        setIsOrdersData(false); // This is uploaded file data, not orders
        
        // Add success message to chat
        setChatHistory(prev => [...prev, {
          type: 'system',
          content: `✅ File "${file.name}" uploaded successfully! You can now ask questions about your data.`,
          timestamp: new Date()
        }]);
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setChatHistory(prev => [...prev, {
        type: 'system',
        content: `❌ Failed to upload "${file.name}". Please try again.`,
        timestamp: new Date()
      }]);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim()) return;
  
    const userMessage = {
      type: 'user',
      content: message,
      timestamp: new Date()
    };
  
    setChatHistory(prev => [...prev, userMessage]);
    const currentMessage = message;
    setMessage("");
    setIsAsking(true);
  
    if (!uploadedFile) {
      setTimeout(() => {
        const aiResponse = {
          type: 'ai',
          content: "Please upload a file first so I can analyze your data and provide insights.",
          timestamp: new Date()
        };
        setChatHistory(prev => [...prev, aiResponse]);
        setIsAsking(false);
      }, 1000);
      return;
    }
  
    try {
      // Create FormData instead of JSON
      const formData = new FormData();
      formData.append('question', currentMessage.trim());
      formData.append('session_id', 'session123');
      formData.append('language', selectedLanguage);
      
      // Add type parameter when using MongoDB route
      if (isOrdersData) {
        // Determine the type based on the uploaded file or sync type
        const dataType = uploadedFile.isOrdersData ? 'order' : 'product';
        formData.append('type', dataType);
      }
  
      setPageLoading(true); // <-- Show spinner
  
      // Choose endpoint based on whether we have orders data or uploaded file data
      const endpoint = isOrdersData ? '/api/route-mongo' : '/api/route-ask';
      
      const response = await fetch(`${EXAMPLE_MAIN_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'x-company-id': company_id,
          // Remove Content-Type header - let browser set it for FormData
        },
        body: formData // Send FormData instead of JSON
      });
  
      if (response.ok) {
        const result = await response.json();
        console.log(`${endpoint} API response:`, result);
  
        const askPath = application_id 
          ? `/company/${company_id}/application/${application_id}/ask`
          : `/company/${company_id}/ask`;
          
          navigate(askPath, {
            state: {
              data: result,
              question: currentMessage,
              isOrdersData: isOrdersData,
              dataType: uploadedFile?.dataType || (uploadedFile?.isOrdersData ? 'orders' : 'products') // Pass the original sync type
            }
          });
        // No need to setPageLoading(false) because component will unmount
      } else {
        throw new Error('Ask request failed');
      }
    } catch (error) {
      console.error('Ask error:', error);
      setChatHistory(prev => [...prev, {
        type: 'system',
        content: `❌ Failed to process your question. Please try again.`,
        timestamp: new Date()
      }]);
      setPageLoading(false); // Hide spinner on error
    } finally {
      setIsAsking(false);
    }
  };
  
  console.log(selectedLanguage);

  const removeFile = () => {
    setUploadedFile(null);
    setFilePreview(null); // Also clear file preview
    setOrderPreview(null);
    setIsOrdersData(false); // Reset orders data flag
    setChatHistory(prev => [...prev, {
      type: 'system',
      content: 'File removed. Upload a new file to continue analysis.',
      timestamp: new Date()
    }]);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

// Updated handleSync function to track data type
const handleSync = async (type) => {
  if (!application_id) {
      console.log('No application_id available');
      return;
  }

  setIsLoadingOrders(true);
  setSyncType(type);
  setShowSyncDropdown(false);

  try {
      const endpoint = type === 'orders' 
          ? `/api/products/orders/${application_id}?pageNo=1&pageSize=10`
          : `/api/products/sync/${application_id}`;

      const response = await fetch(`${EXAMPLE_MAIN_URL}${endpoint}`, {
          method: 'GET',
          headers: {
              'Content-Type': 'application/json',
              'x-company-id': company_id,
          }
      });

      if (response.ok) {
          const syncData = await response.json();
          console.log(`${type} sync response:`, syncData);
          
          setFilePreview(syncData.file_preview);
          setIsOrdersData(type === 'orders' || type === 'products');
          
          setUploadedFile({
              name: syncData.file_preview.filename,
              size: 0,
              type: 'application/json',
              isOrdersData: type === 'orders', // Track if it's specifically orders data
              dataType: type // Add explicit data type tracking
          });
          
          setChatHistory(prev => [...prev, {
              type: 'system',
              content: `✅ ${syncData.message || `Synced ${syncData.synced_count} ${type}`}`,
              timestamp: new Date()
          }]);
      } else {
          throw new Error(`API call failed with status: ${response.status}`);
      }
  } catch (error) {
      console.error(`${type} sync error:`, error);
      setChatHistory(prev => [...prev, {
          type: 'system',
          content: `❌ Failed to sync ${type}: ${error.message}`,
          timestamp: new Date()
      }]);
  } finally {
      setIsLoadingOrders(false);
      setSyncType(null);
  }
};
  

  return (
    <div className="ai-saas-container">
      {/* Header */}
      <div className="header">
        <div className="header-content">
          <div className="header-info">
            <div className="logo">
              <Sparkles className="logo-icon" />
            </div>
            <div className="header-text">
              <h1 className="main-title">AI Data Assistant</h1>
              <p className="subtitle">Upload Excel or CSV files and get AI-powered insights</p>
            </div>
          </div>
          {/* My Dashboards Button */}
<div className="my-dashboards-section">
  <button 
    onClick={() => {
      const dashboardPath = application_id 
        ? `/company/${company_id}/application/${application_id}/saved-dashboards`
        : `/company/${company_id}/saved-dashboards`;
      navigate(dashboardPath);
    }}
    className="my-dashboards-btn"
  >
    <BarChart3 className="btn-icon" />
    My Dashboards
  </button>
  
</div>
<div className="my-dashboards-section" style={{ position: 'relative' }}>
    <button 
        onClick={() => setShowSyncDropdown(!showSyncDropdown)}
        disabled={isLoadingOrders || !application_id}
        className="my-dashboards-btn"
        style={{ marginLeft: '10px' }}
    >
        <FileText className="btn-icon" />
        {isLoadingOrders ? `Syncing ${syncType}...` : 'Sync Data'}
    </button>
    
    {showSyncDropdown && (
        <div className="sync-dropdown">
            <div className="sync-option" onClick={() => handleSync('orders')}>
                <div className="sync-option-title">Sync Orders</div>
                <div className="sync-option-desc">Get insights on your orders</div>
            </div>
            <div className="sync-option" onClick={() => handleSync('products')}>
                <div className="sync-option-title">Sync Products</div>
                <div className="sync-option-desc">Analyze your product catalog</div>
            </div>
        </div>
    )}
</div>
        </div>
      </div>
  
      {/* Main Layout */}
      <div className="main-layout">
        {/* Left Sidebar - Upload & Chat */}
        <div className="left-sidebar">
          {/* File Upload Section */}
          <FileUpload
            uploadedFile={uploadedFile}
            isUploading={isUploading}
            fileInputRef={fileInputRef}
            handleFileUpload={handleFileUpload}
            removeFile={removeFile}
            formatFileSize={formatFileSize}
          />
          {/* Stats Cards */}
          <div className="stats-section">
            <div className="stat-card">
              <div className="stat-icon-container blue">
                <FileSpreadsheet className="stat-icon" />
              </div>
              <div className="stat-info">
                <p className="stat-value">{uploadedFile ? '1' : '0'}</p>
                <p className="stat-label">Files</p>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon-container green">
                <BarChart3 className="stat-icon" />
              </div>
              <div className="stat-info">
                <p className="stat-value">{chatHistory.filter(c => c.type === 'ai').length - 1}</p>
                <p className="stat-label">Insights</p>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon-container purple">
                <Sparkles className="stat-icon" />
              </div>
              <div className="stat-info">
                <p className="stat-value">{chatHistory.filter(c => c.type === 'ai').length}</p>
                <p className="stat-label">Responses</p>
              </div>
            </div>
          </div>
        </div>
  
        {/* Right Main Content - File Preview */}
        <div className="main-content">
          <FilePreview
            filePreview={filePreview}
            setMessage={setMessage}
          />
        </div>
      </div>
  
      {/* Bottom Chat Input */}
      <BottomChatInput
        message={message}
        setMessage={setMessage}
        onSendMessage={handleSendMessage}
        onKeyPress={handleKeyPress}
        placeholder={isAsking ? "Processing your question..." : "Ask about your data..."}
        disabled={isAsking || isUploading}
        onLanguageChange={setSelectedLanguage}
        isAsking={isAsking} 
      />
    </div>
  );
};