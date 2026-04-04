import React, { useRef, useEffect } from 'react';
import { MessageBubble } from './MessageBubble';
import { Bot } from 'lucide-react';

export function ChatWindow({ messages, isProcessing }) {
  const endOfMessagesRef = useRef(null);

  const scrollToBottom = () => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isProcessing]);

  if (messages.length === 0 && !isProcessing) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-fade-in">
        <div className="w-20 h-20 bg-gradient-to-br from-primary/20 to-accent/20 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
          <Bot size={40} className="text-primary" />
        </div>
        <h2 className="text-2xl font-semibold mb-2 text-foreground">
          Welcome to Miety AI
        </h2>
        <p className="text-muted-foreground max-w-md mb-8">
          Your intelligent study assistant for MIET Jammu.
          Ask me anything about your courses, assignments, or campus life.
        </p>

        {/* Suggestion chips */}
        <div className="flex flex-wrap justify-center gap-2 max-w-2xl">
          <SuggestionChip text="What is the exam schedule?" />
          <SuggestionChip text="Tell me about library hours" />
          <SuggestionChip text="How do I register for courses?" />
          <SuggestionChip text="Campus facilities overview" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto scroll-smooth">
      <div className="flex flex-col pb-4">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {isProcessing && (
          <div className="w-full py-6 px-4 animate-fade-in">
            <div className="max-w-4xl mx-auto flex gap-6">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot size={18} className="text-primary" />
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-muted-foreground/40 rounded-full typing-dot" />
                <div className="w-2 h-2 bg-muted-foreground/40 rounded-full typing-dot" style={{ animationDelay: '0.2s' }} />
                <div className="w-2 h-2 bg-muted-foreground/40 rounded-full typing-dot" style={{ animationDelay: '0.4s' }} />
              </div>
            </div>
          </div>
        )}
      </div>
      <div ref={endOfMessagesRef} />
    </div>
  );
}

function SuggestionChip({ text }) {
  return (
    <button
      className="px-4 py-2 text-sm bg-muted/50 border border-border
        rounded-full text-muted-foreground
        hover:bg-muted hover:text-foreground hover:border-primary/50
        transition-all duration-200"
    >
      {text}
    </button>
  );
}
