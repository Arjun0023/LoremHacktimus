import React from 'react';
import { Sparkles, RotateCcw } from 'lucide-react';
import './SummaryComponent.css';

// Enhanced markdown parser for complex formatting
const parseMarkdown = (text) => {
  if (!text) return '';
  
  let parsedText = text;
  
  // Replace headers (## heading)
  parsedText = parsedText.replace(/^## (.+)$/gm, '<h3 class="markdown-heading">$1</h3>');
  
  // Replace **bold** with <strong>
  parsedText = parsedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Replace *italic* with <em>  
  parsedText = parsedText.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Replace `code` with <code>
  parsedText = parsedText.replace(/`(.*?)`/g, '<code>$1</code>');
  
  // Handle bullet points with emojis and nested structure
  // First, handle nested arrow points (➡️)
  parsedText = parsedText.replace(/^\s{4,}➡️\s(.+)$/gm, '<li class="nested-arrow">➡️ $1</li>');
  
  // Handle nested bullet points with 📌
  parsedText = parsedText.replace(/^\s{4,}📌\s(.+)$/gm, '<li class="nested-bullet">📌 $1</li>');
  
  // Handle main bullet points with various emojis
  parsedText = parsedText.replace(/^\*\s([📊💡📌➡️].*?)$/gm, '<li class="main-bullet">$1</li>');
  
  // Handle regular bullet points
  parsedText = parsedText.replace(/^\*\s(.+)$/gm, '<li class="regular-bullet">$1</li>');
  
  // Wrap consecutive list items in appropriate ul tags
  // Handle nested lists first
  parsedText = parsedText.replace(/(<li class="nested-(?:arrow|bullet)">.*?<\/li>)(?:\s*<li class="nested-(?:arrow|bullet)">.*?<\/li>)*/gs, (match) => {
    return '<ul class="nested-list">' + match + '</ul>';
  });
  
  // Handle main lists
  parsedText = parsedText.replace(/(<li class="(?:main-bullet|regular-bullet)">.*?<\/li>)(?:\s*(?:<ul class="nested-list">.*?<\/ul>|<li class="(?:main-bullet|regular-bullet)">.*?<\/li>))*/gs, (match) => {
    return '<ul class="main-list">' + match + '</ul>';
  });
  
  // Replace line breaks with <br> but avoid adding them around block elements
  parsedText = parsedText.replace(/\n(?!<[h\/ul])/g, '<br>');
  
  // Clean up extra line breaks around headings and lists
  parsedText = parsedText.replace(/<br>\s*(<[h3ul])/g, '$1');
  parsedText = parsedText.replace(/(<\/[h3ul]>)\s*<br>/g, '$1');
  
  return parsedText;
};

const MarkdownRenderer = ({ content }) => {
  const parsedContent = parseMarkdown(content);
  
  return (
    <div 
      className="markdown-content"
      dangerouslySetInnerHTML={{ __html: parsedContent }}
    />
  );
};

const SummaryComponent = ({ 
  summary, 
  summaryLoading, 
  summaryError, 
  onRetry 
}) => {
  if (summaryLoading) {
    return (
      <div className="summary-card">
        <div className="summary-header">
          <div className="header-content">
            <div className="ai-badge">
              <Sparkles size={14} className="sparkle-icon" />
              <span>AI Insights</span>
            </div>
          </div>
        </div>
        <div className="summary-body loading">
          <div className="loading-container">
            <div className="pulse-dots">
              <div className="dot"></div>
              <div className="dot"></div>
              <div className="dot"></div>
            </div>
            <p className="loading-text">Analyzing data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (summaryError) {
    return (
      <div className="summary-card">
        <div className="summary-header">
          <div className="header-content">
            <div className="ai-badge error">
              <Sparkles size={14} className="sparkle-icon" />
              <span>AI Insights</span>
            </div>
          </div>
        </div>
        <div className="summary-body error">
          <div className="error-container">
            <p className="error-text">Unable to generate insights</p>
            <button 
              onClick={onRetry}
              className="retry-btn"
            >
              <RotateCcw size={14} />
              <span>Retry</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (summary) {
    return (
      <div className="summary-card">
        <div className="summary-header">
          <div className="header-content">
            <div className="ai-badge">
              <Sparkles size={12} className="sparkle-icon" />
              <span>AI Insights</span>
            </div>
          </div>
        </div>
        <div className="summary-body">
          <div className="summary-text">
            <MarkdownRenderer content={summary} />
          </div>
        </div>

      </div>
    );
  }

  return null;
};

export default SummaryComponent;