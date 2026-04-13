import React from 'react';
import { ChevronRight, Download, FolderOpen, Menu, Settings2, Share2 } from 'lucide-react';

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
}) {
  return (
    <header className="border-b border-border bg-background px-4 py-3 md:px-5">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground hover:bg-muted md:hidden"
          aria-label="Toggle project sidebar"
        >
          <Menu size={18} />
        </button>

        <div className="min-w-0 flex-1">
          <p className="section-label">Project</p>
          <h1 className="truncate text-lg font-semibold text-foreground">{title || 'Project Workspace'}</h1>
          {subtitle ? <p className="truncate text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleFilesPanel}
            className="secondary-button gap-2 !rounded-2xl !px-3 !py-2 text-xs"
            title="Open project files"
          >
            <FolderOpen size={14} />
            Files
            <ChevronRight size={12} className={`transition-transform ${isFilesPanelOpen ? 'rotate-90' : ''}`} />
          </button>

          <button
            type="button"
            onClick={onExport}
            className="secondary-button gap-2 !rounded-2xl !px-3 !py-2 text-xs"
          >
            <Download size={14} />
            Export
          </button>

          <button
            type="button"
            onClick={onShare}
            className="secondary-button gap-2 !rounded-2xl !px-3 !py-2 text-xs"
          >
            <Share2 size={14} />
            Share
          </button>
        </div>
      </div>

      <div className="mt-3 rounded-[1.5rem] border border-border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center gap-3 text-sm text-foreground">
          <div className="inline-flex items-center gap-2 text-muted-foreground">
            <Settings2 size={14} />
            Context
          </div>

          <label className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5">
            <input
              type="checkbox"
              checked={includeProjectFiles}
              onChange={(event) => onToggleIncludeProjectFiles(event.target.checked)}
            />
            Files
          </label>

          <label className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5">
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
