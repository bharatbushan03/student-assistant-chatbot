import React, { useState, useEffect, useCallback, useContext, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  FolderKanban,
  MessageSquare,
  Users,
} from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ChatWindow } from './components/ChatWindow';
import { InputBar } from './components/InputBar';
import { AdaptiveToolDeck } from './components/ai/AdaptiveToolDeck';
import { AuthContext } from './context/AuthContext';
import { detectPromptContext } from './utils/intentDetection';
import {
  LEGACY_WORKSPACE_CHAT_STORAGE_KEY,
  getWorkspaceChatStorageKey,
  readWorkspaceChatsByKey,
  writeWorkspaceChatsByKey,
} from './utils/chatStorage';

// Helper for generating unique IDs
const generateId = () => Math.random().toString(36).substring(2, 9);
const SIDEBAR_STATE_KEY = 'miety-sidebar-open-desktop';

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

export default function ChatApp() {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) {
      return saved === 'dark';
    }

    // Default to dark for the AI-native workspace aesthetic.
    return true;
  });
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => getInitialSidebarOpen());
  const [promptDraft, setPromptDraft] = useState('');
  const [selectedUploadFiles, setSelectedUploadFiles] = useState([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const chatStorageKey = useMemo(
    () => getWorkspaceChatStorageKey(user),
    [user?.id, user?._id, user?.email]
  );
  
  // Chats State
  const [chats, setChats] = useState([]);
  
  const [activeChatId, setActiveChatId] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Sync dark mode to document root
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      localStorage.setItem(SIDEBAR_STATE_KEY, String(isSidebarOpen));
    }
  }, [isSidebarOpen]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Remove legacy global chat cache to prevent cross-account leakage.
      localStorage.removeItem(LEGACY_WORKSPACE_CHAT_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    setChats(readWorkspaceChatsByKey(chatStorageKey));
    setActiveChatId(null);
    setPromptDraft('');
    setSelectedUploadFiles([]);
  }, [chatStorageKey]);

  // Sync chats to localStorage
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

  // Active chat shortcut
  const activeChat = chats.find(c => c.id === activeChatId);
  const messages = activeChat?.messages || [];
  const detection = detectPromptContext(promptDraft);
  const shouldShowToolDeck = promptDraft.trim().length > 0 && detection.activeTools.length > 0;
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
    setSelectedUploadFiles((currentFiles) => {
      return currentFiles.filter((file, index) => getAttachmentId(file, index) !== targetId);
    });
  }, []);

  const handleNewChat = useCallback(() => {
    const newChat = {
      id: generateId(),
      title: 'New Chat',
      messages: [],
      createdAt: Date.now()
    };
    setChats(prev => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    navigate(`/?chat=${newChat.id}`, { replace: true });
  }, [navigate]);

  const handleDeleteChat = useCallback((id) => {
    setChats(prev => prev.filter(c => c.id !== id));
    if (activeChatId === id) {
      setActiveChatId(null);
      navigate('/', { replace: true });
    }
  }, [activeChatId, navigate]);

  const handleSendMessage = useCallback(async (content) => {
    if (!content.trim()) return;

    let chatId = activeChatId;
    let newChatsState = [...chats];
    let chatIndex = chats.findIndex(c => c.id === chatId);

    // Create chat if none exists
    if (!chatId || chatIndex === -1) {
      chatId = generateId();
      const newChat = {
        id: chatId,
        title: content.slice(0, 30) + (content.length > 30 ? '...' : ''),
        messages: [],
        createdAt: Date.now()
      };
      newChatsState = [newChat, ...newChatsState];
      chatIndex = 0;
      setActiveChatId(chatId);
      navigate(`/?chat=${chatId}`, { replace: true });
    }

    // Prepare history without the new message by converting UI 'ai' role to internal 'assistant' role
    const apiHistory = newChatsState[chatIndex].messages.map(m => ({
      role: m.role === 'ai' ? 'assistant' : m.role,
      content: m.content
    }));

    const attachmentContext = buildAttachmentContext(selectedUploadFiles);
    const visibleContent = `${content}${attachmentContext.visibleBlock}`;
    const outboundContent = `${content}${attachmentContext.contextBlock}`;

    // Add user message
    const userMessage = {
      id: generateId(),
      role: 'user',
      content: visibleContent,
      timestamp: Date.now()
    };
    
    newChatsState[chatIndex].messages.push(userMessage);
    
    // Update title for first message
    if (newChatsState[chatIndex].messages.length === 1) {
      newChatsState[chatIndex].title = content.slice(0, 30) + (content.length > 30 ? '...' : '');
    }
    
    setChats(newChatsState);
    setIsProcessing(true);

    try {
      const response = await fetch("/chat/ask", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          question: outboundContent,
          history: apiHistory
        })
      });

      if (!response.ok) {
        throw new Error("Server responded with an error");
      }
      
      const data = await response.json();
      
      setChats(currentChats => currentChats.map(c => {
        if (c.id === chatId) {
          return {
            ...c,
            messages: [
              ...c.messages,
              {
                id: generateId(),
                role: 'ai',
                content: data.answer,
                timestamp: Date.now()
              }
            ]
          };
        }
        return c;
      }));
      setSelectedUploadFiles([]);
    } catch (error) {
      console.error(error);
      setChats(currentChats => currentChats.map(c => {
        if (c.id === chatId) {
          return {
            ...c,
            messages: [
              ...c.messages,
              {
                id: generateId(),
                role: 'ai',
                content: "**Error:** Could not connect to the backend server. Please make sure the FastAPI backend is running on http://127.0.0.1:10000.",
                timestamp: Date.now()
              }
            ]
          };
        }
        return c;
      }));
    } finally {
      setIsProcessing(false);
    }
  }, [chats, activeChatId, selectedUploadFiles]);

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
        <main className="app-main pb-16 md:pb-0">
          <Header
            toggleSidebar={() => setIsSidebarOpen((current) => !current)}
            isDarkMode={isDarkMode}
            toggleDarkMode={() => setIsDarkMode(!isDarkMode)}
            user={user}
            title="Miety AI Workspace"
          />

          <div className="flex min-h-0 flex-1 flex-col px-3 pb-2 pt-3 md:px-4">
            <div className="surface-panel min-h-0 flex-1 overflow-hidden">
              <ChatWindow
                messages={messages}
                isProcessing={isProcessing}
                onSuggestionSelect={setPromptDraft}
              />
            </div>

            {shouldShowToolDeck ? (
              <div className="mt-2 max-h-[30vh] overflow-auto pr-1">
                <AdaptiveToolDeck detection={detection} />
              </div>
            ) : null}

            <div className="relative z-10 mt-3 w-full bg-gradient-to-t from-background via-background/96 to-transparent pt-3 pb-4">
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
    return 'Ask anything... paste code, errors, stack traces, or architecture ideas';
  }

  if (primary === 'data_analysis') {
    return 'Ask anything... paste CSV rows, metrics, tables, or analysis goals';
  }

  if (primary === 'image_generation') {
    return 'Ask anything... describe visuals, styles, lighting, and composition';
  }

  if (primary === 'voice') {
    return 'Ask anything... paste transcript ideas or request voice workflows';
  }

  return 'Ask anything... paste code, data, images, docs, or ideas';
}

function MobileWorkspaceDock({
  onOpenChats,
  onOpenProjects,
  onOpenGroups,
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/92 px-3 py-2 backdrop-blur-xl md:hidden">
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
      className="inline-flex flex-col items-center justify-center gap-1 rounded-xl border border-border/70 bg-card/90 py-2 text-[11px] text-muted-foreground transition hover:bg-muted/70 hover:text-foreground"
    >
      <Icon size={14} />
      <span>{label}</span>
    </button>
  );
}
