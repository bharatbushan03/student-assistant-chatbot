import React, { useRef, useEffect } from 'react';
import { MessageBubble } from './MessageBubble';
import { Bot } from 'lucide-react';

export function ChatWindow({ messages, isProcessing, onSuggestionSelect }) {
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
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 shadow-sm">
          <Bot size={40} className="text-primary" />
        </div>
        <h2 className="text-2xl font-semibold mb-2 text-foreground">
          Welcome to Miety AI
        </h2>
        <p className="text-muted-foreground max-w-md mb-7">
          Ask a question, paste context, or start with a quick prompt below.
        </p>

        {/* Suggestion chips */}
        <div className="flex flex-wrap justify-center gap-2 max-w-2xl">
          <SuggestionChip text="What is the exam schedule this semester?" onClick={onSuggestionSelect} />
          <SuggestionChip text="Tell me today's important campus updates" onClick={onSuggestionSelect} />
          <SuggestionChip text="Help me plan my study week" onClick={onSuggestionSelect} />
          <SuggestionChip text="Summarize assignment tips for me" onClick={onSuggestionSelect} />
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
            <div className="max-w-4xl mx-auto flex gap-5">
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

function SuggestionChip({ text, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(text)}
      className="rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground
        hover:border-primary/30 hover:bg-muted/70 hover:text-foreground
        transition-all duration-200"
    >
      {text}
    </button>
  );
}
