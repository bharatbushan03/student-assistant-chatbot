import React from 'react';
import { ChevronRight, Download, FolderOpen, Menu, Moon, Settings2, Share2, Sun } from 'lucide-react';

export function ProjectTopbar({
  title,
  subtitle,
  onToggleSidebar,
  onToggleFilesPanel,
  isFilesPanelOpen,
  includeProjectFiles,
  includePreviousChats,
  onToggleIncludeProjectFiles,
  onToggleIncludePreviousChats,
  onExport,
  onShare,
  isDarkMode,
  onToggleDarkMode,
}) {
  return (
    <header className="border-b border-border/80 bg-background/90 px-4 py-3 backdrop-blur">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted md:hidden"
          aria-label="Toggle project sidebar"
        >
          <Menu size={20} />
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold text-foreground">{title || 'Project Workspace'}</h1>
          {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleFilesPanel}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            title="Open project files"
          >
            <FolderOpen size={14} />
            Files
            <ChevronRight size={12} className={`transition-transform ${isFilesPanelOpen ? 'rotate-180' : ''}`} />
          </button>

          <button
            type="button"
            onClick={onToggleDarkMode}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
            Theme
          </button>

          <button
            type="button"
            onClick={onExport}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Download size={14} />
            Export
          </button>

          <button
            type="button"
            onClick={onShare}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Share2 size={14} />
            Share
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-end">
        <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground">
          <Settings2 size={14} className="text-muted-foreground" />
          <label className="inline-flex items-center gap-1">
            <input
              type="checkbox"
              checked={includeProjectFiles}
              onChange={(event) => onToggleIncludeProjectFiles(event.target.checked)}
            />
            Files context
          </label>
          <label className="inline-flex items-center gap-1">
            <input
              type="checkbox"
              checked={includePreviousChats}
              onChange={(event) => onToggleIncludePreviousChats(event.target.checked)}
            />
            Previous chats
          </label>
        </div>
      </div>
    </header>
  );
}