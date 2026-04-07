import React, { useState, useRef, useEffect } from 'react';
import { Paperclip, Send, X } from 'lucide-react';

export function InputBar({
  onSendMessage,
  isProcessing,
  placeholder = 'Ask me anything about MIET...',
  onInputChange,
  value,
  onValueChange,
  onFilesSelected,
  selectedFiles = [],
  onRemoveSelectedFile,
  accept = '*',
}) {
  const [internalInput, setInternalInput] = useState('');
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const isControlled = typeof value === 'string';
  const input = isControlled ? value : internalInput;

  const setInput = (nextValue) => {
    if (!isControlled) {
      setInternalInput(nextValue);
    }

    if (onValueChange) {
      onValueChange(nextValue);
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  useEffect(() => {
    if (onInputChange) {
      onInputChange(input);
    }
  }, [input, onInputChange]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (input.trim() && !isProcessing) {
      const result = onSendMessage(input.trim());

      if (result === false) {
        return;
      }

      if (result && typeof result.then === 'function') {
        result.catch(() => {
          // The parent component handles send errors.
        });
      }

      setInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const normalizedFiles = (selectedFiles || []).map((file, index) => {
    if (typeof file === 'string') {
      return {
        id: `${file}-${index}`,
        name: file,
      };
    }

    return {
      id: String(file.id || file.name || `file-${index}`),
      name: String(file.name || file.filename || `File ${index + 1}`),
      raw: file,
    };
  });

  const handlePickFiles = (event) => {
    if (!onFilesSelected) {
      return;
    }

    const pickedFiles = Array.from(event.target.files || []);
    if (pickedFiles.length > 0) {
      onFilesSelected(pickedFiles);
    }

    event.target.value = '';
  };

  return (
    <div className="flex-none w-full">
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
          placeholder={placeholder}
          className="flex-1 max-h-48 py-3 px-3 bg-transparent
            outline-none resize-none text-foreground text-sm leading-relaxed
            placeholder:text-muted-foreground"
          rows={1}
          disabled={isProcessing}
        />

        {onFilesSelected ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="flex-none p-2.5 rounded-xl mb-0.5 text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Attach files"
            title="Attach files"
          >
            <Paperclip size={18} />
          </button>
        ) : null}

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

        {onFilesSelected ? (
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            accept={accept}
            onChange={handlePickFiles}
          />
        ) : null}
      </div>

      {normalizedFiles.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {normalizedFiles.map((file) => (
            <span
              key={file.id}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] text-foreground"
            >
              <span className="max-w-[180px] truncate" title={file.name}>{file.name}</span>
              {onRemoveSelectedFile ? (
                <button
                  type="button"
                  onClick={() => onRemoveSelectedFile(file.raw || file)}
                  className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label={`Remove ${file.name}`}
                >
                  <X size={12} />
                </button>
              ) : null}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
