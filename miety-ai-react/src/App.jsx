import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ChatWindow } from './components/ChatWindow';
import { InputBar } from './components/InputBar';

// Helper for generating unique IDs
const generateId = () => Math.random().toString(36).substring(2, 9);

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark' || 
           (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Chats State
  const [chats, setChats] = useState(() => {
    const saved = localStorage.getItem('miety-chats');
    if (saved) return JSON.parse(saved);
    return [];
  });
  
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

  // Sync chats to localStorage
  useEffect(() => {
    localStorage.setItem('miety-chats', JSON.stringify(chats));
  }, [chats]);

  // Active chat shortcut
  const activeChat = chats.find(c => c.id === activeChatId);
  const messages = activeChat?.messages || [];

  const handleNewChat = useCallback(() => {
    const newChat = {
      id: generateId(),
      title: 'New Chat',
      messages: [],
      createdAt: Date.now()
    };
    setChats(prev => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    if (window.innerWidth < 768) setIsSidebarOpen(false); // Close sidebar on mobile after select
  }, []);

  const handleDeleteChat = useCallback((id) => {
    setChats(prev => prev.filter(c => c.id !== id));
    if (activeChatId === id) {
      setActiveChatId(null);
    }
  }, [activeChatId]);

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
    }

    // Prepare history without the new message by converting UI 'ai' role to internal 'assistant' role
    const apiHistory = newChatsState[chatIndex].messages.map(m => ({
      role: m.role === 'ai' ? 'assistant' : m.role,
      content: m.content
    }));

    // Add user message
    const userMessage = {
      id: generateId(),
      role: 'user',
      content: content,
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: content,
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
                content: "**Error:** Could not connect to the backend server. Please make sure the FastAPI backend is running on `http://127.0.0.1:8000`.",
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
  }, [chats, activeChatId]);

  return (
    <div className="flex bg-background text-foreground h-screen overflow-hidden font-sans">
      <Sidebar 
        isOpen={isSidebarOpen} 
        setIsOpen={setIsSidebarOpen}
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={(id) => {
          setActiveChatId(id);
          if (window.innerWidth < 768) setIsSidebarOpen(false);
        }}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
      />
      
      <main className="flex-1 flex flex-col min-w-0 h-full relative">
        <Header 
          toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          isDarkMode={isDarkMode}
          toggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        />
        
        <ChatWindow 
          messages={messages} 
          isProcessing={isProcessing}
        />
        
        <div className="bg-gradient-to-t from-background to-transparent pt-4 pb-2 z-10 w-full relative">
          <InputBar 
            onSendMessage={handleSendMessage}
            isProcessing={isProcessing}
          />
        </div>
      </main>
    </div>
  );
}
