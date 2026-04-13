import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FolderKanban, MessageSquare, Users } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ChatWindow } from './components/ChatWindow';
import { InputBar } from './components/InputBar';
import { AuthContext } from './context/AuthContext';
import { detectPromptContext } from './utils/intentDetection';
import {
  LEGACY_WORKSPACE_CHAT_STORAGE_KEY,
  getWorkspaceChatStorageKey,
  readWorkspaceChatsByKey,
  writeWorkspaceChatsByKey,
} from './utils/chatStorage';

const SIDEBAR_STATE_KEY = 'miety-sidebar-open-desktop';
const generateId = () => Math.random().toString(36).substring(2, 9);

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

function getAttachmentId(file, fallbackIndex = 0) {
  return String(
    file?.id ||
    file?.file_id ||
    file?.stored_name ||
    file?.name ||
    file?.filename ||
    `attachment-${fallbackIndex}`
  );
}

function getAttachmentName(file, fallbackIndex = 0) {
  return String(file?.filename || file?.name || `Attachment ${fallbackIndex + 1}`);
}

function buildAttachmentContext(files) {
  if (!Array.isArray(files) || files.length === 0) {
    return {
      visibleBlock: '',
      contextBlock: '',
    };
  }

  const visibleList = files
    .map((file, index) => `- ${getAttachmentName(file, index)}`)
    .join('\n');

  const contextList = files
    .map((file, index) => {
      const name = getAttachmentName(file, index);
      const extractedText = String(file?.extracted_text || file?.preview_text || '').trim();
      if (!extractedText) {
        return `- ${name}`;
      }
      return `- ${name}\n${extractedText}`;
    })
    .join('\n\n');

  return {
    visibleBlock: `\n\nAttached files:\n${visibleList}`,
    contextBlock: `\n\nAttached files context:\n${contextList}`,
  };
}

export default function ChatApp() {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => getInitialSidebarOpen());
  const [promptDraft, setPromptDraft] = useState('');
  const [selectedUploadFiles, setSelectedUploadFiles] = useState([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const chatStorageKey = useMemo(
    () => getWorkspaceChatStorageKey(user),
    [user?.id, user?._id, user?.email]
  );

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      localStorage.setItem(SIDEBAR_STATE_KEY, String(isSidebarOpen));
    }
  }, [isSidebarOpen]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(LEGACY_WORKSPACE_CHAT_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    setChats(readWorkspaceChatsByKey(chatStorageKey));
    setActiveChatId(null);
    setPromptDraft('');
    setSelectedUploadFiles([]);
  }, [chatStorageKey]);

  useEffect(() => {
    writeWorkspaceChatsByKey(chatStorageKey, chats);
  }, [chatStorageKey, chats]);

  useEffect(() => {
    const chatIdFromQuery = new URLSearchParams(location.search).get('chat');
    if (!chatIdFromQuery) {
      return;
    }

    const matchingChat = chats.find((chat) => chat.id === chatIdFromQuery);
    if (matchingChat) {
      setActiveChatId(chatIdFromQuery);
    }
  }, [location.search, chats]);

  const activeChat = chats.find((chat) => chat.id === activeChatId);
  const messages = activeChat?.messages || [];
  const detection = detectPromptContext(promptDraft);
  const contextualPlaceholder = getPlaceholder(detection);

  const attachedChatFiles = useMemo(() => {
    return selectedUploadFiles.map((file, index) => ({
      id: getAttachmentId(file, index),
      name: getAttachmentName(file, index),
    }));
  }, [selectedUploadFiles]);

  const handleAddChatFiles = useCallback(async (pickedFiles) => {
    setIsUploadingFiles(true);

    try {
      const formData = new FormData();
      pickedFiles.forEach((file) => formData.append('files', file));

      const response = await fetch('/chat/files/ingest', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('File upload failed');
      }

      const payload = await response.json();
      const uploadedFiles = Array.isArray(payload?.files) ? payload.files : [];

      setSelectedUploadFiles((currentFiles) => {
        const nextById = new Map(
          currentFiles.map((file, index) => [getAttachmentId(file, index), file])
        );

        uploadedFiles.forEach((file, index) => {
          nextById.set(getAttachmentId(file, index), file);
        });

        return Array.from(nextById.values());
      });
    } catch (error) {
      console.error(error);
    } finally {
      setIsUploadingFiles(false);
    }
  }, []);

  const handleRemoveChatFile = useCallback((selectedFile) => {
    const targetId = getAttachmentId(selectedFile);
    setSelectedUploadFiles((currentFiles) =>
      currentFiles.filter((file, index) => getAttachmentId(file, index) !== targetId)
    );
  }, []);

  const handleNewChat = useCallback(() => {
    const newChat = {
      id: generateId(),
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
    };

    setChats((previous) => [newChat, ...previous]);
    setActiveChatId(newChat.id);
    navigate(`/?chat=${newChat.id}`, { replace: true });
  }, [navigate]);

  const handleDeleteChat = useCallback((id) => {
    setChats((previous) => previous.filter((chat) => chat.id !== id));
    if (activeChatId === id) {
      setActiveChatId(null);
      navigate('/', { replace: true });
    }
  }, [activeChatId, navigate]);

  const handleSendMessage = useCallback(async (content) => {
    if (!content.trim()) {
      return;
    }

    let chatId = activeChatId;
    let nextChatsState = [...chats];
    let chatIndex = chats.findIndex((chat) => chat.id === chatId);

    if (!chatId || chatIndex === -1) {
      chatId = generateId();
      const newChat = {
        id: chatId,
        title: content.slice(0, 30) + (content.length > 30 ? '...' : ''),
        messages: [],
        createdAt: Date.now(),
      };

      nextChatsState = [newChat, ...nextChatsState];
      chatIndex = 0;
      setActiveChatId(chatId);
      navigate(`/?chat=${chatId}`, { replace: true });
    }

    const apiHistory = nextChatsState[chatIndex].messages.map((message) => ({
      role: message.role === 'ai' ? 'assistant' : message.role,
      content: message.content,
    }));

    const attachmentContext = buildAttachmentContext(selectedUploadFiles);
    const visibleContent = `${content}${attachmentContext.visibleBlock}`;
    const outboundContent = `${content}${attachmentContext.contextBlock}`;

    const userMessage = {
      id: generateId(),
      role: 'user',
      content: visibleContent,
      timestamp: Date.now(),
    };

    nextChatsState[chatIndex].messages.push(userMessage);

    if (nextChatsState[chatIndex].messages.length === 1) {
      nextChatsState[chatIndex].title = content.slice(0, 30) + (content.length > 30 ? '...' : '');
    }

    setChats(nextChatsState);
    setIsProcessing(true);

    try {
      const response = await fetch('/chat/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          question: outboundContent,
          history: apiHistory,
        }),
      });

      if (!response.ok) {
        throw new Error('Server responded with an error');
      }

      const data = await response.json();

      setChats((currentChats) => currentChats.map((chat) => {
        if (chat.id !== chatId) {
          return chat;
        }

        return {
          ...chat,
          messages: [
            ...chat.messages,
            {
              id: generateId(),
              role: 'ai',
              content: data.answer,
              timestamp: Date.now(),
            },
          ],
        };
      }));

      setSelectedUploadFiles([]);
    } catch (error) {
      console.error(error);
      setChats((currentChats) => currentChats.map((chat) => {
        if (chat.id !== chatId) {
          return chat;
        }

        return {
          ...chat,
          messages: [
            ...chat.messages,
            {
              id: generateId(),
              role: 'ai',
              content: '**Error:** Could not connect to the backend server. Please make sure the FastAPI backend is running on http://127.0.0.1:10000.',
              timestamp: Date.now(),
            },
          ],
        };
      }));
    } finally {
      setIsProcessing(false);
    }
  }, [activeChatId, chats, navigate, selectedUploadFiles]);

  return (
    <div className="app-shell">
      <Sidebar
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={(id) => {
          setActiveChatId(id);
          navigate(`/?chat=${id}`, { replace: true });
        }}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
      />

      <div className="flex min-w-0 flex-1">
        <main className="app-main">
          <Header
            toggleSidebar={() => setIsSidebarOpen((current) => !current)}
            title="Miety AI"
            subtitle="Simple study chat for classes, projects, and campus work."
          />

          <div className="flex min-h-0 flex-1 flex-col px-3 py-3 md:px-5 md:py-5">
            <div className="panel-card flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="border-b border-border px-5 py-4">
                <p className="section-label">Chat</p>
                <h1 className="mt-1 text-lg font-semibold text-foreground">Study Assistant</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ask questions, upload supporting files, and keep each conversation organized.
                </p>
              </div>

              <ChatWindow
                messages={messages}
                isProcessing={isProcessing}
              />
            </div>

            <div className="mt-4">
              <InputBar
                onSendMessage={handleSendMessage}
                isProcessing={isProcessing || isUploadingFiles}
                placeholder={contextualPlaceholder}
                helperText=""
                value={promptDraft}
                onValueChange={setPromptDraft}
                onFilesSelected={handleAddChatFiles}
                selectedFiles={attachedChatFiles}
                onRemoveSelectedFile={handleRemoveChatFile}
              />
            </div>
          </div>
        </main>
      </div>

      <MobileWorkspaceDock
        onOpenChats={() => navigate('/')}
        onOpenProjects={() => navigate('/projects')}
        onOpenGroups={() => navigate('/groups')}
      />
    </div>
  );
}

function getPlaceholder(detection) {
  const primary = detection?.primaryIntent;

  if (primary === 'coding') {
    return 'Ask about code, errors, or technical ideas';
  }

  if (primary === 'data_analysis') {
    return 'Ask about data, results, or summaries';
  }

  if (primary === 'image_generation') {
    return 'Describe the image or visual idea you need';
  }

  if (primary === 'voice') {
    return 'Ask about transcripts, recordings, or speech';
  }

  return 'Ask anything related to your studies';
}

function MobileWorkspaceDock({ onOpenChats, onOpenProjects, onOpenGroups }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card px-3 py-2 md:hidden">
      <div className="grid grid-cols-3 gap-2">
        <DockButton icon={MessageSquare} label="Chats" onClick={onOpenChats} />
        <DockButton icon={FolderKanban} label="Projects" onClick={onOpenProjects} />
        <DockButton icon={Users} label="Groups" onClick={onOpenGroups} />
      </div>
    </nav>
  );
}

function DockButton({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-background py-2 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <Icon size={14} />
      <span>{label}</span>
    </button>
  );
}
