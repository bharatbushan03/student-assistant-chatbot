import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles } from 'lucide-react';

export function InputBar({ onSendMessage, isProcessing }) {
  const [input, setInput] = useState('');
  const textareaRef = useRef(null);

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
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  return (
    <div className="flex-none p-4 w-full max-w-3xl mx-auto">
      <div className="relative flex items-end gap-2
        bg-background border border-border rounded-2xl
        shadow-sm hover:shadow-md transition-all duration-200
        focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary
        overflow-hidden p-2">

        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask me anything about MIET..."
          className="flex-1 max-h-48 py-3 px-3 bg-transparent
            outline-none resize-none text-foreground text-sm leading-relaxed
            placeholder:text-muted-foreground"
          rows={1}
          disabled={isProcessing}
        />

        <button
          onClick={handleSend}
          disabled={!input.trim() || isProcessing}
          className={`
            flex-none p-2.5 rounded-xl mb-0.5
            transition-all duration-200
            ${input.trim() && !isProcessing
              ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
            }
          `}
          aria-label="Send message"
        >
          {isProcessing ? (
            <div className="w-5 h-5 flex items-center justify-center gap-0.5">
              <div className="w-1 h-1 bg-current rounded-full typing-dot" />
              <div className="w-1 h-1 bg-current rounded-full typing-dot" style={{ animationDelay: '0.2s' }} />
              <div className="w-1 h-1 bg-current rounded-full typing-dot" style={{ animationDelay: '0.4s' }} />
            </div>
          ) : (
            <Send size={18} />
          )}
        </button>
      </div>

      <div className="flex items-center justify-center gap-2 mt-3 text-xs text-muted-foreground">
        <Sparkles size={12} className="opacity-50" />
        <span>AI-powered study assistant for MIET Jammu students</span>
      </div>
    </div>
  );
}
