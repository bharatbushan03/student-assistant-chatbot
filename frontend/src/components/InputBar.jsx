import React, { useEffect, useRef, useState } from 'react';
import { Paperclip, Send, X } from 'lucide-react';

export function InputBar({
  onSendMessage,
  isProcessing,
  placeholder = 'Ask me anything about MIET...',
  helperText = '',
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

  const handleSend = () => {
    if (!input.trim() || isProcessing) {
      return;
    }

    const result = onSendMessage(input.trim());
    if (result === false) {
      return;
    }

    if (result && typeof result.then === 'function') {
      result.catch(() => {});
    }

    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
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
    <div className="w-full">
      <div className="panel-card overflow-hidden p-2">
        <div className="flex items-end gap-2 rounded-[1.25rem] bg-muted/45 p-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="min-h-[52px] max-h-48 flex-1 resize-none bg-transparent px-3 py-3 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
            rows={1}
            disabled={isProcessing}
          />

          {onFilesSelected ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-card text-muted-foreground hover:bg-background hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Attach files"
              title="Attach files"
            >
              <Paperclip size={18} />
            </button>
          ) : null}

          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || isProcessing}
            className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${
              input.trim() && !isProcessing
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-muted-foreground'
            }`}
            aria-label="Send message"
          >
            {isProcessing ? (
              <div className="flex items-center gap-1">
                <div className="h-1.5 w-1.5 rounded-full bg-current typing-dot" />
                <div className="h-1.5 w-1.5 rounded-full bg-current typing-dot" />
                <div className="h-1.5 w-1.5 rounded-full bg-current typing-dot" />
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
      </div>

      {helperText ? (
        <p className="mt-2 px-1 text-xs text-muted-foreground">{helperText}</p>
      ) : null}

      {normalizedFiles.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {normalizedFiles.map((file) => (
            <span
              key={file.id}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground"
            >
              <span className="max-w-[180px] truncate" title={file.name}>
                {file.name}
              </span>

              {onRemoveSelectedFile ? (
                <button
                  type="button"
                  onClick={() => onRemoveSelectedFile(file.raw || file)}
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={`Remove ${file.name}`}
                >
                  <X size={11} />
                </button>
              ) : null}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
