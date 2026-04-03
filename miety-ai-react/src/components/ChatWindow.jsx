import React, { useRef, useEffect } from 'react';
import { MessageBubble } from './MessageBubble';

export function ChatWindow({ messages, isProcessing }) {
  const endOfMessagesRef = useRef(null);

  const scrollToBottom = () => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Scroll when messages change or typing begins
  useEffect(() => {
    scrollToBottom();
  }, [messages, isProcessing]);

  if (messages.length === 0 && !isProcessing) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-fade-in">
        <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6 shadow-sm">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h2 className="text-2xl font-semibold mb-2">Welcome to Miety AI</h2>
        <p className="text-muted-foreground max-w-md">
          I'm an AI assistant designed to help with coding, writing, and analysis. How can I help you today?
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto scroll-smooth">
      <div className="flex flex-col pb-4">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </div>
      <div ref={endOfMessagesRef} />
    </div>
  );
}
