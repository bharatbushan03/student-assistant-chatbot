import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, User, Bot } from 'lucide-react';

export function MessageBubble({ message }) {
  const isAI = message.role === 'ai';
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`group w-full px-4 py-5 animate-fade-in ${isAI ? 'border-y border-border/40 bg-card/60' : ''}`}>
      <div className="max-w-4xl mx-auto flex gap-4">
        {/* Avatar */}
        <div className="flex-none mt-0.5">
          <div className={`
            w-8 h-8 rounded-full flex items-center justify-center shrink-0 border shadow-sm
            ${isAI
              ? 'border-primary/25 bg-primary/12 text-primary'
              : 'border-border bg-secondary text-secondary-foreground'
            }
          `}>
            {isAI ? <Bot size={16} /> : <User size={16} />}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-semibold text-sm text-foreground">
              {isAI ? 'Miety AI' : 'You'}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatTime(message.timestamp)}
            </span>
          </div>

          <div className={`
            prose prose-sm dark:prose-invert max-w-none
            text-foreground leading-relaxed
            prose-p:my-1 prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-2
            prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5
            prose-pre:bg-muted/50 prose-pre:border prose-pre:border-border
            prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
            prose-a:text-primary prose-a:no-underline hover:prose-a:underline
          `}>
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
                        wrapLines={true}
                        wrapLongLines={true}
                        customStyle={{
                          margin: '0.5rem 0',
                          padding: '1rem',
                          borderRadius: '0.5rem',
                          background: 'hsl(var(--muted) / 0.5)',
                          fontSize: '0.875rem'
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
              <div className="whitespace-pre-wrap">{message.content}</div>
            )}
          </div>

          {/* Copy button for AI messages */}
          {isAI && (
            <button
              onClick={handleCopy}
              className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground
                opacity-0 group-hover:opacity-100 hover:text-foreground
                transition-all duration-200"
            >
              {copied ? (
                <>
                  <Check size={14} className="text-green-500" />
                  <span className="text-green-500">Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy response</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}
