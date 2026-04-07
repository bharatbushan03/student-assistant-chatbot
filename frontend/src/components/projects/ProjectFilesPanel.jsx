import React from 'react';
import { ExternalLink, FilePlus2, FileText, Trash2, X } from 'lucide-react';

export function ProjectFilesPanel({
  files,
  attachedFileIds,
  onToggleAttach,
  onUploadFiles,
  onDeleteFile,
  onPreviewFile,
  isUploading,
  onClose,
  className = '',
}) {
  return (
    <aside className={`flex h-full w-full flex-col border-border bg-card/50 ${className}`}>
      <div className="border-b border-border p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-muted-foreground" />
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Project Files
            </h3>
          </div>

          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Close files panel"
            >
              <X size={15} />
            </button>
          ) : null}
        </div>

        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90">
          <FilePlus2 size={14} />
          {isUploading ? 'Uploading...' : 'Upload files'}
          <input
            type="file"
            className="hidden"
            multiple
            onChange={(event) => {
              const selected = Array.from(event.target.files || []);
              if (selected.length > 0) {
                onUploadFiles(selected);
              }
              event.target.value = '';
            }}
          />
        </label>

        <p className="mt-2 text-xs text-muted-foreground">
          Supported: PDF, TXT, JSON, CSV, and images.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {files.map((file) => {
          const attached = attachedFileIds.includes(file.id);
          return (
            <div key={file.id} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{file.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size_bytes / 1024).toFixed(1)} KB
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onPreviewFile(file)}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title="Preview file"
                  >
                    <ExternalLink size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteFile(file)}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                    title="Delete file"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <p className="mt-2 text-xs text-muted-foreground">{file.preview_text || 'No preview available.'}</p>

              <label className="mt-3 inline-flex items-center gap-2 text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={attached}
                  onChange={(event) => onToggleAttach(file.id, event.target.checked)}
                />
                Attach to next message
              </label>
            </div>
          );
        })}

        {files.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-xs text-muted-foreground">
            No files uploaded yet for this project.
          </div>
        )}
      </div>
    </aside>
  );
}