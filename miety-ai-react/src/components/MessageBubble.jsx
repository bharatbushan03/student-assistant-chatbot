import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, User, Bot } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

export function MessageBubble({ message }) {
  const isAI = message.role === 'ai';
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={twMerge(
      "w-full py-6 px-4 animate-fade-in group",
      isAI ? "bg-muted/30" : "bg-transparent"
    )}>
      <div className="max-w-4xl mx-auto flex gap-4 md:gap-6">
        {/* Avatar */}
        <div className="flex-none mt-1">
          <div className={twMerge(
            "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
            isAI ? "bg-primary text-primary-foreground" : "bg-secondary border border-border text-foreground"
          )}>
            {isAI ? <Bot size={18} /> : <User size={18} />}
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-hidden min-w-0">
          <div className="font-semibold mb-1 text-sm">
            {isAI ? "Miety AI" : "You"}
          </div>
          <div className="prose dark:prose-invert max-w-none text-foreground prose-p:leading-relaxed prose-pre:p-0">
            {isAI ? (
              <ReactMarkdown
                components={{
                  code({node, inline, className, children, ...props}) {
                    const match = /language-(\w+)/.exec(className || '')
                    return !inline && match ? (
                      <SyntaxHighlighter
                        {...props}
                        children={String(children).replace(/\n$/, '')}
                        style={vscDarkPlus}
                        language={match[1]}
                        PreTag="div"
                        wrapLines={true}
                        wrapLongLines={true}
                        customStyle={{ margin: 0, padding: '1rem', borderRadius: '0.5rem', background: '#1e1e1e' }}
                      />
                    ) : (
                      <code {...props} className={className}>
                        {children}
                      </code>
                    )
                  }
                }}
              >
                {message.content}
              </ReactMarkdown>
            ) : (
              <div className="whitespace-pre-wrap">{message.content}</div>
            )}
            
            {/* Copy button */}
            {isAI && (
              <div className="mt-2 flex opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors p-1"
                >
                  {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
