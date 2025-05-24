import React from 'react';
import { Upload, FileSpreadsheet, FileText, X } from 'lucide-react';
import './FileUpload.css';

const FileUpload = ({ 
  uploadedFile, 
  isUploading, 
  fileInputRef, 
  handleFileUpload, 
  removeFile, 
  formatFileSize 
}) => {
  return (
    <div className="upload-section">
      <div className="section-header">
        <h2 className="section-title">
          <FileSpreadsheet className="section-icon" />
          File Upload
        </h2>
      </div>
      
      {!uploadedFile ? (
        <div
          className="upload-area"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="upload-icon" />
          <h3 className="upload-title">Drop files here</h3>
          <p className="upload-description">
            Excel (.xlsx, .xls) and CSV files up to 10MB
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            className="file-input"
          />
        </div>
      ) : (
        <div className="uploaded-file">
          <div className="file-info">
            <div className="file-icon-container">
              {uploadedFile.type.includes('csv') ? (
                <FileText className="file-icon" />
              ) : (
                <FileSpreadsheet className="file-icon" />
              )}
            </div>
            <div className="file-details">
              <p className="file-name">{uploadedFile.name}</p>
              <p className="file-size">{formatFileSize(uploadedFile.size)}</p>
            </div>
          </div>
          <button onClick={removeFile} className="remove-file-btn">
            <X className="remove-icon" />
          </button>
        </div>
      )}
      
      {isUploading && (
        <div className="uploading-status">
          <div className="spinner"></div>
          <span className="uploading-text">Uploading file...</span>
        </div>
      )}
    </div>
  );
};

export default FileUpload;