import React from 'react';
import { Plus, MessageSquare, Trash2, X } from 'lucide-react';

export function Sidebar({
  isOpen,
  setIsOpen,
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat
}) {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden animate-fade-in"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-30
          w-72 bg-card border-r border-border
          transition-transform duration-300 ease-in-out
          flex flex-col
          md:translate-x-0 md:static md:flex
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Header */}
        <div className="p-4 border-b border-border">
          <button
            onClick={onNewChat}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5
              bg-primary text-primary-foreground rounded-lg
              hover:bg-primary/90 transition-all
              font-medium text-sm shadow-sm"
          >
            <Plus size={18} />
            <span>New Chat</span>
          </button>
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          <div className="text-xs font-semibold text-muted-foreground mb-2 px-2 uppercase tracking-wider">
            Recent Chats
          </div>
          {chats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => onSelectChat(chat.id)}
              className={`
                group flex items-center justify-between
                px-3 py-2.5 rounded-lg cursor-pointer
                transition-all text-sm
                ${activeChatId === chat.id
                  ? 'bg-accent/50 text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }
              `}
            >
              <div className="flex items-center gap-2.5 overflow-hidden flex-1">
                <MessageSquare size={16} className="shrink-0 opacity-70" />
                <span className="truncate">{chat.title}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteChat(chat.id);
                }}
                className="opacity-0 group-hover:opacity-100
                  p-1 rounded hover:bg-destructive/10 hover:text-destructive
                  transition-all"
                aria-label="Delete chat"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {chats.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8 px-4">
              <MessageSquare size={32} className="mx-auto mb-2 opacity-30" />
              <p>No chats yet</p>
              <p className="text-xs mt-1">Start a conversation!</p>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            Miety AI - Your Study Assistant
          </p>
        </div>

        {/* Mobile close button */}
        <button
          onClick={() => setIsOpen(false)}
          className="absolute top-3 right-3 p-1.5
            rounded-md text-muted-foreground hover:bg-muted
            md:hidden"
          aria-label="Close sidebar"
        >
          <X size={18} />
        </button>
      </aside>
    </>
  );
}
