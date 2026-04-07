import React from 'react';
import {
  AudioLines,
  Braces,
  FileImage,
  FileText,
  Sparkles,
  Table2,
  UploadCloud,
} from 'lucide-react';

function CardShell({ icon, title, subtitle, children }) {
  const CardIcon = icon;

  return (
    <section className="glass-panel rounded-2xl border border-white/10 bg-slate-950/55 p-4 shadow-[0_20px_45px_rgba(2,6,23,0.45)] backdrop-blur-xl">
      <div className="mb-3 flex items-start gap-3">
        <div className="mt-0.5 rounded-xl border border-white/10 bg-slate-900/70 p-2 text-sky-200">
          <CardIcon size={15} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
          <p className="text-xs text-slate-400">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function CodeSurface({ codeSnippet }) {
  const lines = codeSnippet
    .split('\n')
    .slice(0, 12)
    .filter(Boolean);

  if (lines.length === 0) {
    return null;
  }

  return (
    <CardShell
      icon={Braces}
      title="Auto Code Surface"
      subtitle="Code syntax detected from your prompt"
    >
      <div className="max-h-56 overflow-auto rounded-xl border border-white/10 bg-[#0a1022] p-3 font-mono text-xs text-slate-100">
        {lines.map((line, index) => (
          <div key={`${line}-${index}`} className="grid grid-cols-[28px_1fr] gap-2">
            <span className="text-right text-slate-500">{index + 1}</span>
            <span className="whitespace-pre-wrap break-words text-slate-200">{line}</span>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

function DataSurface({ csvRows }) {
  if (!csvRows || csvRows.length === 0) {
    return null;
  }

  const [headers, ...rows] = csvRows;

  return (
    <CardShell
      icon={Table2}
      title="Smart Data Grid"
      subtitle="Tabular data was detected and structured"
    >
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-950/70">
        <table className="min-w-full divide-y divide-white/10 text-xs">
          <thead className="bg-slate-900/70">
            <tr>
              {headers.map((header, index) => (
                <th
                  key={`${header}-${index}`}
                  className="px-3 py-2 text-left font-semibold text-slate-200"
                >
                  {header || `Column ${index + 1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.slice(0, 5).map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-white/[0.03]">
                {headers.map((_, cellIndex) => (
                  <td key={`${rowIndex}-${cellIndex}`} className="px-3 py-2 text-slate-300">
                    {row[cellIndex] || '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CardShell>
  );
}

function ImageSurface({ imagePrompt }) {
  if (!imagePrompt) {
    return null;
  }

  return (
    <CardShell
      icon={FileImage}
      title="Image Prompt Canvas"
      subtitle="Visual generation mode is active"
    >
      <div className="relative overflow-hidden rounded-xl border border-fuchsia-300/20 bg-gradient-to-br from-slate-950 via-indigo-950/45 to-fuchsia-950/35 p-4">
        <div className="absolute -left-12 top-2 h-24 w-24 rounded-full bg-sky-400/20 blur-2xl" />
        <div className="absolute right-0 top-10 h-20 w-20 rounded-full bg-violet-400/20 blur-2xl" />
        <p className="relative text-xs leading-5 text-slate-200">{imagePrompt.slice(0, 190)}</p>
        <button
          type="button"
          className="relative mt-4 inline-flex items-center gap-2 rounded-full border border-sky-300/25 bg-slate-900/70 px-3 py-1.5 text-xs font-medium text-sky-200 transition hover:border-sky-300/45 hover:bg-slate-900"
        >
          <Sparkles size={13} />
          Generate Visual Draft
        </button>
      </div>
    </CardShell>
  );
}

function DocsSurface({ outline }) {
  if (!outline || outline.length === 0) {
    return null;
  }

  return (
    <CardShell
      icon={FileText}
      title="Structured Document Viewer"
      subtitle="Detected headings and reading flow"
    >
      <div className="space-y-2 rounded-xl border border-white/10 bg-slate-900/45 p-3">
        {outline.map((item, index) => (
          <div
            key={`${item}-${index}`}
            className="rounded-lg border border-white/10 bg-slate-950/55 px-3 py-2 text-xs text-slate-200"
          >
            {index + 1}. {item}
          </div>
        ))}
      </div>
    </CardShell>
  );
}

function VoiceSurface() {
  return (
    <CardShell
      icon={AudioLines}
      title="Voice Interaction"
      subtitle="Audio capture and playback controls are ready"
    >
      <div className="rounded-xl border border-white/10 bg-slate-900/45 px-3 py-3">
        <div className="mb-3 flex items-center gap-1">
          {Array.from({ length: 24 }).map((_, index) => (
            <div
              key={index}
              className="voice-bar"
              style={{
                animationDelay: `${index * 60}ms`,
              }}
            />
          ))}
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-sky-300/25 bg-slate-950/75 px-3 py-1.5 text-xs text-sky-200 transition hover:border-sky-300/40"
        >
          <AudioLines size={13} />
          Start Voice Capture
        </button>
      </div>
    </CardShell>
  );
}

function UploadSurface() {
  return (
    <CardShell
      icon={UploadCloud}
      title="Context File Drop"
      subtitle="Upload docs, code, media, or datasets"
    >
      <div className="rounded-xl border border-dashed border-sky-300/35 bg-sky-500/5 p-4 text-center">
        <p className="text-xs text-slate-300">Drop files here or click to browse</p>
        <p className="mt-1 text-[11px] text-slate-500">PDF, CSV, PNG, ZIP, or source files</p>
      </div>
    </CardShell>
  );
}

export function AdaptiveToolDeck({ detection }) {
  const tools = detection?.activeTools || [];
  const toolIds = new Set(tools.map((tool) => tool.id));
  const preview = detection?.preview || {};

  if (tools.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-3 pb-2 md:grid-cols-2">
      {toolIds.has('code_editor') ? <CodeSurface codeSnippet={preview.codeSnippet || ''} /> : null}
      {toolIds.has('data_grid') ? <DataSurface csvRows={preview.csvRows || []} /> : null}
      {toolIds.has('image_canvas') ? <ImageSurface imagePrompt={preview.imagePrompt || ''} /> : null}
      {toolIds.has('docs_viewer') ? <DocsSurface outline={preview.documentOutline || []} /> : null}
      {toolIds.has('voice_tools') ? <VoiceSurface /> : null}
      {toolIds.has('file_upload') ? <UploadSurface /> : null}
    </div>
  );
}
