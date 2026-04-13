import React, { useEffect, useRef } from 'react';
import { Bot } from 'lucide-react';
import { MessageBubble } from './MessageBubble';

export function ChatWindow({ messages, isProcessing }) {
  const endOfMessagesRef = useRef(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  if (messages.length === 0 && !isProcessing) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-accent text-accent-foreground">
            <Bot size={28} />
          </div>
          <h2 className="text-2xl font-semibold text-foreground">Start a new conversation</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Ask a question, paste some context, or continue from a previous chat in the sidebar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto py-3">
      <div className="flex flex-col">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {isProcessing ? (
          <div className="w-full px-4 py-6">
            <div className="mx-auto flex max-w-4xl items-center gap-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Bot size={18} />
              </div>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-muted-foreground/45 typing-dot" />
                <div className="h-2 w-2 rounded-full bg-muted-foreground/45 typing-dot" />
                <div className="h-2 w-2 rounded-full bg-muted-foreground/45 typing-dot" />
              </div>
            </div>
          </div>
        ) : null}
      </div>
      <div ref={endOfMessagesRef} />
    </div>
  );
}
