import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Bot, Check, Copy, CornerUpLeft, Paperclip, Pencil, Trash2, User } from 'lucide-react';

import { downloadGroupFile } from '../../utils/groupsApi';

function formatTime(timestamp) {
  if (!timestamp) {
    return '';
  }

  // Backend timestamps can be UTC without a timezone suffix.
  // Treat such values as UTC explicitly, then render in IST.
  const raw = String(timestamp).trim();
  const hasTimezone = /([zZ]|[+-]\d{2}:\d{2})$/.test(raw);
  const normalized = hasTimezone ? raw : `${raw}Z`;
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
}

function getInitials(name) {
  if (!name) {
    return '?';
  }

  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function parseContentDispositionFilename(contentDisposition, fallbackName) {
  const match = /filename="?([^";]+)"?/i.exec(contentDisposition || '');
  if (match && match[1]) {
    return match[1];
  }
  return fallbackName;
}

function triggerBlobDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function ReactionsBar({ reactions }) {
  if (!reactions || reactions.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {reactions.map((reaction) => (
        <span
          key={reaction.emoji}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/70 px-2.5 py-1 text-xs text-muted-foreground"
        >
          <span>{reaction.emoji}</span>
          <span>{reaction.count}</span>
        </span>
      ))}
    </div>
  );
}

export function GroupMessageBubble({
  message,
  currentUserId,
  repliedMessage,
  canEdit,
  canDelete,
  onReply,
  onEdit,
  onDelete,
}) {
  const [copied, setCopied] = useState(false);
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState(null);
  const isAI = message.type === 'ai_response' || message.sender?.id === 'ai-assistant';
  const isCurrentUser = message.sender?.id === currentUserId;

  const attachmentItems = useMemo(() => {
    const attachments = message?.metadata?.attachments;
    if (!Array.isArray(attachments)) {
      return [];
    }

    return attachments.map((item, index) => {
      if (typeof item === 'string') {
        return {
          id: `legacy-${index}`,
          file_id: null,
          filename: item,
          preview_text: '',
        };
      }

      return {
        id: String(item?.id || item?.file_id || `attachment-${index}`),
        file_id: item?.file_id || item?.id || null,
        filename: String(item?.filename || item?.name || `Attachment ${index + 1}`),
        preview_text: String(item?.preview_text || ''),
      };
    });
  }, [message?.metadata?.attachments]);

  const senderLabel = useMemo(() => {
    if (isAI) {
      return 'Miety AI';
    }

    if (isCurrentUser) {
      return 'You';
    }

    return message.sender?.name || 'Unknown member';
  }, [isAI, isCurrentUser, message.sender?.name]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadAttachment = async (attachment) => {
    if (!attachment?.file_id || !message?.group_id) {
      return;
    }

    setDownloadingAttachmentId(attachment.id);

    try {
      const { blob, contentDisposition } = await downloadGroupFile(message.group_id, attachment.file_id);
      const fileName = parseContentDispositionFilename(contentDisposition, attachment.filename || 'attachment');
      triggerBlobDownload(blob, fileName);
    } catch (error) {
      console.error(error);
    } finally {
      setDownloadingAttachmentId(null);
    }
  };

  const avatarNode = message.sender?.avatar_url ? (
    <img
      src={message.sender.avatar_url}
      alt={senderLabel}
      className="h-10 w-10 rounded-full object-cover border border-border"
    />
  ) : (
    <div
      className={`flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold shadow-sm ${
        isAI
          ? 'border-primary/25 bg-primary/12 text-primary'
          : isCurrentUser
            ? 'border-border bg-secondary text-secondary-foreground'
            : 'border-border bg-muted text-foreground'
      }`}
    >
      {isAI ? <Bot size={16} /> : isCurrentUser ? <User size={16} /> : getInitials(message.sender?.name)}
    </div>
  );

  return (
    <div className={`w-full px-4 py-4 ${isAI ? 'border-b border-border/50 bg-muted/20' : ''}`}>
      <div className="mx-auto flex w-full max-w-5xl gap-4">
        <div className="shrink-0">{avatarNode}</div>

        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{senderLabel}</span>
            <span className="text-xs text-muted-foreground">{formatTime(message.created_at)}</span>
            {message.is_edited && <span className="text-[11px] text-muted-foreground">edited</span>}
          </div>

          <div className="prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed prose-p:my-1 prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-pre:bg-muted/60 prose-pre:border prose-pre:border-border prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-a:text-primary prose-a:no-underline hover:prose-a:underline">
            {message.reply_to && repliedMessage && (
              <div className="mb-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs not-prose">
                <p className="font-medium text-muted-foreground">
                  Replying to {repliedMessage.sender?.name || 'Member'}
                </p>
                <p className="mt-0.5 line-clamp-2 text-foreground/90">{repliedMessage.content}</p>
              </div>
            )}

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
                        borderRadius: '0.75rem',
                        background: 'hsl(var(--muted) / 0.6)',
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

            {attachmentItems.length > 0 ? (
              <div className="not-prose mt-3 flex flex-wrap gap-2">
                {attachmentItems.map((attachment) => {
                  const isDownloading = downloadingAttachmentId === attachment.id;
                  const isDownloadable = Boolean(attachment.file_id);

                  return (
                    <button
                      key={attachment.id}
                      type="button"
                      onClick={() => handleDownloadAttachment(attachment)}
                      disabled={!isDownloadable || isDownloading}
                      className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-65"
                      title={isDownloadable ? 'Download file' : 'Attachment info only'}
                    >
                      <Paperclip size={12} />
                      <span className="truncate max-w-[220px]">{attachment.filename}</span>
                      {isDownloading ? <span>...</span> : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <ReactionsBar reactions={message.reactions} />

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
            >
              {copied ? (
                <>
                  <Check size={14} className="text-emerald-500" />
                  <span className="text-emerald-500">Copied</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy</span>
                </>
              )}
            </button>

            {!isAI && (
              <button
                type="button"
                onClick={() => onReply?.(message)}
                className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
              >
                <CornerUpLeft size={14} />
                <span>Reply</span>
              </button>
            )}

            {canEdit && (
              <button
                type="button"
                onClick={() => onEdit?.(message)}
                className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
              >
                <Pencil size={14} />
                <span>Edit</span>
              </button>
            )}

            {canDelete && (
              <button
                type="button"
                onClick={() => onDelete?.(message)}
                className="inline-flex items-center gap-1.5 text-red-500 transition-colors hover:text-red-400"
              >
                <Trash2 size={14} />
                <span>Delete</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
