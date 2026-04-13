import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Bot, Check, Copy, User } from 'lucide-react';

export function MessageBubble({ message }) {
  const isAI = message.role === 'ai';
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`group w-full px-4 py-4 animate-fade-in ${isAI ? 'bg-muted/35' : ''}`}>
      <div className="mx-auto flex max-w-4xl gap-4">
        <div className="mt-0.5">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-full border ${
              isAI
                ? 'border-primary/15 bg-accent text-accent-foreground'
                : 'border-border bg-card text-foreground'
            }`}
          >
            {isAI ? <Bot size={16} /> : <User size={16} />}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{isAI ? 'Miety AI' : 'You'}</span>
            <span className="text-xs text-muted-foreground">{formatTime(message.timestamp)}</span>
          </div>

          <div className="prose prose-sm max-w-none text-foreground leading-relaxed prose-p:my-1 prose-headings:mb-2 prose-headings:mt-3 prose-headings:font-semibold prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-pre:border prose-pre:border-border prose-pre:bg-card prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-a:text-primary prose-a:no-underline hover:prose-a:underline">
            {isAI ? (
              <ReactMarkdown
                components={{
                  code({ inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline && match ? (
                      <SyntaxHighlighter
                        {...props}
                        children={String(children).replace(/\n$/, '')}
                        style={vscDarkPlus}
                        language={match[1]}
                        PreTag="div"
                        wrapLines
                        wrapLongLines
                        customStyle={{
                          margin: '0.5rem 0',
                          padding: '1rem',
                          borderRadius: '0.9rem',
                          background: 'rgba(226, 232, 240, 0.65)',
                          fontSize: '0.875rem',
                        }}
                      />
                    ) : (
                      <code {...props} className={className}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            ) : (
              <div className="whitespace-pre-wrap text-sm leading-6">{message.content}</div>
            )}
          </div>

          {isAI ? (
            <button
              type="button"
              onClick={handleCopy}
              className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
            >
              {copied ? (
                <>
                  <Check size={14} className="text-primary" />
                  <span className="text-primary">Copied</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy response</span>
                </>
              )}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function formatTime(timestamp) {
  if (!timestamp) {
    return '';
  }

  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
