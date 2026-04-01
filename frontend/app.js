/**
 * MIET Student Assistant — Professional Chat Application
 * Enterprise-grade JavaScript with modular architecture
 * @version 2.0.0
 */

// ═══════════════════════════════════════════════════════════════════════
// Application State
// ═══════════════════════════════════════════════════════════════════════

const AppState = {
    isWaiting: false,
    isTyping: false,
    chatHistory: [],
    currentConversationId: null,
    sidebarOpen: false,
    messageCount: 0,
    sessionStartTime: Date.now(),

    // Configuration
    config: {
        apiBase: '',
        maxRetries: 3,
        retryDelay: 1000,
        typingDelay: 50,
        maxMessageLength: 500,
    }
};

// ═══════════════════════════════════════════════════════════════════════
// DOM Elements Cache
// ═══════════════════════════════════════════════════════════════════════

const DOM = {
    // Sidebar
    sidebar: document.getElementById('sidebar'),
    sidebarOverlay: document.getElementById('sidebar-overlay'),
    menuToggle: document.getElementById('menu-toggle'),
    sidebarClose: document.getElementById('sidebar-close'),
    newChatBtn: document.getElementById('new-chat-btn'),
    topicList: document.getElementById('topic-list'),

    // Chat
    welcomeScreen: document.getElementById('welcome-screen'),
    messages: document.getElementById('messages'),
    typingIndicator: document.getElementById('typing-indicator'),
    chatForm: document.getElementById('chat-form'),
    questionInput: document.getElementById('question'),
    sendBtn: document.getElementById('send-btn'),
    charCount: document.getElementById('char-count'),
    recentChats: document.getElementById('recent-chats'),

    // Status
    statusIndicator: document.getElementById('status-indicator'),

    // Toast
    toastContainer: document.getElementById('toast-container'),
};

// ═══════════════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════════════

const Utils = {
    /**
     * Generate a unique ID
     */
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    },

    /**
     * Format timestamp
     */
    formatTime(date = new Date()) {
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    },

    /**
     * Debounce function
     */
    debounce(fn, delay = 300) {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn(...args), delay);
        };
    },

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Copy text to clipboard
     */
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.error('Failed to copy:', err);
            return false;
        }
    },

    /**
     * Detect if device is mobile
     */
    isMobile() {
        return window.matchMedia('(max-width: 768px)').matches;
    },

    /**
     * Check keyboard modifier
     */
    isMac() {
        return navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    },

    /**
     * Parse markdown to HTML
     * Supports: bold, italic, code, code blocks, lists, links
     */
    parseMarkdown(text) {
        if (!text) return '';

        // Escape HTML first to prevent XSS
        let html = this.escapeHtml(text);

        // Code blocks (```code```) - must be before inline code
        html = html.replace(/```(\n?)([\s\S]*?)```/g, '<pre><code>$2</code></pre>');

        // Inline code (`code`)
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Bold (**text** or __text__)
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');

        // Italic (*text* or _text_) - but not already processed bold
        html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
        html = html.replace(/(?<!_)_([^_]+)_(?!_)/g, '<em>$1</em>');

        // Links [text](url)
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

        // Line breaks to <br>
        html = html.replace(/\n/g, '<br>');

        return html;
    },

    /**
     * Strip markdown for plain text display
     */
    stripMarkdown(text) {
        if (!text) return '';
        return text
            .replace(/\*\*|__/g, '')
            .replace(/\*|_/g, '')
            .replace(/`{3}[\s\S]*?`{3}/g, '[code block]')
            .replace(/`([^`]+)`/g, '$1')
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    }
};

// ═══════════════════════════════════════════════════════════════════════
// UI Components
// ═══════════════════════════════════════════════════════════════════════

const UI = {
    /**
     * Show toast notification
     */
    showToast({
        title = '',
        message = '',
        type = 'info',
        duration = 4000
    }) {
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${icons[type]}</span>
            <div class="toast-content">
                ${title ? `<div class="toast-title">${title}</div>` : ''}
                ${message ? `<div class="toast-message">${message}</div>` : ''}
            </div>
        `;

        DOM.toastContainer.appendChild(toast);

        // Auto remove
        setTimeout(() => {
            toast.classList.add('hiding');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    /**
     * Scroll messages to bottom
     */
    scrollToBottom(behavior = 'smooth') {
        const container = DOM.messages.parentElement;
        container.scrollTo({
            top: container.scrollHeight,
            behavior
        });
    },

    /**
     * Update character count
     */
    updateCharCount() {
        const length = DOM.questionInput.value.length;
        const max = AppState.config.maxMessageLength;
        DOM.charCount.textContent = `${length}/${max}`;

        if (length > max * 0.9) {
            DOM.charCount.classList.add('near-limit');
        } else {
            DOM.charCount.classList.remove('near-limit');
        }
    },

    /**
     * Update status indicator
     */
    updateStatus(status, text) {
        const dot = DOM.statusIndicator.querySelector('.status-dot');
        const statusText = DOM.statusIndicator.querySelector('.status-text');

        const colors = {
            online: '#34d399',
            offline: '#f87171',
            loading: '#fbbf24'
        };

        dot.style.background = colors[status] || colors.online;
        dot.style.boxShadow = `0 0 6px ${colors[status] || colors.online}`;
        statusText.textContent = text;
    },

    /**
     * Auto-resize textarea
     */
    autoResizeTextarea() {
        const textarea = DOM.questionInput;
        textarea.style.height = 'auto';
        const newHeight = Math.min(textarea.scrollHeight, 150);
        textarea.style.height = `${newHeight}px`;
    }
};

// ═══════════════════════════════════════════════════════════════════════
// Message Components
// ═══════════════════════════════════════════════════════════════════════

const MessageComponent = {
    /**
     * Create message element
     */
    create({
        text,
        role,
        id = Utils.generateId(),
        timestamp = new Date()
    }) {
        const messageEl = document.createElement('div');
        messageEl.className = `message ${role}`;
        messageEl.dataset.id = id;

        const avatarText = role === 'user' ? 'You' : 'AI';

        // Parse markdown for bot messages, escape HTML for user messages
        const contentHtml = role === 'bot'
            ? Utils.parseMarkdown(text)
            : Utils.escapeHtml(text).replace(/\n/g, '<br>');

        messageEl.innerHTML = `
            <div class="message-avatar">${avatarText}</div>
            <div class="message-wrapper">
                <div class="message-content">${contentHtml}</div>
                ${role === 'bot' ? `
                    <div class="message-actions">
                        <button class="message-action-btn copy-btn" title="Copy to clipboard">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                            </svg>
                        </button>
                    </div>
                ` : ''}
            </div>
        `;

        // Add copy functionality
        if (role === 'bot') {
            const copyBtn = messageEl.querySelector('.copy-btn');
            copyBtn.addEventListener('click', async () => {
                const success = await Utils.copyToClipboard(text);
                UI.showToast({
                    title: success ? 'Copied!' : 'Failed to copy',
                    type: success ? 'success' : 'error',
                    duration: 2000
                });
            });
        }

        return messageEl;
    },

    /**
     * Show typing indicator
     */
    showTyping() {
        if (AppState.isTyping) return;
        AppState.isTyping = true;
        DOM.typingIndicator.style.display = 'flex';
        UI.scrollToBottom();
    },

    /**
     * Hide typing indicator
     */
    hideTyping() {
        AppState.isTyping = false;
        DOM.typingIndicator.style.display = 'none';
    }
};

// ═══════════════════════════════════════════════════════════════════════
// Sidebar Management
// ═══════════════════════════════════════════════════════════════════════

const SidebarManager = {
    open() {
        DOM.sidebar.classList.add('open');
        DOM.sidebarOverlay.classList.add('active');
        AppState.sidebarOpen = true;
        document.body.style.overflow = 'hidden';
    },

    close() {
        DOM.sidebar.classList.remove('open');
        DOM.sidebarOverlay.classList.remove('active');
        AppState.sidebarOpen = false;
        document.body.style.overflow = '';
    },

    toggle() {
        if (AppState.sidebarOpen) {
            this.close();
        } else {
            this.open();
        }
    }
};

// ═══════════════════════════════════════════════════════════════════════
// Chat Service
// ═══════════════════════════════════════════════════════════════════════

const ChatService = {
    /**
     * Send message to API
     */
    async sendMessage(question, retryCount = 0) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        try {
            const response = await fetch(`${AppState.config.apiBase}/chat/ask`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    question,
                    history: AppState.chatHistory.slice(-10) // Keep last 5 exchanges
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            clearTimeout(timeoutId);

            // Retry logic for network errors
            if (retryCount < AppState.config.maxRetries &&
                (error.name === 'TypeError' || error.name === 'AbortError')) {
                await new Promise(resolve => setTimeout(resolve, AppState.config.retryDelay * (retryCount + 1)));
                return this.sendMessage(question, retryCount + 1);
            }

            throw error;
        }
    },

    /**
     * Process user question
     */
    async processQuestion(question) {
        if (AppState.isWaiting) return;

        // Validate
        if (!question || question.trim().length < 3) {
            UI.showToast({
                title: 'Question too short',
                message: 'Please enter at least 3 characters',
                type: 'warning'
            });
            return;
        }

        AppState.isWaiting = true;
        UI.updateStatus('loading', 'Thinking...');

        // Hide welcome screen
        DOM.welcomeScreen.style.display = 'none';

        // Add user message
        const userMessage = MessageComponent.create({
            text: question,
            role: 'user'
        });
        DOM.messages.appendChild(userMessage);
        UI.scrollToBottom();

        // Clear input
        DOM.questionInput.value = '';
        UI.autoResizeTextarea();
        UI.updateCharCount();

        // Show typing
        MessageComponent.showTyping();
        DOM.sendBtn.disabled = true;
        DOM.sendBtn.classList.add('spinning');

        try {
            const data = await this.sendMessage(question);
            const answer = data.answer || 'No response received';

            // Update history
            AppState.chatHistory.push(
                { role: 'user', content: question },
                { role: 'assistant', content: answer }
            );
            
            this.saveConversation(); // Save immediately to prevent data loss on refresh

            // Add bot response
            MessageComponent.hideTyping();
            const botMessage = MessageComponent.create({
                text: answer,
                role: 'bot'
            });
            DOM.messages.appendChild(botMessage);

            UI.updateStatus('online', 'Online');

        } catch (error) {
            MessageComponent.hideTyping();

            let errorMessage = 'Something went wrong. Please try again.';

            if (error.name === 'AbortError') {
                errorMessage = 'Request timed out. The server might be busy.';
            } else if (error.message.includes('503')) {
                errorMessage = 'The AI model is warming up. Please try again in a moment.';
            } else if (error.message) {
                errorMessage = error.message;
            }

            const errorEl = MessageComponent.create({
                text: `⚠️ ${errorMessage}`,
                role: 'bot'
            });
            DOM.messages.appendChild(errorEl);

            UI.updateStatus('offline', 'Error');
            console.error('Chat error:', error);
        } finally {
            AppState.isWaiting = false;
            DOM.sendBtn.disabled = false;
            DOM.sendBtn.classList.remove('spinning');
            UI.scrollToBottom();
            DOM.questionInput.focus();
        }
    },

    /**
     * Start new conversation
     */
    newConversation() {
        // Save current conversation if has messages
        if (DOM.messages.children.length > 0 && AppState.chatHistory.length > 0) {
            this.saveConversation();
        }

        // Clear messages
        DOM.messages.innerHTML = '';
        AppState.chatHistory = [];
        AppState.currentConversationId = null;
        AppState.messageCount = 0;

        // Show welcome screen
        DOM.welcomeScreen.style.display = 'block';

        // Reset input
        DOM.questionInput.value = '';
        UI.autoResizeTextarea();
        UI.updateCharCount();

        // Close sidebar on mobile
        if (Utils.isMobile()) {
            SidebarManager.close();
        }
    },

    /**
     * Save conversation to recent chats
     */
    saveConversation() {
        if (!AppState.chatHistory || AppState.chatHistory.length === 0) return;
        
        const historyData = JSON.parse(localStorage.getItem('miet_conversations') || '[]');
        
        const firstUserMsg = AppState.chatHistory.find(m => m.role === 'user');
        const title = firstUserMsg ? firstUserMsg.content.substring(0, 30) + (firstUserMsg.content.length > 30 ? '...' : '') : 'New Chat';
        
        if (!AppState.currentConversationId) {
            AppState.currentConversationId = Utils.generateId();
        }
        
        const convo = {
            id: AppState.currentConversationId,
            timestamp: Date.now(),
            title: title,
            messages: [...AppState.chatHistory]
        };
        
        // Update or append
        const existingIdx = historyData.findIndex(c => c.id === convo.id);
        if (existingIdx >= 0) {
            historyData[existingIdx] = convo; // update
        } else {
            historyData.unshift(convo); // add new to front
        }
        
        // Keep only top 20
        if (historyData.length > 20) {
            historyData.length = 20;
        }
        
        localStorage.setItem('miet_conversations', JSON.stringify(historyData));
        this.renderRecentChats();
    },
    
    /**
     * Render the Recent Chats list
     */
    renderRecentChats() {
        if (!DOM.recentChats) return;
        
        const historyData = JSON.parse(localStorage.getItem('miet_conversations') || '[]');
        
        if (historyData.length === 0) {
            DOM.recentChats.innerHTML = '<div class="empty-state">No recent conversations</div>';
            return;
        }
        
        DOM.recentChats.innerHTML = '';
        historyData.forEach(chat => {
            const date = new Date(chat.timestamp);
            const formattedDate = date.toLocaleDateString() === new Date().toLocaleDateString() ? 
                                 date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 
                                 date.toLocaleDateString([], {month: 'short', day: 'numeric'});
                                 
            // Create a styled block for the chat listing
            const el = document.createElement('div');
            el.className = 'recent-chat-item';
            el.dataset.id = chat.id;
            el.style.cssText = 'padding: 10px; border-radius: 8px; cursor: pointer; border-left: 2px solid transparent; margin-bottom: 4px; transition: all 0.2s;';
            el.innerHTML = `<div style="font-size: 13px; font-weight: 500; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${Utils.escapeHtml(chat.title)}</div>
                            <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">${formattedDate} • ${chat.messages.length} messages</div>`;
            
            // On hover
            el.addEventListener('mouseenter', () => el.style.background = 'var(--bg-elevated)');
            el.addEventListener('mouseleave', () => {
                if(AppState.currentConversationId !== chat.id) el.style.background = 'transparent';
            });
            
            // Active state
            if (AppState.currentConversationId === chat.id) {
                el.style.background = 'var(--bg-elevated)';
                el.style.borderLeftColor = 'var(--accent-primary)';
            }
            
            el.addEventListener('click', () => this.loadConversation(chat.id));
            DOM.recentChats.appendChild(el);
        });
    },

    /**
     * Load a saved conversation
     */
    loadConversation(id) {
        if (DOM.messages.children.length > 0 && AppState.chatHistory.length > 0) {
            this.saveConversation(); // save current before switching
        }
        
        const historyData = JSON.parse(localStorage.getItem('miet_conversations') || '[]');
        const chat = historyData.find(c => c.id === id);
        
        if (!chat) return;
        
        DOM.welcomeScreen.style.display = 'none';
        DOM.messages.innerHTML = '';
        AppState.chatHistory = chat.messages;
        AppState.currentConversationId = chat.id;
        
        chat.messages.forEach(msg => {
            const el = MessageComponent.create({ text: msg.content, role: msg.role === 'assistant' ? 'bot' : 'user' });
            DOM.messages.appendChild(el);
        });
        
        UI.scrollToBottom('auto');
        this.renderRecentChats();
        
        if (Utils.isMobile()) {
            SidebarManager.close();
        }
    }
};

// ═══════════════════════════════════════════════════════════════════════
// Event Handlers
// ═══════════════════════════════════════════════════════════════════════

const EventHandlers = {
    /**
     * Initialize all event listeners
     */
    init() {
        // Form submission
        DOM.chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const question = DOM.questionInput.value.trim();
            ChatService.processQuestion(question);
        });

        // Textarea input
        DOM.questionInput.addEventListener('input', () => {
            UI.updateCharCount();
            UI.autoResizeTextarea();
        });

        // Keyboard shortcuts
        DOM.questionInput.addEventListener('keydown', (e) => {
            // Enter to send, Shift+Enter for newline
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                DOM.chatForm.dispatchEvent(new Event('submit'));
            }

            // Cmd/Ctrl + K for focus
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                DOM.questionInput.focus();
            }
        });

        // Global keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Cmd/Ctrl + N for new chat
            if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
                e.preventDefault();
                ChatService.newConversation();
            }

            // Escape to close sidebar
            if (e.key === 'Escape' && AppState.sidebarOpen) {
                SidebarManager.close();
            }
        });

        // Sidebar controls
        DOM.menuToggle.addEventListener('click', () => SidebarManager.toggle());
        DOM.sidebarClose.addEventListener('click', () => SidebarManager.close());
        DOM.sidebarOverlay.addEventListener('click', () => SidebarManager.close());

        // New chat button
        DOM.newChatBtn.addEventListener('click', () => ChatService.newConversation());

        // Topic list clicks
        DOM.topicList.addEventListener('click', (e) => {
            const li = e.target.closest('li[data-question]');
            if (li) {
                const question = li.dataset.question;
                ChatService.processQuestion(question);
            }
        });

        // Welcome screen suggestion cards
        document.querySelectorAll('.suggestion-card').forEach(card => {
            card.addEventListener('click', () => {
                const question = card.dataset.question;
                ChatService.processQuestion(question);
            });
        });

        // Window resize
        window.addEventListener('resize', Utils.debounce(() => {
            if (!Utils.isMobile() && AppState.sidebarOpen) {
                SidebarManager.close();
            }
        }, 100));

        // Before unload - save conversation
        window.addEventListener('beforeunload', () => {
            if (AppState.chatHistory.length > 0) {
                ChatService.saveConversation();
            }
        });

        // Initialize Local Storage UI list
        ChatService.renderRecentChats();
    }
};

// ═══════════════════════════════════════════════════════════════════════
// Initialization
// ═══════════════════════════════════════════════════════════════════════

function initializeApp() {
    // Check API health
    fetch(`${AppState.config.apiBase}/health`)
        .then(res => {
            if (res.ok) {
                UI.updateStatus('online', 'Online');
            } else {
                UI.updateStatus('offline', 'Offline');
            }
        })
        .catch(() => {
            UI.updateStatus('offline', 'Offline');
        });

    // Initialize event handlers
    EventHandlers.init();

    // Set initial textarea height
    UI.autoResizeTextarea();

    // Focus input on desktop
    if (!Utils.isMobile()) {
        setTimeout(() => DOM.questionInput.focus(), 100);
    }

    // Welcome console message
    console.log('%c🎓 MIET Student Assistant', 'font-size: 24px; font-weight: bold; color: #22d3ee;');
    console.log('%cVersion 2.0.0 - Ready', 'font-size: 14px; color: #94a3b8;');
    console.log('%cKeyboard shortcuts:\n• Cmd/Ctrl + Enter: Send message\n• Cmd/Ctrl + N: New conversation\n• Cmd/Ctrl + K: Focus input', 'font-size: 12px; color: #64748b;');
}

// Start the application
document.addEventListener('DOMContentLoaded', initializeApp);
