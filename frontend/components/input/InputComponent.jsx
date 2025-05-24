import React from 'react';
import { Mic, Send } from 'lucide-react';
import './BottomChatInput.css';

const BottomChatInput = ({ 
  message, 
  setMessage, 
  onSendMessage, 
  onKeyPress, 
  placeholder = "Ask about your data..." 
}) => {
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
        />
        <button className="mic-button">
          <Mic className="mic-icon" />
        </button>
        <button
          onClick={onSendMessage}
          disabled={!message.trim()}
          className="bottom-send-button"
        >
          <Send className="send-icon" />
        </button>
      </div>
    </div>
  );
};

export default BottomChatInput;