import React from 'react';
import { FileSpreadsheet, Sparkles, ShoppingCart } from 'lucide-react';
import './FilePreview.css';

const FilePreview = ({ filePreview, orderPreview, setMessage }) => {
  // Use orderPreview if available, otherwise fall back to filePreview
  const previewData = orderPreview?.file_preview || filePreview;
  const isOrderData = !!orderPreview;

  return (
    <div className="file-preview-container">
      {previewData ? (
        <div className="file-preview-content">
          {/* File Info Header */}
          <div className="preview-header">
            <div className="preview-title">
              {isOrderData ? (
                <ShoppingCart className="preview-icon" />
              ) : (
                <FileSpreadsheet className="preview-icon" />
              )}
              <div>
                <h3 className="preview-filename">
                  {previewData.filename}
                  {isOrderData && <span className="data-source-badge">Orders API</span>}
                </h3>
                <div className="preview-stats">
                  <span className="stat-item">{previewData.num_rows_total} rows</span>
                  <span className="stat-divider">•</span>
                  <span className="stat-item">{previewData.columns.length} columns</span>
                  {orderPreview?.mongodb_stats && (
                    <>
                      <span className="stat-divider">•</span>
                      <span className="stat-item">
                        {orderPreview.mongodb_stats.total_processed} processed
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Two Column Layout for Preview Content */}
          <div className="preview-content-grid">
            {/* Left Column - Columns and Sample Data */}
            <div className="preview-left">
              {/* Columns Preview */}
              <div className="columns-section">
                <h4 className="section-header">Columns ({previewData.columns.length})</h4>
                <div className="columns-grid">
                  {previewData.columns.map((column, index) => (
                    <div key={index} className="column-tag">
                      {column.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </div>
                  ))}
                </div>
              </div>

              {/* Sample Data */}
              <div className="sample-data-section">
                <h4 className="section-header">Sample Data</h4>
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        {previewData.columns.slice(0, 4).map((column, index) => (
                          <th key={index} className="table-header">
                            {column.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </th>
                        ))}
                        {previewData.columns.length > 4 && (
                          <th className="table-header more-cols">+{previewData.columns.length - 4} more</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.first_10_rows.slice(0, 5).map((row, index) => (
                        <tr key={index} className="table-row">
                          {previewData.columns.slice(0, 4).map((column, colIndex) => (
                            <td key={colIndex} className="table-cell">
                              {formatCellValue(row[column], column)}
                            </td>
                          ))}
                          {previewData.columns.length > 4 && (
                            <td className="table-cell more-data">...</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right Column - Suggested Questions */}
            <div className="preview-right">
              {previewData.insights?.question && (
                <div className="suggestions-section">
                  <h4 className="section-header">
                    {isOrderData ? 'Analysis Questions' : 'Suggested Questions'}
                  </h4>
                  <div className="suggestions-grid">
                    {previewData.insights.question.map((question, index) => (
                      <button 
                        key={index} 
                        className="suggestion-btn"
                        onClick={() => setMessage(question)}
                      >
                        <Sparkles className="suggestion-icon" />
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Order-specific summary stats */}
              {isOrderData && previewData.first_10_rows.length > 0 && (
                <div className="summary-stats">
                  <h4 className="section-header">Quick Stats</h4>
                  <div className="stats-grid">
                    <div className="stat-card">
                      <span className="stat-label">Total Orders</span>
                      <span className="stat-value">{previewData.num_rows_total}</span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-label">Avg Order Value</span>
                      <span className="stat-value">
                        ₹{calculateAverage(previewData.first_10_rows, 'total_amount')}
                      </span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-label">Total Revenue</span>
                      <span className="stat-value">
                        ₹{calculateSum(previewData.first_10_rows, 'amount_paid')}
                      </span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-label">Total Discount</span>
                      <span className="stat-value">
                        ₹{calculateSum(previewData.first_10_rows, 'discount')}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="no-preview">
          <FileSpreadsheet className="no-preview-icon" />
          <h3 className="no-preview-title">No Data Available</h3>
          <p className="no-preview-text">Upload a file or fetch orders data to see preview and insights</p>
        </div>
      )}
    </div>
  );
};

// Helper function to format cell values
const formatCellValue = (value, column) => {
  if (value === null || value === undefined) return 'N/A';
  
  // Format currency columns
  if (column.includes('amount') || column.includes('discount') || column.includes('charge') || column.includes('value')) {
    if (typeof value === 'number') {
      return '₹' + value.toLocaleString();
    }
  }
  
  // Format dates
  if (column.includes('created') || column.includes('date')) {
    if (value) {
      return new Date(value).toLocaleDateString();
    }
  }
  
  // Format numbers
  if (typeof value === 'number') {
    return value.toLocaleString();
  }
  
  // Truncate long strings
  const stringValue = String(value);
  return stringValue.length > 20 ? stringValue.substring(0, 20) + '...' : stringValue;
};

// Helper function to calculate average
const calculateAverage = (rows, column) => {
  if (!rows || rows.length === 0) return '0';
  const sum = rows.reduce((acc, row) => acc + (Number(row[column]) || 0), 0);
  return Math.round(sum / rows.length).toLocaleString();
};

// Helper function to calculate sum
const calculateSum = (rows, column) => {
  if (!rows || rows.length === 0) return '0';
  const sum = rows.reduce((acc, row) => acc + (Number(row[column]) || 0), 0);
  return sum.toLocaleString();
};

export default FilePreview;