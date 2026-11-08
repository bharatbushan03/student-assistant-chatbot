import React, { useEffect, useRef } from 'react';
import { Bot } from 'lucide-react';
import { MessageBubble } from './MessageBubble';

const STARTERS = [
  'What documents do I need for semester registration?',
  'Explain this topic in simple steps',
  'Help me outline a project report',
];

export function ChatWindow({ messages, isProcessing, onUsePrompt }) {
  const endOfMessagesRef = useRef(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  if (messages.length === 0 && !isProcessing) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-2xl text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Bot size={26} />
          </div>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">What do you want to work on?</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
            Ask about classes, paste notes, or pick up an earlier chat from the sidebar.
          </p>
          <div className="mt-8 grid gap-4 text-left sm:grid-cols-3">
            {STARTERS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => onUsePrompt?.(prompt)}
                className="rounded-xl border border-border bg-card px-4 py-4 text-sm leading-6 text-foreground hover:border-primary hover:bg-accent"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto py-3">
      <div className="flex flex-col gap-4 px-3 py-4">
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
