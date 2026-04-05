import React from 'react';
import { Bot, ChevronRight, MessageSquare, Plus, Sparkles, Users, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

function getInitials(name) {
  if (!name) {
    return 'G';
  }

  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function GroupAvatar({ group }) {
  if (group?.avatar_url) {
    return (
      <img
        src={group.avatar_url}
        alt={group.name}
        className="h-11 w-11 rounded-2xl object-cover border border-border"
      />
    );
  }

  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-muted text-sm font-semibold text-foreground">
      {getInitials(group?.name)}
    </div>
  );
}

function GroupListItem({ group, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition-all duration-200 ${
        active
          ? 'border-foreground/20 bg-foreground/[0.06] shadow-sm'
          : 'border-border bg-card/70 hover:border-primary/25 hover:bg-muted/60'
      }`}
    >
      <GroupAvatar group={group} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-foreground">{group.name}</p>
          <ChevronRight size={16} className={`shrink-0 transition-transform ${active ? 'text-primary' : 'text-muted-foreground group-hover:translate-x-0.5'}`} />
        </div>

        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
          {group.description || 'No description provided.'}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
            <Users size={12} />
            {group.member_count ?? 0} members
          </span>
          {group.is_ai_enabled && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-600 dark:text-emerald-400">
              <Bot size={12} />
              AI enabled
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

export function GroupSidebar({
  isOpen,
  setIsOpen,
  groups,
  activeGroupId,
  onSelectGroup,
  onNewGroup,
  isLoading,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const isGroupView = location.pathname.startsWith('/groups');

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-80 flex-col overflow-hidden border-r border-border bg-card/95 backdrop-blur-xl transition-all duration-300 ease-in-out md:static md:flex md:translate-x-0 md:duration-200 ${
          isOpen
            ? 'translate-x-0 md:w-80'
            : '-translate-x-full md:w-0 md:border-r-0'
        }`}
      >
        <div className="border-b border-border p-4">
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              type="button"
              onClick={() => {
                navigate('/');
                if (window.innerWidth < 768) {
                  setIsOpen(false);
                }
              }}
              className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
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
              className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                isGroupView
                  ? 'bg-foreground text-background'
                  : 'bg-muted text-foreground hover:bg-muted/80'
              }`}
            >
              Groups
            </button>
          </div>

          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Group Rooms
              </p>
              <h2 className="mt-1 text-lg font-semibold text-foreground">
                Real-time collaboration
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Organize class conversations, project rooms, and AI-assisted study groups.
              </p>
            </div>
            <div className="rounded-2xl border border-primary/20 bg-primary/12 p-3 text-primary">
              <Sparkles size={18} />
            </div>
          </div>

          <button
            type="button"
            onClick={onNewGroup}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors duration-200 hover:bg-primary/90"
          >
            <Plus size={18} />
            New Group
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <div className="mb-2 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <MessageSquare size={14} />
            Your groups
          </div>

          <div className="space-y-2">
            {isLoading ? (
              <LoadingState />
            ) : groups.length > 0 ? (
              groups.map((group) => (
                <GroupListItem
                  key={group.id}
                  group={group}
                  active={activeGroupId === group.id}
                  onClick={() => onSelectGroup(group.id)}
                />
              ))
            ) : (
              <EmptyGroupsState onNewGroup={onNewGroup} />
            )}
          </div>
        </div>

        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/30 px-4 py-3">
            <div className="rounded-xl border border-primary/20 bg-primary/12 p-2 text-primary">
              <Bot size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">AI in every room</p>
              <p className="text-xs text-muted-foreground">
                Tag the assistant or let auto-response handle routine questions.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="absolute right-3 top-3 z-40 rounded-xl p-2 text-muted-foreground transition-colors hover:bg-muted md:hidden"
          aria-label="Close sidebar"
        >
          <X size={18} />
        </button>
      </aside>
    </>
  );
}

function LoadingState() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="flex animate-pulse items-start gap-3 rounded-2xl border border-border bg-card/70 px-3 py-3"
        >
          <div className="h-11 w-11 rounded-2xl bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/5 rounded-full bg-muted" />
            <div className="h-3 w-4/5 rounded-full bg-muted/80" />
            <div className="flex gap-2 pt-1">
              <div className="h-5 w-20 rounded-full bg-muted/80" />
              <div className="h-5 w-16 rounded-full bg-muted/80" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyGroupsState({ onNewGroup }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-muted/20 p-6 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <MessageSquare size={22} />
      </div>
      <p className="text-sm font-medium text-foreground">No groups yet</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Create a room for your class, project team, or study circle.
      </p>
      <button
        type="button"
        onClick={onNewGroup}
        className="mt-4 inline-flex items-center rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Create the first group
      </button>
    </div>
  );
}
