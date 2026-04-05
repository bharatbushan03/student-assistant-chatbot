import React from 'react';
import { Plus, MessageSquare, Trash2, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

export function Sidebar({
  isOpen,
  setIsOpen,
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const isGroupView = location.pathname.startsWith('/groups');

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 animate-fade-in bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-30
          flex w-72 flex-col overflow-hidden border-r border-border/80 bg-card/95 backdrop-blur-xl
          transition-all duration-300 ease-in-out md:static md:flex md:translate-x-0 md:duration-200
          ${isOpen
            ? 'translate-x-0 md:w-72'
            : '-translate-x-full md:w-0 md:border-r-0'}
        `}
      >
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              type="button"
              onClick={() => {
                navigate('/');
                if (window.innerWidth < 768) {
                  setIsOpen(false);
                }
              }}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                !isGroupView
                  ? 'bg-foreground text-background'
                  : 'bg-muted text-foreground hover:bg-muted/80'
              }`}
            >
              Chats
            </button>
            <button
              type="button"
              onClick={() => {
                navigate('/groups');
                if (window.innerWidth < 768) {
                  setIsOpen(false);
                }
              }}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isGroupView
                  ? 'bg-foreground text-background'
                  : 'bg-muted text-foreground hover:bg-muted/80'
              }`}
            >
              Groups
            </button>
          </div>

          <button
            onClick={onNewChat}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5
              bg-primary text-primary-foreground rounded-lg
              hover:bg-primary/90 transition-colors
              font-medium text-sm shadow-sm"
          >
            <Plus size={18} />
            <span>New Chat</span>
          </button>
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Recent Chats
          </div>
          {chats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => onSelectChat(chat.id)}
              className={`
                group flex items-center justify-between
                px-3 py-2.5 rounded-lg cursor-pointer border
                transition-all text-sm
                ${activeChatId === chat.id
                  ? 'border-foreground/20 bg-foreground/[0.06] text-foreground font-medium shadow-sm'
                  : 'border-transparent text-muted-foreground hover:bg-muted/70 hover:text-foreground'
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
                  p-1 rounded-md hover:bg-destructive/10 hover:text-destructive
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
          <p className="text-center text-xs tracking-wide text-muted-foreground">
            Miety AI - Your Study Assistant
          </p>
        </div>

        {/* Mobile close button */}
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="absolute top-3 right-3 p-1.5
            z-40 rounded-md text-muted-foreground hover:bg-muted
            md:hidden"
          aria-label="Close sidebar"
        >
          <X size={18} />
        </button>
      </aside>
    </>
  );
}
