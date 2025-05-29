import React, { useState, useCallback } from 'react';
import { Mic, MicOff, Send, Languages } from 'lucide-react';
import './BottomChatInput.css';

const languageOptions = [
  { code: 'en-IN', name: 'Hinglish' },
  { code: 'en-US', name: 'English' },
  { code: 'hi-IN', name: 'Hindi' },
  { code: 'mr-IN', name: 'Marathi' },
  { code: 'ta-IN', name: 'Tamil' },
  { code: 'te-IN', name: 'Telugu' },
  { code: 'kn-IN', name: 'Kannada' }
];

const BottomChatInput = ({ 
  message, 
  setMessage, 
  onSendMessage, 
  onKeyPress, 
  placeholder = "Ask about your data...",
  disabled = false,
  onLanguageChange,
  isAsking = false // <-- Add this prop
}) => {
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [recognitionLanguage, setRecognitionLanguage] = useState('en-IN');
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);

  const startRecognition = useCallback(() => {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
      recognition.continuous = false;
      recognition.lang = recognitionLanguage;
      recognition.interimResults = false;
      recognition.maxAlternatives = 10;

      recognition.onstart = function () {
        setIsRecognizing(true);
        console.log('Voice recognition started. Try speaking into the microphone.');
      };

      let finalTranscript = '';

      recognition.onresult = function (event) {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript = event.results[i][0].transcript;
            console.log("transcript:", finalTranscript);
          }
        }

        if (finalTranscript) {
          setMessage(currentMessage => currentMessage ? `${currentMessage} ${finalTranscript}` : finalTranscript);
        }
      };

      recognition.onerror = function (event) {
        setIsRecognizing(false);
        console.error('Recognition error:', event.error);
        if (event.error === 'network') {
          alert('Network error. Please check your internet connection and try again.');
        } else {
          alert('Recognition error. Please try again.');
        }
      };

      recognition.onend = function () {
        setIsRecognizing(false);
        console.log('Voice recognition ended.');
      };

      recognition.start();
    } else {
      console.error('Speech recognition not supported in this browser.');
      alert('Speech recognition not supported in this browser.');
    }
  }, [recognitionLanguage, setMessage]);

  const handleLanguageSelect = useCallback((code) => {
    setRecognitionLanguage(code);
    setShowLanguageSelector(false);
    // Notify parent component of language change
    if (onLanguageChange) {
      onLanguageChange(code);
    }
  }, [onLanguageChange]);

  const toggleLanguageSelector = useCallback(() => {
    setShowLanguageSelector(prev => !prev);
  }, []);

  return (
    <div className="bottom-chat-container">
      <div className="bottom-chat-input-wrapper">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={onKeyPress}
          placeholder={placeholder}
          className="bottom-chat-input"
          rows="1"
          disabled={disabled}
        />
        
        {/* Language selector button */}
        <button 
          className="language-button" 
          onClick={toggleLanguageSelector}
          disabled={disabled || isRecognizing}
          title="Select language"
        >
          <Languages className="language-icon" />
        </button>
        
        {/* Mic button */}
        <button 
          className={`mic-button ${isRecognizing ? 'recording' : ''}`}
          onClick={startRecognition}
          disabled={disabled || isRecognizing}
          title={isRecognizing ? "Recording..." : "Start voice input"}
        >
          {isRecognizing ? <MicOff className="mic-icon" /> : <Mic className="mic-icon" />}
        </button>
        
        {/* Show spinner instead of send button when asking */}
        {isAsking ? (
          <div className="bottom-send-button" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="loading-spinner" style={{ width: 20, height: 20, borderWidth: 3 }}></div>
          </div>
        ) : (
          <button
            onClick={onSendMessage}
            className="bottom-send-button"
            disabled={disabled || !message.trim()}
          >
            <Send className="send-icon" />
          </button>
        )}
      </div>

      {/* Language selector dropdown */}
      {showLanguageSelector && (
        <div className="language-selector-dropdown">
          <p className="language-selector-title">Select voice recognition language:</p>
          <div className="language-options-grid">
            {languageOptions.map(lang => (
              <button
                key={lang.code}
                className={`language-option ${recognitionLanguage === lang.code ? 'active' : ''}`}
                onClick={() => handleLanguageSelect(lang.code)}
              >
                {lang.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recording status */}
      {isRecognizing && (
        <div className="recording-status">
          <div className="recording-indicator">
            <span className="recording-dot"></span>
            <span className="recording-text">
              Listening... Speak now in {languageOptions.find(l => l.code === recognitionLanguage)?.name || 'selected language'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default BottomChatInput;