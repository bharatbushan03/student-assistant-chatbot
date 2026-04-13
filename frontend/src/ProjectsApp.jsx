import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';

import { ProjectChatPanel } from './components/projects/ProjectChatPanel';
import { ProjectFilesPanel } from './components/projects/ProjectFilesPanel';
import { ProjectsSidebar } from './components/projects/ProjectsSidebar';
import { ProjectTopbar } from './components/projects/ProjectTopbar';
import {
  createProject,
  createProjectChat,
  deleteProject,
  deleteProjectChat,
  deleteProjectFile,
  downloadProjectFile,
  exportProjectChat,
  listProjectChats,
  listProjectFiles,
  listProjectMessages,
  listProjects,
  shareProject,
  streamProjectResponse,
  updateProject,
  updateProjectChat,
  uploadProjectFiles,
} from './utils/projectsApi';

const SIDEBAR_STATE_KEY = 'miety-sidebar-open-desktop';

function getInitialSidebarOpen() {
  if (typeof window === 'undefined') {
    return true;
  }

  const savedState = localStorage.getItem(SIDEBAR_STATE_KEY);
  if (savedState !== null) {
    return savedState === 'true';
  }

  return window.innerWidth >= 768;
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

function openBlobInNewTab(blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function getUploadKey(file) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

export default function ProjectsApp() {
  const navigate = useNavigate();
  const { projectId: routeProjectId, chatId: routeChatId } = useParams();

  const [isSidebarOpen, setIsSidebarOpen] = useState(() => getInitialSidebarOpen());

  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [files, setFiles] = useState([]);
  const [attachedFileIds, setAttachedFileIds] = useState([]);

  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isFilesPanelOpen, setIsFilesPanelOpen] = useState(false);

  const [includeProjectFiles, setIncludeProjectFiles] = useState(true);
  const [includePreviousChats, setIncludePreviousChats] = useState(false);

  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) || null,
    [projects, activeProjectId]
  );

  const attachedFileNames = useMemo(() => {
    const attachedSet = new Set(attachedFileIds);
    return files.filter((file) => attachedSet.has(file.id)).map((file) => file.filename);
  }, [files, attachedFileIds]);

  const attachedFilesForComposer = useMemo(() => {
    const attachedSet = new Set(attachedFileIds);
    return files
      .filter((file) => attachedSet.has(file.id))
      .map((file) => ({ id: file.id, name: file.filename }));
  }, [files, attachedFileIds]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      localStorage.setItem(SIDEBAR_STATE_KEY, String(isSidebarOpen));
    }
  }, [isSidebarOpen]);

  useEffect(() => {
    if (!activeProject?.settings) {
      return;
    }

    setIncludeProjectFiles(Boolean(activeProject.settings.include_project_files));
    setIncludePreviousChats(Boolean(activeProject.settings.include_previous_chats));
  }, [activeProject]);

  const loadProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const data = await listProjects();
      setProjects(data);

      let nextProjectId = null;
      if (routeProjectId && data.some((project) => project.id === routeProjectId)) {
        nextProjectId = routeProjectId;
      } else if (activeProjectId && data.some((project) => project.id === activeProjectId)) {
        nextProjectId = activeProjectId;
      } else if (data.length > 0) {
        nextProjectId = data[0].id;
      }

      setActiveProjectId(nextProjectId);

      if (nextProjectId) {
        navigate(`/projects/${nextProjectId}`, { replace: true });
      } else {
        navigate('/projects', { replace: true });
        setChats([]);
        setMessages([]);
        setFiles([]);
        setActiveChatId(null);
      }
    } catch (error) {
      setStatusMessage({
        type: 'error',
        text: error.response?.data?.detail || 'Unable to load projects right now.',
      });
    } finally {
      setLoadingProjects(false);
    }
  }, [activeProjectId, navigate, routeProjectId]);

  const loadChats = useCallback(
    async (projectId, preferredChatId = null) => {
      if (!projectId) {
        setChats([]);
        setActiveChatId(null);
        return;
      }

      setLoadingChats(true);
      try {
        const data = await listProjectChats(projectId);
        setChats(data);

        let nextChatId = null;
        if (preferredChatId && data.some((chat) => chat.id === preferredChatId)) {
          nextChatId = preferredChatId;
        } else if (routeChatId && data.some((chat) => chat.id === routeChatId)) {
          nextChatId = routeChatId;
        } else if (activeChatId && data.some((chat) => chat.id === activeChatId)) {
          nextChatId = activeChatId;
        } else if (data.length > 0) {
          nextChatId = data[0].id;
        }

        setActiveChatId(nextChatId);
        if (nextChatId) {
          navigate(`/projects/${projectId}/chats/${nextChatId}`, { replace: true });
        } else {
          navigate(`/projects/${projectId}`, { replace: true });
          setMessages([]);
        }
      } catch (error) {
        setStatusMessage({
          type: 'error',
          text: error.response?.data?.detail || 'Unable to load project chats.',
        });
      } finally {
        setLoadingChats(false);
      }
    },
    [activeChatId, navigate, routeChatId]
  );

  const loadMessages = useCallback(async (projectId, chatId) => {
    if (!projectId || !chatId) {
      setMessages([]);
      return;
    }

    setLoadingMessages(true);
    try {
      const response = await listProjectMessages(projectId, chatId, { limit: 150 });
      setMessages(response.messages || []);
    } catch (error) {
      setStatusMessage({
        type: 'error',
        text: error.response?.data?.detail || 'Unable to load chat history.',
      });
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const loadFiles = useCallback(async (projectId) => {
    if (!projectId) {
      setFiles([]);
      return;
    }

    try {
      const data = await listProjectFiles(projectId);
      setFiles(data);
    } catch (error) {
      setStatusMessage({
        type: 'error',
        text: error.response?.data?.detail || 'Unable to load project files.',
      });
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (!activeProjectId) {
      return;
    }
    loadChats(activeProjectId, routeChatId || null);
    loadFiles(activeProjectId);
  }, [activeProjectId, routeChatId, loadChats, loadFiles]);

  useEffect(() => {
    if (!activeProjectId || !activeChatId) {
      return;
    }
    loadMessages(activeProjectId, activeChatId);
  }, [activeProjectId, activeChatId, loadMessages]);

  const handleCreateProject = async () => {
    const name = window.prompt('Enter project name');
    if (!name || !name.trim()) {
      return;
    }
    const description = window.prompt('Add project description (optional)') || '';

    try {
      const created = await createProject({
        name: name.trim(),
        description: description.trim(),
        metadata: {},
      });
      setProjects((previous) => [created, ...previous]);
      setActiveProjectId(created.id);
      setStatusMessage({ type: 'success', text: 'Project created successfully.' });
      navigate(`/projects/${created.id}`);
    } catch (error) {
      setStatusMessage({
        type: 'error',
        text: error.response?.data?.detail || 'Failed to create project.',
      });
    }
  };

  const handleRenameProject = async (project) => {
    const nextName = window.prompt('Rename project', project.name || '');
    if (!nextName || !nextName.trim() || nextName.trim() === project.name) {
      return;
    }

    try {
      const updated = await updateProject(project.id, { name: nextName.trim() });
      setProjects((previous) => previous.map((item) => (item.id === updated.id ? updated : item)));
      setStatusMessage({ type: 'success', text: 'Project renamed.' });
    } catch (error) {
      setStatusMessage({
        type: 'error',
        text: error.response?.data?.detail || 'Failed to rename project.',
      });
    }
  };

  const handleDeleteProject = async (project) => {
    const confirmed = window.confirm(`Delete project "${project.name}"? This removes chats and files permanently.`);
    if (!confirmed) {
      return;
    }

    try {
      await deleteProject(project.id);
      setStatusMessage({ type: 'success', text: 'Project deleted.' });
      await loadProjects();
    } catch (error) {
      setStatusMessage({
        type: 'error',
        text: error.response?.data?.detail || 'Failed to delete project.',
      });
    }
  };

  const handleSelectProject = (projectId) => {
    setActiveProjectId(projectId);
    setActiveChatId(null);
    setAttachedFileIds([]);
    setIsFilesPanelOpen(false);
    navigate(`/projects/${projectId}`);
  };

  const handleCreateChat = async () => {
    if (!activeProjectId) {
      return;
    }

    const title = window.prompt('Chat title', 'New Chat') || 'New Chat';

    try {
      const created = await createProjectChat(activeProjectId, title.trim() || 'New Chat');
      setChats((previous) => [created, ...previous]);
      setActiveChatId(created.id);
      setMessages([]);
      navigate(`/projects/${activeProjectId}/chats/${created.id}`);
    } catch (error) {
      setStatusMessage({
        type: 'error',
        text: error.response?.data?.detail || 'Failed to create chat.',
      });
    }
  };

  const handleSelectChat = (chatId) => {
    setActiveChatId(chatId);
    navigate(`/projects/${activeProjectId}/chats/${chatId}`);
  };

  const handleRenameChat = async (chat) => {
    const nextTitle = window.prompt('Rename chat', chat.title || '');
    if (!nextTitle || !nextTitle.trim() || nextTitle.trim() === chat.title) {
      return;
    }

    try {
      const updated = await updateProjectChat(activeProjectId, chat.id, { title: nextTitle.trim() });
      setChats((previous) => previous.map((item) => (item.id === updated.id ? updated : item)));
    } catch (error) {
      setStatusMessage({
        type: 'error',
        text: error.response?.data?.detail || 'Failed to rename chat.',
      });
    }
  };

  const handleDeleteChat = async (chat) => {
    const confirmed = window.confirm(`Delete chat "${chat.title}"?`);
    if (!confirmed) {
      return;
    }

    try {
      await deleteProjectChat(activeProjectId, chat.id);
      await loadChats(activeProjectId, null);
      setStatusMessage({ type: 'success', text: 'Chat deleted.' });
    } catch (error) {
      setStatusMessage({
        type: 'error',
        text: error.response?.data?.detail || 'Failed to delete chat.',
      });
    }
  };

  const handleTogglePinChat = async (chat) => {
    try {
      const updated = await updateProjectChat(activeProjectId, chat.id, {
        is_pinned: !chat.is_pinned,
      });
      setChats((previous) => {
        const next = previous.map((item) => (item.id === updated.id ? updated : item));
        return [...next].sort((left, right) => {
          if (left.is_pinned !== right.is_pinned) {
            return Number(right.is_pinned) - Number(left.is_pinned);
          }
          return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
        });
      });
    } catch (error) {
      setStatusMessage({
        type: 'error',
        text: error.response?.data?.detail || 'Failed to update pin status.',
      });
    }
  };

  const handlePersistSettings = async (nextSettings) => {
    if (!activeProjectId) {
      return;
    }

    try {
      const updated = await updateProject(activeProjectId, {
        settings: nextSettings,
      });
      setProjects((previous) => previous.map((item) => (item.id === updated.id ? updated : item)));
    } catch (error) {
      setStatusMessage({
        type: 'error',
        text: error.response?.data?.detail || 'Failed to update project settings.',
      });
    }
  };

  const handleToggleIncludeProjectFiles = (checked) => {
    setIncludeProjectFiles(checked);
    const nextSettings = {
      ...(activeProject?.settings || {}),
      include_project_files: checked,
      include_previous_chats: includePreviousChats,
      temperature: Number(activeProject?.settings?.temperature ?? 0.7),
      model: activeProject?.settings?.model || 'default',
    };
    handlePersistSettings(nextSettings);
  };

  const handleToggleIncludePreviousChats = (checked) => {
    setIncludePreviousChats(checked);
    const nextSettings = {
      ...(activeProject?.settings || {}),
      include_project_files: includeProjectFiles,
      include_previous_chats: checked,
      temperature: Number(activeProject?.settings?.temperature ?? 0.7),
      model: activeProject?.settings?.model || 'default',
    };
    handlePersistSettings(nextSettings);
  };

  const handleUploadFiles = async (selectedFiles) => {
    if (!activeProjectId || selectedFiles.length === 0) {
      return [];
    }

    setIsUploading(true);
    try {
      const uploaded = await uploadProjectFiles(activeProjectId, selectedFiles);
      setFiles((previous) => [...uploaded, ...previous]);
      setStatusMessage({ type: 'success', text: 'Files uploaded successfully.' });
      return uploaded;
    } catch (error) {
      setStatusMessage({
        type: 'error',
        text: error.response?.data?.detail || 'Failed to upload files.',
      });
      return [];
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteFile = async (file) => {
    const confirmed = window.confirm(`Delete file "${file.filename}"?`);
    if (!confirmed) {
      return;
    }

    try {
      await deleteProjectFile(activeProjectId, file.id);
      setFiles((previous) => previous.filter((item) => item.id !== file.id));
      setAttachedFileIds((previous) => previous.filter((item) => item !== file.id));
      setStatusMessage({ type: 'success', text: 'File deleted.' });
    } catch (error) {
      setStatusMessage({
        type: 'error',
        text: error.response?.data?.detail || 'Failed to delete file.',
      });
    }
  };

  const handlePreviewFile = async (file) => {
    try {
      const { blob } = await downloadProjectFile(activeProjectId, file.id);
      openBlobInNewTab(blob);
    } catch (error) {
      setStatusMessage({
        type: 'error',
        text: error.response?.data?.detail || 'Failed to preview file.',
      });
    }
  };

  const handleToggleAttach = (fileId, checked) => {
    setAttachedFileIds((previous) => {
      if (checked) {
        return [...new Set([...previous, fileId])];
      }
      return previous.filter((id) => id !== fileId);
    });
  };

  const handleComposerFiles = async (pickedFiles) => {
    const uploaded = await handleUploadFiles(pickedFiles);
    if (!uploaded || uploaded.length === 0) {
      return;
    }

    setAttachedFileIds((previous) => {
      return [...new Set([...previous, ...uploaded.map((file) => file.id)])];
    });
    setIsFilesPanelOpen(true);
  };

  const handleRemoveAttachedFile = (file) => {
    if (!file?.id) {
      return;
    }

    setAttachedFileIds((previous) => previous.filter((id) => id !== file.id));
  };

  const handleSendMessage = async (content) => {
    if (!activeProjectId || !activeChatId) {
      setStatusMessage({ type: 'error', text: 'Select a project and chat before sending a message.' });
      return false;
    }

    const streamingMessageId = `streaming-${Date.now()}`;
    setIsStreaming(true);
    setStatusMessage({ type: '', text: '' });

    try {
      await streamProjectResponse({
        projectId: activeProjectId,
        chatId: activeChatId,
        payload: {
          content,
          file_ids: attachedFileIds,
          use_project_files: includeProjectFiles,
          use_previous_chats: includePreviousChats,
        },
        onStart: (userMessage) => {
          setMessages((previous) => [
            ...previous,
            userMessage,
            {
              id: streamingMessageId,
              project_id: activeProjectId,
              chat_id: activeChatId,
              role: 'assistant',
              content: '',
              file_ids: [],
              citations: [],
              created_at: new Date().toISOString(),
            },
          ]);
        },
        onToken: (delta) => {
          setMessages((previous) =>
            previous.map((message) =>
              message.id === streamingMessageId
                ? { ...message, content: `${message.content}${delta}` }
                : message
            )
          );
        },
        onDone: (assistantMessage) => {
          setMessages((previous) =>
            previous.map((message) =>
              message.id === streamingMessageId ? assistantMessage : message
            )
          );
        },
      });

      setAttachedFileIds([]);
      await loadChats(activeProjectId, activeChatId);
    } catch (error) {
      setMessages((previous) =>
        previous.map((message) =>
          message.id === streamingMessageId
            ? {
                ...message,
                content: error.message || 'Unable to generate response right now.',
              }
            : message
        )
      );
      setStatusMessage({ type: 'error', text: error.message || 'Failed to stream response.' });
    } finally {
      setIsStreaming(false);
    }

    return true;
  };

  const handleExport = async () => {
    if (!activeProjectId || !activeChatId) {
      setStatusMessage({ type: 'error', text: 'Select a chat to export.' });
      return;
    }

    const requestedFormat = (window.prompt('Export format: markdown or pdf', 'markdown') || 'markdown').toLowerCase().trim();
    const exportFormat = requestedFormat === 'pdf' ? 'pdf' : 'markdown';

    try {
      const { blob, contentDisposition } = await exportProjectChat(activeProjectId, activeChatId, exportFormat);
      const fallbackExtension = exportFormat === 'pdf' ? 'pdf' : 'md';
      const fileName = parseContentDispositionFilename(contentDisposition, `chat-${activeChatId}.${fallbackExtension}`);
      triggerBlobDownload(blob, fileName);
    } catch (error) {
      setStatusMessage({
        type: 'error',
        text: error.response?.data?.detail || 'Failed to export chat.',
      });
    }
  };

  const handleShare = async () => {
    if (!activeProjectId) {
      return;
    }

    const email = window.prompt('Enter user email to share this project with');
    if (!email || !email.trim()) {
      return;
    }

    try {
      await shareProject(activeProjectId, email.trim());
      setStatusMessage({ type: 'success', text: 'Project shared successfully.' });
    } catch (error) {
      setStatusMessage({
        type: 'error',
        text: error.response?.data?.detail || 'Failed to share project.',
      });
    }
  };

  return (
    <div className="app-shell">
      <ProjectsSidebar
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        projects={projects}
        activeProjectId={activeProjectId}
        chats={chats}
        activeChatId={activeChatId}
        onSelectProject={handleSelectProject}
        onCreateProject={handleCreateProject}
        onRenameProject={handleRenameProject}
        onDeleteProject={handleDeleteProject}
        onSelectChat={handleSelectChat}
        onCreateChat={handleCreateChat}
        onRenameChat={handleRenameChat}
        onDeleteChat={handleDeleteChat}
        onTogglePinChat={handleTogglePinChat}
      />

      <main className="app-main">
        <ProjectTopbar
          title={activeProject?.name || (loadingProjects ? 'Loading projects...' : 'Projects')}
          subtitle={activeProject?.description || ''}
          onToggleSidebar={() => setIsSidebarOpen((previous) => !previous)}
          onToggleFilesPanel={() => setIsFilesPanelOpen((current) => !current)}
          isFilesPanelOpen={isFilesPanelOpen}
          includeProjectFiles={includeProjectFiles}
          includePreviousChats={includePreviousChats}
          onToggleIncludeProjectFiles={handleToggleIncludeProjectFiles}
          onToggleIncludePreviousChats={handleToggleIncludePreviousChats}
          onExport={handleExport}
          onShare={handleShare}
        />

        {statusMessage.text && (
          <div
            className={`mx-4 mt-3 inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm ${
              statusMessage.type === 'success'
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700'
                : 'border-red-500/20 bg-red-500/10 text-red-600'
            }`}
          >
            <AlertCircle size={16} />
            {statusMessage.text}
          </div>
        )}

        <div className="min-h-0 flex flex-1 flex-col">
          <ProjectChatPanel
            messages={messages}
            isStreaming={isStreaming || loadingMessages || loadingChats}
            onSendMessage={handleSendMessage}
            selectedFileNames={attachedFileNames}
            selectedFiles={attachedFilesForComposer}
            onFilesSelected={handleComposerFiles}
            onRemoveSelectedFile={handleRemoveAttachedFile}
            disabled={!activeProjectId || !activeChatId}
          />
        </div>
      </main>

      {isFilesPanelOpen ? (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            onClick={() => setIsFilesPanelOpen(false)}
            className="absolute inset-0 bg-slate-900/20"
            aria-label="Close project files drawer"
          />

          <div className="absolute right-0 top-0 h-full w-full max-w-md border-l border-border bg-background shadow-[0_12px_36px_rgba(15,23,42,0.12)]">
            <ProjectFilesPanel
              files={files}
              attachedFileIds={attachedFileIds}
              onToggleAttach={handleToggleAttach}
              onUploadFiles={handleUploadFiles}
              onDeleteFile={handleDeleteFile}
              onPreviewFile={handlePreviewFile}
              isUploading={isUploading}
              onClose={() => setIsFilesPanelOpen(false)}
              className="border-0"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
