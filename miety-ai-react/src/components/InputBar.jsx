import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip } from 'lucide-react';

export function InputBar({ onSendMessage, isProcessing }) {
  const [input, setInput] = useState('');
  const textareaRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (input.trim() && !isProcessing) {
      onSendMessage(input.trim());
      setInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'; // Reset height
      }
    }
  };

  return (
    <div className="flex-none p-4 w-full max-w-4xl mx-auto">
      <div className="relative flex items-end grow bg-background border border-border shadow-sm rounded-xl overflow-hidden focus-within:ring-1 focus-within:ring-ring focus-within:border-ring transition-all">
        <button 
          className="flex-none p-3 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Attach file"
          disabled={isProcessing}
        >
          <Paperclip size={20} />
        </button>
        
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message Miety AI..."
          className="w-full max-h-48 py-3 px-2 bg-transparent outline-none resize-none text-foreground placeholder:text-muted-foreground"
          rows={1}
          disabled={isProcessing}
        />
        
        <button
          onClick={handleSend}
          disabled={!input.trim() || isProcessing}
          className="flex-none p-2 m-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-50 disabled:bg-muted disabled:text-muted-foreground hover:bg-primary/90 transition-colors"
          aria-label="Send message"
        >
          {isProcessing ? (
            <div className="w-5 h-5 flex items-center justify-center space-x-1">
              <div className="w-1 h-1 bg-current rounded-full typing-dot"></div>
              <div className="w-1 h-1 bg-current rounded-full typing-dot"></div>
              <div className="w-1 h-1 bg-current rounded-full typing-dot"></div>
            </div>
          ) : (
             <Send size={18} />
          )}
        </button>
      </div>
      <div className="text-center mt-2 text-xs text-muted-foreground">
        AI can make mistakes. Please verify important information.
      </div>
    </div>
  );
}
