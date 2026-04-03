import React from 'react';
import { Plus, MessageSquare, Trash2, X } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
      <div 
        className={twMerge(
          "fixed inset-y-0 left-0 z-30 w-64 bg-secondary text-secondary-foreground border-r border-border transition-transform duration-300 flex flex-col md:translate-x-0 md:static",
          !isOpen && "-translate-x-full hidden md:flex md:w-0 md:border-none md:overflow-hidden md:p-0"
        )}
      >
        <div className={clsx("p-4 flex-none", !isOpen && "md:hidden")}>
          <button
            onClick={onNewChat}
            className="flex items-center gap-2 w-full px-4 py-3 bg-background hover:bg-muted text-foreground border border-border rounded-lg transition-colors font-medium text-sm shadow-sm"
          >
            <Plus size={18} />
            <span>New Chat</span>
          </button>
        </div>
        
        <div className={clsx("flex-1 overflow-y-auto px-3 space-y-1 pb-4", !isOpen && "md:hidden")}>
          <div className="text-xs font-semibold text-muted-foreground mb-3 px-2 mt-2 uppercase tracking-wider">
            Recent
          </div>
          {chats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => onSelectChat(chat.id)}
              className={twMerge(
                "group flex items-center justify-between px-3 py-2.5 rounded-md cursor-pointer transition-colors text-sm",
                activeChatId === chat.id 
                  ? "bg-accent text-accent-foreground font-medium" 
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <MessageSquare size={16} className="shrink-0" />
                <span className="truncate">{chat.title}</span>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteChat(chat.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-opacity"
                aria-label="Delete chat"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {chats.length === 0 && (
            <div className="text-center text-sm text-muted-foreground p-4">
              No chats yet
            </div>
          )}
        </div>
        
        {/* Mobile close button inside sidebar */}
        <button 
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-[-48px] p-2 bg-background border border-border rounded-md text-foreground md:hidden"
        >
          <X size={20} />
        </button>
      </div>
    </>
  );
}
