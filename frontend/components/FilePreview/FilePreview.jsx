import React from 'react';
import { FileSpreadsheet, Sparkles } from 'lucide-react';
import './FilePreview.css';

const FilePreview = ({ filePreview, setMessage }) => {
  return (
    <div className="file-preview-container">
      {filePreview ? (
        <div className="file-preview-content">
          {/* File Info Header */}
          <div className="preview-header">
            <div className="preview-title">
              <FileSpreadsheet className="preview-icon" />
              <div>
                <h3 className="preview-filename">{filePreview.filename}</h3>
                <div className="preview-stats">
                  <span className="stat-item">{filePreview.num_rows_total} rows</span>
                  <span className="stat-divider">•</span>
                  <span className="stat-item">{filePreview.columns.length} columns</span>
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
                <h4 className="section-header">Columns ({filePreview.columns.length})</h4>
                <div className="columns-grid">
                  {filePreview.columns.map((column, index) => (
                    <div key={index} className="column-tag">
                      {column}
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
                        {filePreview.columns.slice(0, 4).map((column, index) => (
                          <th key={index} className="table-header">{column}</th>
                        ))}
                        {filePreview.columns.length > 4 && (
                          <th className="table-header more-cols">+{filePreview.columns.length - 4} more</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {filePreview.first_10_rows.slice(0, 5).map((row, index) => (
                        <tr key={index} className="table-row">
                          {filePreview.columns.slice(0, 4).map((column, colIndex) => (
                            <td key={colIndex} className="table-cell">
                              {typeof row[column] === 'number' 
                                ? row[column].toLocaleString() 
                                : String(row[column] || '').substring(0, 20) + (String(row[column] || '').length > 20 ? '...' : '')
                              }
                            </td>
                          ))}
                          {filePreview.columns.length > 4 && (
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
              {filePreview.insights?.question && (
                <div className="suggestions-section">
                  <h4 className="section-header">Suggested Questions</h4>
                  <div className="suggestions-grid">
                    {filePreview.insights.question.map((question, index) => (
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
            </div>
          </div>
        </div>
      ) : (
        <div className="no-preview">
          <FileSpreadsheet className="no-preview-icon" />
          <h3 className="no-preview-title">No File Selected</h3>
          <p className="no-preview-text">Upload a file to see preview and insights</p>
        </div>
      )}
    </div>
  );
};

export default FilePreview;