import React, { useEffect, useMemo, useRef } from 'react';
import { Bot, FileText, User } from 'lucide-react';

import { InputBar } from '../InputBar';

function MessageCard({ message }) {
  const isAssistant = message.role === 'assistant';

  return (
    <div className={`w-full px-4 py-4 ${isAssistant ? 'bg-muted/30' : 'bg-transparent'}`}>
      <div className="mx-auto max-w-4xl">
        <div className="flex items-start gap-3">
          <div className={`mt-1 rounded-lg border p-2 ${isAssistant ? 'border-primary/20 bg-primary/10 text-primary' : 'border-border bg-card text-foreground'}`}>
            {isAssistant ? <Bot size={16} /> : <User size={16} />}
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {isAssistant ? 'Assistant' : 'You'}
            </div>
            <div className="whitespace-pre-wrap text-sm leading-6 text-foreground">{message.content}</div>

            {Array.isArray(message.citations) && message.citations.length > 0 && (
              <div className="rounded-lg border border-border bg-card/70 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Context Sources
                </p>
                <div className="space-y-2">
                  {message.citations.map((citation) => (
                    <div key={`${message.id}-${citation.file_id}`} className="rounded-md bg-muted/60 p-2 text-xs">
                      <div className="flex items-center gap-1 font-medium text-foreground">
                        <FileText size={12} />
                        {citation.filename}
                      </div>
                      <p className="mt-1 text-muted-foreground">{citation.snippet}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProjectChatPanel({
  messages,
  isStreaming,
  onSendMessage,
  selectedFileNames,
  disabled,
  onFilesSelected,
  selectedFiles,
  onRemoveSelectedFile,
}) {
  const endRef = useRef(null);

  const filesHelper = useMemo(() => {
    if (!selectedFileNames || selectedFileNames.length === 0) {
      return '';
    }
    return `Attached: ${selectedFileNames.join(', ')}`;
  }, [selectedFileNames]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  return (
    <section className="flex min-h-0 flex-1 flex-col border-r border-border">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <div className="mb-3 rounded-2xl border border-primary/20 bg-primary/10 p-3 text-primary">
              <Bot size={22} />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Start a project conversation</h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Ask questions, attach files, and keep project context isolated from your other chats.
            </p>
          </div>
        ) : (
          <>
            {messages.map((message) => <MessageCard key={message.id} message={message} />)}
            <div ref={endRef} />
          </>
        )}
      </div>

      <div className="border-t border-border bg-background/95">
        <InputBar
          onSendMessage={onSendMessage}
          isProcessing={isStreaming || disabled}
          placeholder="Message this project workspace..."
          helperText={filesHelper}
          onFilesSelected={onFilesSelected}
          selectedFiles={selectedFiles}
          onRemoveSelectedFile={onRemoveSelectedFile}
        />
      </div>
    </section>
  );
}