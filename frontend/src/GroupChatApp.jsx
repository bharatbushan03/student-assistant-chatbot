import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  ArrowLeft,
  Bell,
  BellOff,
  BookmarkPlus,
  ChevronRight,
  Clock3,
  CircleAlert,
  Download,
  Flag,
  Info,
  Images,
  ListPlus,
  Loader2,
  LogOut,
  MoreVertical,
  MessageSquare,
  Palette,
  Phone,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  UserPlus,
  Video,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';

import { AuthContext } from './context/AuthContext';
import { Header } from './components/Header';
import { InputBar } from './components/InputBar';
import { GroupDetailsScreen } from './components/groups/GroupDetailsScreen';
import { GroupSidebar } from './components/groups/GroupSidebar';
import { GroupMessageBubble } from './components/groups/GroupMessageBubble';
import {
  addGroupMemberByEmail,
  createGroup,
  deleteGroup,
  deleteGroupMessage,
  getGroup,
  getGroupMessages,
  leaveGroup,
  listGroups,
  removeGroupMember,
  searchGroupMessages,
  uploadGroupFiles,
  updateGroup,
  updateGroupMessage,
} from './utils/groupsApi';

const SIDEBAR_STATE_KEY = 'miety-sidebar-open-desktop';
const DISAPPEARING_OPTIONS = ['off', '24h', '7d'];
const CHAT_THEME_OPTIONS = ['default', 'ocean', 'forest', 'dusk'];
const CHAT_THEME_STYLES = {
  default: {
    shell: 'bg-card',
    composer: 'bg-gradient-to-t from-card to-transparent',
  },
  ocean: {
    shell: 'bg-sky-50/40 dark:bg-sky-950/25',
    composer: 'bg-gradient-to-t from-sky-100/45 to-transparent dark:from-sky-900/20',
  },
  forest: {
    shell: 'bg-emerald-50/35 dark:bg-emerald-950/20',
    composer: 'bg-gradient-to-t from-emerald-100/45 to-transparent dark:from-emerald-900/20',
  },
  dusk: {
    shell: 'bg-orange-50/35 dark:bg-orange-950/20',
    composer: 'bg-gradient-to-t from-orange-100/45 to-transparent dark:from-orange-900/20',
  },
};

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

function formatDisappearingMode(mode) {
  if (mode === '24h') {
    return '24 hours';
  }

  if (mode === '7d') {
    return '7 days';
  }

  return 'Off';
}

function getDisappearingThreshold(mode) {
  if (mode === '24h') {
    return 24 * 60 * 60 * 1000;
  }

  if (mode === '7d') {
    return 7 * 24 * 60 * 60 * 1000;
  }

  return 0;
}

function downloadTextFile(fileName, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function parseMemberIds(rawValue) {
  return rawValue
    .split(/[\n,]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function formatConnectionStatus(status) {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'connecting':
      return 'Connecting';
    case 'reconnecting':
      return 'Reconnecting';
    case 'error':
      return 'Connection issue';
    default:
      return 'Offline';
  }
}

function sortMessages(messages) {
  return [...messages].sort((left, right) => {
    return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
  });
}

function upsertMessage(list, incomingMessage) {
  const nextMessage = {
    ...incomingMessage,
    reactions: incomingMessage.reactions || [],
  };

  const index = list.findIndex((message) => message.id === nextMessage.id);
  if (index === -1) {
    return sortMessages([...list, nextMessage]);
  }

  const updated = [...list];
  updated[index] = {
    ...updated[index],
    ...nextMessage,
  };
  return sortMessages(updated);
}

function getTypingLabel(memberNames) {
  if (memberNames.length === 1) {
    return `${memberNames[0]} is typing...`;
  }

  if (memberNames.length === 2) {
    return `${memberNames[0]} and ${memberNames[1]} are typing...`;
  }

  return `${memberNames.length} people are typing...`;
}

function truncateText(value, limit = 120) {
  if (!value) {
    return '';
  }

  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit).trimEnd()}...`;
}

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

export default function GroupChatApp() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const { groupId } = useParams();

  const [isDarkMode, setIsDarkMode] = useState(() => {
    return (
      localStorage.getItem('theme') === 'dark' ||
      (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)
    );
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => getInitialSidebarOpen());
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupsError, setGroupsError] = useState('');
  const [activeGroup, setActiveGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [composerText, setComposerText] = useState('');
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showHeaderSearch, setShowHeaderSearch] = useState(false);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [showGroupDetailsScreen, setShowGroupDetailsScreen] = useState(false);
  const [detailsInitialTab, setDetailsInitialTab] = useState('media');
  const [isMuted, setIsMuted] = useState(false);
  const [isMediaVisible, setIsMediaVisible] = useState(true);
  const [isChatLocked, setIsChatLocked] = useState(false);
  const [disappearingMode, setDisappearingMode] = useState('off');
  const [chatTheme, setChatTheme] = useState('default');
  const [isFavorited, setIsFavorited] = useState(false);
  const [isShortcutAdded, setIsShortcutAdded] = useState(false);
  const [isAddedToList, setIsAddedToList] = useState(false);
  const [groupActionNotice, setGroupActionNotice] = useState('');
  const [groupActionError, setGroupActionError] = useState('');
  const [isLeavingGroup, setIsLeavingGroup] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [socketStatus, setSocketStatus] = useState('offline');
  const [socketMessage, setSocketMessage] = useState('');
  const [typingMemberIds, setTypingMemberIds] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    avatarUrl: '',
    memberIds: '',
    isAiEnabled: true,
    aiAutoRespond: false,
  });
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [addFriendEmail, setAddFriendEmail] = useState('');
  const [addFriendError, setAddFriendError] = useState('');
  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const [selectedUploadFiles, setSelectedUploadFiles] = useState([]);

  const socketRef = useRef(null);
  const activeGroupIdRef = useRef(groupId || null);
  const typingTimerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const headerMenuRef = useRef(null);
  const searchInputRef = useRef(null);

  const currentUserId = user?.id || user?._id || null;
  const memberList = useMemo(() => activeGroup?.members || [], [activeGroup?.members]);
  const currentUserRole = useMemo(() => {
    return memberList.find((member) => member.user_id === currentUserId)?.role || null;
  }, [memberList, currentUserId]);
  const isAdmin = currentUserRole === 'admin';
  const canModerate = currentUserRole === 'admin' || currentUserRole === 'moderator';
  const messageMap = useMemo(() => {
    return new Map(messages.map((message) => [message.id, message]));
  }, [messages]);

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
    activeGroupIdRef.current = groupId || null;
  }, [groupId]);

  useEffect(() => {
    setComposerText('');
    setSelectedUploadFiles([]);
    setReplyToMessage(null);
    setEditingMessage(null);
    setSearchQuery('');
    setSearchResults([]);
    setIsSearchMode(false);
    setShowHeaderSearch(false);
    setShowGroupDetailsScreen(false);
    setDetailsInitialTab('media');
    setIsHeaderMenuOpen(false);
    setIsMoreMenuOpen(false);
    setGroupActionNotice('');
    setGroupActionError('');
  }, [groupId]);

  useEffect(() => {
    if (!showHeaderSearch) {
      return;
    }

    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showHeaderSearch]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!headerMenuRef.current) {
        return;
      }

      if (headerMenuRef.current.contains(event.target)) {
        return;
      }

      setIsHeaderMenuOpen(false);
      setIsMoreMenuOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  const loadGroups = useCallback(async ({ skipRedirect = false } = {}) => {
    setGroupsLoading(true);
    setGroupsError('');

    try {
      const data = await listGroups();
      setGroups(data);

      if (!skipRedirect && !groupId && data.length > 0) {
        navigate(`/groups/${data[0].id}`, { replace: true });
      }
    } catch (error) {
      console.error(error);
      setGroupsError('Unable to load your groups right now.');
    } finally {
      setGroupsLoading(false);
    }
  }, [groupId, navigate]);

  const loadActiveGroup = useCallback(async (selectedGroupId) => {
    if (!selectedGroupId) {
      setActiveGroup(null);
      setMessages([]);
      setTypingMemberIds([]);
      return;
    }

    setMessagesLoading(true);
    setSocketMessage('');

    try {
      const [groupData, historyData] = await Promise.all([
        getGroup(selectedGroupId),
        getGroupMessages(selectedGroupId, { limit: 100 }),
      ]);

      setActiveGroup(groupData);
      setMessages(sortMessages(historyData.messages || []));
      setTypingMemberIds([]);
    } catch (error) {
      console.error(error);
      setSocketMessage('Unable to load this group conversation.');
      setActiveGroup(null);
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  const refreshActiveGroup = useCallback(async () => {
    if (!groupId) {
      return;
    }

    try {
      const groupData = await getGroup(groupId);
      setActiveGroup(groupData);
    } catch (error) {
      console.error(error);
    }
  }, [groupId]);

  const refreshMessages = useCallback(async () => {
    if (!groupId) {
      return;
    }

    try {
      const historyData = await getGroupMessages(groupId, { limit: 100 });
      setMessages(sortMessages(historyData.messages || []));
    } catch (error) {
      console.error(error);
    }
  }, [groupId]);

  const handleSelectGroup = useCallback((selectedGroupId) => {
    navigate(`/groups/${selectedGroupId}`);
  }, [navigate]);

  const handleCreateGroup = useCallback(async (event) => {
    event.preventDefault();
    setCreateError('');

    if (!createForm.name.trim()) {
      setCreateError('Group name is required.');
      return;
    }

    try {
      const payload = {
        name: createForm.name.trim(),
        description: createForm.description.trim() || null,
        avatar_url: createForm.avatarUrl.trim() || null,
        member_ids: parseMemberIds(createForm.memberIds),
        is_ai_enabled: createForm.isAiEnabled,
        ai_auto_respond: createForm.aiAutoRespond,
      };

      const createdGroup = await createGroup(payload);
      setShowCreateModal(false);
      setCreateForm({
        name: '',
        description: '',
        avatarUrl: '',
        memberIds: '',
        isAiEnabled: true,
        aiAutoRespond: false,
      });
      await loadGroups({ skipRedirect: true });
      navigate(`/groups/${createdGroup.id}`);
    } catch (error) {
      console.error(error);
      const detail = error?.response?.data?.detail;
      setCreateError(typeof detail === 'string' ? detail : 'Failed to create the group.');
    }
  }, [createForm, loadGroups, navigate]);

  const handleAddFriend = useCallback(async (event) => {
    event.preventDefault();
    setAddFriendError('');

    if (!groupId) {
      setAddFriendError('Select a group first.');
      return;
    }

    const normalizedEmail = addFriendEmail.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      setAddFriendError('Enter a valid email address.');
      return;
    }

    setIsAddingFriend(true);

    try {
      const result = await addGroupMemberByEmail(groupId, normalizedEmail);

      if (!result?.count) {
        setAddFriendError('Unable to add this friend right now.');
        return;
      }

      setShowAddFriendModal(false);
      setAddFriendEmail('');
      await Promise.all([
        refreshActiveGroup(),
        loadGroups({ skipRedirect: true }),
      ]);
    } catch (error) {
      console.error(error);
      const detail = error?.response?.data?.detail;
      setAddFriendError(typeof detail === 'string' ? detail : 'Failed to add friend.');
    } finally {
      setIsAddingFriend(false);
    }
  }, [addFriendEmail, groupId, refreshActiveGroup, loadGroups]);

  const clearComposerMode = useCallback(() => {
    setReplyToMessage(null);
    setEditingMessage(null);
    setComposerText('');
  }, []);

  const clearSearchResults = useCallback(() => {
    setIsSearchMode(false);
    setSearchResults([]);
    setGroupActionError('');
  }, []);

  const handleReplyMessage = useCallback((message) => {
    setGroupActionError('');
    setEditingMessage(null);
    setReplyToMessage(message);
  }, []);

  const handleEditMessage = useCallback((message) => {
    setGroupActionError('');
    setReplyToMessage(null);
    setEditingMessage(message);
    setComposerText(message.content || '');
  }, []);

  const handleDeleteMessage = useCallback(async (message) => {
    if (!groupId) {
      return;
    }

    const isConfirmed = window.confirm('Delete this message for everyone?');
    if (!isConfirmed) {
      return;
    }

    setGroupActionError('');

    try {
      await deleteGroupMessage(groupId, message.id);

      setMessages((currentMessages) => {
        return currentMessages.filter((currentMessage) => currentMessage.id !== message.id);
      });

      setSearchResults((currentResults) => {
        return currentResults.filter((currentMessage) => currentMessage.id !== message.id);
      });

      if (replyToMessage?.id === message.id) {
        setReplyToMessage(null);
      }

      if (editingMessage?.id === message.id) {
        setEditingMessage(null);
        setComposerText('');
      }
    } catch (error) {
      console.error(error);
      const detail = error?.response?.data?.detail;
      setGroupActionError(typeof detail === 'string' ? detail : 'Failed to delete this message.');
    }
  }, [editingMessage, groupId, replyToMessage]);

  const handleSearchMessages = useCallback(async (event) => {
    event.preventDefault();

    if (!groupId) {
      return;
    }

    const normalizedQuery = searchQuery.trim();
    if (!normalizedQuery) {
      clearSearchResults();
      return;
    }

    setIsSearching(true);
    setGroupActionError('');

    try {
      const result = await searchGroupMessages(groupId, normalizedQuery, 50);
      setSearchResults(sortMessages(result.messages || []));
      setIsSearchMode(true);
    } catch (error) {
      console.error(error);
      const detail = error?.response?.data?.detail;
      setGroupActionError(typeof detail === 'string' ? detail : 'Unable to search messages right now.');
    } finally {
      setIsSearching(false);
    }
  }, [clearSearchResults, groupId, searchQuery]);

  const handleLeaveCurrentGroup = useCallback(async () => {
    if (!groupId || isLeavingGroup) {
      return;
    }

    const isConfirmed = window.confirm('Leave this group? An admin can add you again later.');
    if (!isConfirmed) {
      return;
    }

    setIsLeavingGroup(true);
    setGroupActionError('');

    try {
      await leaveGroup(groupId);
      const updatedGroups = await listGroups();

      setGroups(updatedGroups);
      setActiveGroup(null);
      setMessages([]);
      setTypingMemberIds([]);
      clearComposerMode();
      clearSearchResults();

      if (updatedGroups.length > 0) {
        navigate(`/groups/${updatedGroups[0].id}`, { replace: true });
      } else {
        navigate('/groups', { replace: true });
      }
    } catch (error) {
      console.error(error);
      const detail = error?.response?.data?.detail;
      setGroupActionError(typeof detail === 'string' ? detail : 'Unable to leave this group.');
    } finally {
      setIsLeavingGroup(false);
    }
  }, [clearComposerMode, clearSearchResults, groupId, isLeavingGroup, navigate]);

  const closeMenus = useCallback(() => {
    setIsHeaderMenuOpen(false);
    setIsMoreMenuOpen(false);
  }, []);

  const handlePrototypeAction = useCallback((label) => {
    setGroupActionNotice(`${label} is available as a prototype in this demo.`);
    closeMenus();
  }, [closeMenus]);

  const handleBackFromGroupChat = useCallback(() => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate('/groups');
  }, [navigate]);

  const handleToggleMuteMessages = useCallback(() => {
    setIsMuted((current) => {
      const next = !current;
      setGroupActionNotice(next ? 'Messages muted for this chat.' : 'Messages unmuted for this chat.');
      return next;
    });
    closeMenus();
  }, [closeMenus]);

  const handleConfigureDisappearingMessages = useCallback(() => {
    const selected = window.prompt(
      'Set disappearing messages mode (off, 24h, 7d):',
      disappearingMode
    );

    if (selected === null) {
      return;
    }

    const normalized = selected.trim().toLowerCase();
    if (!DISAPPEARING_OPTIONS.includes(normalized)) {
      setGroupActionNotice('Invalid value. Choose off, 24h, or 7d.');
      return;
    }

    setDisappearingMode(normalized);
    setGroupActionNotice(`Disappearing messages set to ${formatDisappearingMode(normalized)}.`);
    closeMenus();
  }, [closeMenus, disappearingMode]);

  const handleChatTheme = useCallback(() => {
    const selected = window.prompt(
      'Set chat theme (default, ocean, forest, dusk):',
      chatTheme
    );

    if (selected === null) {
      return;
    }

    const normalized = selected.trim().toLowerCase();
    if (!CHAT_THEME_OPTIONS.includes(normalized)) {
      setGroupActionNotice('Invalid theme. Choose default, ocean, forest, or dusk.');
      return;
    }

    setChatTheme(normalized);
    setGroupActionNotice(`Chat theme changed to ${normalized}.`);
    closeMenus();
  }, [chatTheme, closeMenus]);

  const handleOpenSearch = useCallback(() => {
    setShowHeaderSearch(true);
    setGroupActionNotice('Search opened.');
    closeMenus();
  }, [closeMenus]);

  const handleClearChat = useCallback(() => {
    const isConfirmed = window.confirm('Clear all messages from this chat view?');
    if (!isConfirmed) {
      return;
    }

    setMessages([]);
    setSearchResults([]);
    setIsSearchMode(false);
    setGroupActionNotice('Chat cleared locally.');
    closeMenus();
  }, [closeMenus]);

  const handleExportChat = useCallback(() => {
    if (!activeGroup) {
      return;
    }

    const lines = messages.map((message) => {
      const senderName = message.sender?.name || (message.type === 'ai_response' ? 'Miety AI' : 'Member');
      const timestamp = message.created_at ? new Date(message.created_at).toLocaleString() : 'Unknown time';
      return `[${timestamp}] ${senderName}:\n${message.content || ''}`;
    });

    const exportContent = `# ${activeGroup.name}\n\n${lines.length > 0 ? lines.join('\n\n') : 'No messages yet.'}`;
    const fileName = `${activeGroup.name || 'group-chat'}-export.txt`
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    downloadTextFile(fileName || 'group-chat-export.txt', exportContent);
    setGroupActionNotice('Chat exported successfully.');
    closeMenus();
  }, [activeGroup, closeMenus, messages]);

  const handleToggleShortcut = useCallback(() => {
    setIsShortcutAdded((current) => {
      const next = !current;
      setGroupActionNotice(next ? 'Shortcut added for this group.' : 'Shortcut removed for this group.');
      return next;
    });
    closeMenus();
  }, [closeMenus]);

  const handleToggleList = useCallback(() => {
    setIsAddedToList((current) => {
      const next = !current;
      setGroupActionNotice(next ? 'Group added to your list.' : 'Group removed from your list.');
      return next;
    });
    closeMenus();
  }, [closeMenus]);

  const handleReportGroup = useCallback(() => {
    const isConfirmed = window.confirm('Report this group for review?');
    if (!isConfirmed) {
      return;
    }

    setGroupActionNotice('Group reported. Our team will review it.');
    closeMenus();
  }, [closeMenus]);

  const handleJumpToLatest = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    setGroupActionNotice('Jumped to latest messages.');
  }, []);

  const openGroupDetailsScreen = useCallback((initialTab = 'media') => {
    setDetailsInitialTab(initialTab);
    setShowGroupDetailsScreen(true);
  }, []);

  const handleManageStorage = useCallback(() => {
    const contentSize = messages.reduce((total, message) => total + (message.content || '').length, 0);
    const sizeInKb = Math.max(1, Math.round(contentSize / 1024));
    setGroupActionNotice(`Approximate local chat footprint: ${sizeInKb} KB.`);
  }, [messages]);

  const handleToggleMediaVisibility = useCallback(() => {
    setIsMediaVisible((current) => {
      const next = !current;
      setGroupActionNotice(next ? 'Media visibility enabled.' : 'Media visibility hidden.');
      return next;
    });
  }, []);

  const handleToggleChatLock = useCallback(() => {
    setIsChatLocked((current) => {
      const next = !current;
      setGroupActionNotice(next ? 'Chat lock enabled.' : 'Chat lock disabled.');
      return next;
    });
  }, []);

  const handleToggleFavorite = useCallback(() => {
    setIsFavorited((current) => {
      const next = !current;
      setGroupActionNotice(next ? 'Added to favorites.' : 'Removed from favorites.');
      return next;
    });
  }, []);

  const handleSaveGroupDescription = useCallback(async (nextDescription) => {
    if (!groupId || !isAdmin) {
      setGroupActionError('Only admins can edit group information.');
      return;
    }

    try {
      const updated = await updateGroup(groupId, { description: nextDescription });
      setActiveGroup((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          description: updated?.description ?? nextDescription,
          updated_at: updated?.updated_at || current.updated_at,
        };
      });
      setGroupActionNotice('Group description updated.');
      await loadGroups({ skipRedirect: true });
    } catch (error) {
      console.error(error);
      const detail = error?.response?.data?.detail;
      setGroupActionError(typeof detail === 'string' ? detail : 'Unable to update group description.');
      throw error;
    }
  }, [groupId, isAdmin, loadGroups]);

  const handleRemoveMemberFromGroup = useCallback(async (memberUserId) => {
    if (!groupId || !isAdmin) {
      setGroupActionError('Only admins can remove members.');
      return;
    }

    try {
      await removeGroupMember(groupId, memberUserId);
      await Promise.all([
        refreshActiveGroup(),
        loadGroups({ skipRedirect: true }),
      ]);
      setGroupActionNotice('Member removed from group.');
    } catch (error) {
      console.error(error);
      const detail = error?.response?.data?.detail;
      setGroupActionError(typeof detail === 'string' ? detail : 'Unable to remove this member.');
      throw error;
    }
  }, [groupId, isAdmin, loadGroups, refreshActiveGroup]);

  const handleDeleteCurrentGroup = useCallback(async () => {
    if (!groupId || !isAdmin) {
      setGroupActionError('Only admins can delete this group.');
      return;
    }

    const isConfirmed = window.confirm('Delete this group permanently? This cannot be undone.');
    if (!isConfirmed) {
      return;
    }

    try {
      await deleteGroup(groupId);
      const remainingGroups = await listGroups();
      setGroups(remainingGroups);
      setShowGroupDetailsScreen(false);

      if (remainingGroups.length > 0) {
        navigate(`/groups/${remainingGroups[0].id}`, { replace: true });
      } else {
        navigate('/groups', { replace: true });
      }
    } catch (error) {
      console.error(error);
      const detail = error?.response?.data?.detail;
      setGroupActionError(typeof detail === 'string' ? detail : 'Unable to delete this group.');
    }
  }, [groupId, isAdmin, navigate]);

  const handleSendMessage = useCallback(async (content) => {
    if (!groupId) {
      setGroupActionError('Select a group first.');
      return false;
    }

    setGroupActionError('');

    if (editingMessage) {
      setIsSending(true);

      const attachedNames = selectedUploadFiles.map((file, index) => getAttachmentName(file, index));
      const attachedFileBlock = attachedNames.length > 0
        ? `\n\nAttached files:\n${attachedNames.map((name) => `- ${name}`).join('\n')}`
        : '';
      const outboundContent = `${content}${attachedFileBlock}`;

      try {
        const updatedMessage = await updateGroupMessage(groupId, editingMessage.id, outboundContent);

        setMessages((currentMessages) => upsertMessage(currentMessages, updatedMessage));
        setSearchResults((currentResults) => currentResults.map((currentMessage) => {
          if (currentMessage.id !== updatedMessage.id) {
            return currentMessage;
          }
          return updatedMessage;
        }));

        setEditingMessage(null);
        setComposerText('');
        setSelectedUploadFiles([]);
        return true;
      } catch (error) {
        console.error(error);
        const detail = error?.response?.data?.detail;
        setGroupActionError(typeof detail === 'string' ? detail : 'Failed to edit this message.');
        setComposerText(content);
        return false;
      } finally {
        setIsSending(false);
      }
    }

    const socket = socketRef.current;
    if (!socket || socketStatus !== 'connected') {
      setSocketMessage('Connect to the room before sending messages.');
      return false;
    }

    setSocketMessage('');
    setIsSending(true);

    const attachments = selectedUploadFiles.map((file, index) => ({
      id: getAttachmentId(file, index),
      file_id: file.id || file.file_id || null,
      filename: getAttachmentName(file, index),
      content_type: file.content_type || file.type || 'application/octet-stream',
      size_bytes: Number(file.size_bytes || file.size || 0),
      preview_text: String(file.preview_text || ''),
    }));
    const attachedDetails = attachments
      .map((file) => {
        if (!file.preview_text) {
          return `- ${file.filename}`;
        }

        return `- ${file.filename}: ${file.preview_text}`;
      })
      .join('\n');

    const attachedFileBlock = attachments.length > 0
      ? `\n\nAttached files:\n${attachedDetails}`
      : '';
    const outboundContent = `${content}${attachedFileBlock}`;

    socket.emit('send_message', {
      group_id: groupId,
      content: outboundContent,
      message_type: attachments.length > 0 ? 'file' : 'text',
      reply_to_id: replyToMessage?.id,
      metadata: {
        attachments,
      },
    });
    setReplyToMessage(null);
    setSelectedUploadFiles([]);
    return true;
  }, [editingMessage, groupId, replyToMessage, selectedUploadFiles, socketStatus]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    loadActiveGroup(groupId || null);
  }, [groupId, loadActiveGroup]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setSocketStatus('offline');
      setSocketMessage('Sign in to join the group room.');
      return undefined;
    }

    const socket = io({
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;
    setSocketStatus('connecting');

    socket.on('connect', () => {
      setSocketStatus('connected');
      setSocketMessage('');
    });

    socket.on('disconnect', () => {
      setSocketStatus('offline');
      setIsSending(false);
      setTypingMemberIds([]);
    });

    socket.on('connect_error', (error) => {
      console.error(error);
      setSocketStatus('error');
      setSocketMessage('Unable to reach the real-time server.');
      setIsSending(false);
    });

    socket.on('message_created', ({ message, group_id }) => {
      if (group_id !== activeGroupIdRef.current) {
        return;
      }

      setMessages((currentMessages) => upsertMessage(currentMessages, message));
      setIsSending(false);
    });

    socket.on('ai_response', ({ message, group_id }) => {
      if (group_id !== activeGroupIdRef.current) {
        return;
      }

      setMessages((currentMessages) => upsertMessage(currentMessages, message));
    });

    socket.on('reaction_added', async () => {
      if (!activeGroupIdRef.current) {
        return;
      }

      await refreshMessages();
    });

    socket.on('reaction_removed', async () => {
      if (!activeGroupIdRef.current) {
        return;
      }

      await refreshMessages();
    });

    socket.on('user_joined', async ({ group_id }) => {
      if (group_id !== activeGroupIdRef.current) {
        return;
      }

      await refreshActiveGroup();
    });

    socket.on('user_left', async ({ group_id }) => {
      if (group_id !== activeGroupIdRef.current) {
        return;
      }

      await refreshActiveGroup();
    });

    socket.on('typing', ({ group_id, user_id, is_typing }) => {
      if (group_id !== activeGroupIdRef.current || user_id === currentUserId) {
        return;
      }

      setTypingMemberIds((currentTyping) => {
        if (is_typing) {
          return currentTyping.includes(user_id) ? currentTyping : [...currentTyping, user_id];
        }

        return currentTyping.filter((id) => id !== user_id);
      });
    });

    socket.on('messages_read', ({ group_id }) => {
      if (group_id !== activeGroupIdRef.current) {
        return;
      }
    });

    socket.on('error', (payload) => {
      console.error(payload);
      setSocketMessage(payload?.message || 'Real-time messaging error.');
      setIsSending(false);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [currentUserId, refreshActiveGroup, refreshMessages]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || socketStatus !== 'connected' || !groupId) {
      return undefined;
    }

    socket.emit('join_group', { group_id: groupId });

    return () => {
      socket.emit('leave_group', { group_id: groupId });
    };
  }, [groupId, socketStatus]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || socketStatus !== 'connected' || !groupId) {
      return undefined;
    }

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }

    if (composerText.trim()) {
      socket.emit('typing_start', { group_id: groupId });
      typingTimerRef.current = setTimeout(() => {
        socket.emit('typing_stop', { group_id: groupId });
      }, 1100);
    } else {
      socket.emit('typing_stop', { group_id: groupId });
    }

    return () => {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
    };
  }, [composerText, groupId, socketStatus]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, typingMemberIds, isSending, messagesLoading]);

  const typingNames = useMemo(() => {
    return typingMemberIds
      .map((memberId) => memberList.find((member) => member.user_id === memberId)?.name || 'Someone')
      .filter(Boolean);
  }, [memberList, typingMemberIds]);
  const groupAttachedFiles = useMemo(() => {
    return selectedUploadFiles.map((file, index) => ({
      id: getAttachmentId(file, index),
      name: getAttachmentName(file, index),
    }));
  }, [selectedUploadFiles]);

  const handleAddGroupFiles = useCallback(async (pickedFiles) => {
    if (!groupId) {
      setGroupActionError('Select a group first.');
      return;
    }

    setIsUploadingFiles(true);
    setGroupActionError('');

    try {
      const uploadedFiles = await uploadGroupFiles(groupId, pickedFiles);
      setSelectedUploadFiles((currentFiles) => {
        const nextById = new Map(
          currentFiles.map((file, index) => [getAttachmentId(file, index), file])
        );
        uploadedFiles.forEach((file, index) => {
          nextById.set(getAttachmentId(file, index), file);
        });
        return Array.from(nextById.values());
      });
      setGroupActionNotice(`${uploadedFiles.length} file${uploadedFiles.length === 1 ? '' : 's'} uploaded.`);
    } catch (error) {
      console.error(error);
      const detail = error?.response?.data?.detail;
      setGroupActionError(typeof detail === 'string' ? detail : 'Failed to upload file attachments.');
    } finally {
      setIsUploadingFiles(false);
    }
  }, [groupId]);

  const handleRemoveGroupFile = useCallback((selectedFile) => {
    const targetId = getAttachmentId(selectedFile);
    setSelectedUploadFiles((currentFiles) => {
      return currentFiles.filter((file, index) => getAttachmentId(file, index) !== targetId);
    });
  }, []);

  const { groupMediaItems, groupLinkItems, groupDocumentItems } = useMemo(() => {
    const urlPattern = /(https?:\/\/[^\s)]+)/gi;
    const mediaPattern = /\.(png|jpe?g|gif|webp|mp4|mov|mkv)(\?.*)?$/i;
    const documentPattern = /\.(pdf|docx?|pptx?|xlsx?|txt|csv)(\?.*)?$/i;

    const seen = new Set();
    const media = [];
    const links = [];
    const documents = [];

    messages.forEach((message) => {
      const content = String(message.content || '');
      const matches = content.match(urlPattern) || [];

      matches.forEach((url) => {
        if (seen.has(url)) {
          return;
        }

        seen.add(url);
        const item = {
          url,
          sender: message.sender?.name || 'Member',
          created_at: message.created_at || null,
        };

        if (mediaPattern.test(url)) {
          media.push(item);
          return;
        }

        if (documentPattern.test(url)) {
          documents.push(item);
          return;
        }

        links.push(item);
      });
    });

    return {
      groupMediaItems: media,
      groupLinkItems: links,
      groupDocumentItems: documents,
    };
  }, [messages]);

  const normalizedSearchQuery = searchQuery.trim();
  const displayedMessages = useMemo(() => {
    const sourceMessages = isSearchMode ? searchResults : messages;
    const threshold = getDisappearingThreshold(disappearingMode);

    if (!threshold) {
      return sourceMessages;
    }

    const cutoff = Date.now() - threshold;
    return sourceMessages.filter((message) => {
      const messageTime = message?.created_at ? new Date(message.created_at).getTime() : Number.NaN;
      return Number.isNaN(messageTime) || messageTime >= cutoff;
    });
  }, [disappearingMode, isSearchMode, messages, searchResults]);

  const activeThemeStyles = CHAT_THEME_STYLES[chatTheme] || CHAT_THEME_STYLES.default;

  const connectionLabel = formatConnectionStatus(socketStatus);

  const activeGroupSummary = activeGroup ? (
    <div className="rounded-2xl border border-border bg-card/90 px-3 py-2 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={handleBackFromGroupChat}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/80 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Back"
            title="Back"
          >
            <ArrowLeft size={16} />
          </button>

          <button
            type="button"
            onClick={() => openGroupDetailsScreen('media')}
            className="flex min-w-0 items-center gap-2 rounded-xl px-1.5 py-1 text-left transition-colors hover:bg-muted/50"
            title="Open group details"
          >
            {activeGroup.avatar_url ? (
              <img
                src={activeGroup.avatar_url}
                alt={activeGroup.name}
                className="h-9 w-9 rounded-full border border-border object-cover"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-muted text-xs font-semibold text-foreground">
                {getInitials(activeGroup.name)}
              </div>
            )}

            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold text-foreground">{activeGroup.name}</h1>
              <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  {socketStatus === 'connected' ? <Wifi size={12} /> : <WifiOff size={12} />}
                  {connectionLabel}
                </span>
                <span>•</span>
                <span>{memberList.length} members</span>
                {isMuted && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
                    Muted
                  </span>
                )}
                {disappearingMode !== 'off' && (
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                    Disappears {formatDisappearingMode(disappearingMode)}
                  </span>
                )}
              </div>
            </div>
          </button>
        </div>

        <div className="flex items-center gap-1" ref={headerMenuRef}>
          <button
            type="button"
            onClick={() => handlePrototypeAction('Video call')}
            className="inline-flex items-center justify-center rounded-full border border-border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Video call"
            title="Video call (Prototype)"
          >
            <Video size={14} />
          </button>

          <button
            type="button"
            onClick={() => handlePrototypeAction('Voice call')}
            className="inline-flex items-center justify-center rounded-full border border-border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Voice call"
            title="Voice call (Prototype)"
          >
            <Phone size={14} />
          </button>

          <button
            type="button"
            onClick={handleJumpToLatest}
            className="inline-flex items-center justify-center rounded-full border border-border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Message shortcut"
            title="Jump to latest messages"
          >
            <MessageSquare size={14} />
          </button>

          <button
            type="button"
            onClick={() => {
              setIsHeaderMenuOpen((current) => {
                const next = !current;
                if (!next) {
                  setIsMoreMenuOpen(false);
                }
                return next;
              });
            }}
            className="inline-flex items-center justify-center rounded-full border border-border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Open group options"
            title="More options"
          >
            <MoreVertical size={14} />
          </button>

          {isHeaderMenuOpen && (
            <div className="absolute right-0 top-11 z-50 w-64 animate-fade-in rounded-2xl border border-border bg-popover/95 p-1.5 shadow-xl backdrop-blur">
              {!isMoreMenuOpen ? (
                <div className="space-y-1">
                  <MenuEntryButton
                    icon={UserPlus}
                    label="Add Member"
                    onClick={() => {
                      if (!isAdmin) {
                        setGroupActionNotice('Only admins can add members.');
                        closeMenus();
                        return;
                      }
                      setAddFriendError('');
                      setShowAddFriendModal(true);
                      closeMenus();
                    }}
                  />
                  <MenuEntryButton
                    icon={Info}
                    label="Group Information"
                    onClick={() => {
                      openGroupDetailsScreen('media');
                      closeMenus();
                    }}
                  />
                  <MenuEntryButton
                    icon={Images}
                    label="Group Media"
                    onClick={() => {
                      openGroupDetailsScreen('media');
                      closeMenus();
                    }}
                  />
                  <MenuEntryButton
                    icon={isMuted ? Bell : BellOff}
                    label={isMuted ? 'Unmute Messages' : 'Mute Messages'}
                    onClick={handleToggleMuteMessages}
                  />
                  <MenuEntryButton
                    icon={Clock3}
                    label={`Disappearing Messages (${formatDisappearingMode(disappearingMode)})`}
                    onClick={handleConfigureDisappearingMessages}
                  />
                  <MenuEntryButton
                    icon={Palette}
                    label={`Chat Theme (${chatTheme})`}
                    onClick={handleChatTheme}
                  />
                  <MenuEntryButton
                    icon={Search}
                    label="Search"
                    onClick={handleOpenSearch}
                  />
                  <MenuEntryButton
                    icon={ChevronRight}
                    label="More"
                    onClick={() => setIsMoreMenuOpen(true)}
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setIsMoreMenuOpen(false)}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted/70"
                  >
                    <ArrowLeft size={14} />
                    Back
                  </button>

                  <MenuEntryButton icon={Trash2} label="Clear Chat" onClick={handleClearChat} />
                  <MenuEntryButton icon={Download} label="Export Chat" onClick={handleExportChat} />
                  <MenuEntryButton
                    icon={Clock3}
                    label="Disappearing Messages"
                    onClick={handleConfigureDisappearingMessages}
                  />
                  <MenuEntryButton
                    icon={BookmarkPlus}
                    label={isShortcutAdded ? 'Remove Shortcut' : 'Add Shortcut'}
                    onClick={handleToggleShortcut}
                  />
                  <MenuEntryButton
                    icon={ListPlus}
                    label={isAddedToList ? 'Remove from List' : 'Add to List'}
                    onClick={handleToggleList}
                  />
                  <MenuEntryButton
                    icon={LogOut}
                    label="Exit Group"
                    onClick={() => {
                      closeMenus();
                      handleLeaveCurrentGroup();
                    }}
                    destructive
                  />
                  <MenuEntryButton
                    icon={Flag}
                    label="Report Group"
                    onClick={handleReportGroup}
                    destructive
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {(showHeaderSearch || isSearchMode) && (
        <form onSubmit={handleSearchMessages} className="mt-2 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full rounded-full border border-border bg-muted/30 py-1.5 pl-8 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
              placeholder="Search messages"
            />
          </div>

          <button
            type="submit"
            disabled={!normalizedSearchQuery || isSearching}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSearching ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
            {isSearching ? 'Searching...' : 'Search'}
          </button>

          {isSearchMode && (
            <button
              type="button"
              onClick={clearSearchResults}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X size={13} />
              Clear
            </button>
          )}
        </form>
      )}

      {isSearchMode && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Showing {searchResults.length} result{searchResults.length === 1 ? '' : 's'} for &quot;{normalizedSearchQuery}&quot;.
        </p>
      )}

      {groupActionNotice && (
        <p className="mt-1 text-[11px] text-foreground/70">{groupActionNotice}</p>
      )}
    </div>
  ) : (
    <div className="rounded-2xl border border-dashed border-border bg-card/60 px-4 py-3">
      <p className="text-sm font-medium text-foreground">Select a group to start chatting</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Choose a room from the sidebar or create a new group.
      </p>
    </div>
  );

  return (
    <div className="app-shell">
      <GroupSidebar
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        groups={groups}
        activeGroupId={groupId || undefined}
        onSelectGroup={handleSelectGroup}
        onNewGroup={() => setShowCreateModal(true)}
        isLoading={groupsLoading}
      />

      <main className="app-main">
        <Header
          toggleSidebar={() => setIsSidebarOpen((current) => !current)}
          isDarkMode={isDarkMode}
          toggleDarkMode={() => setIsDarkMode((current) => !current)}
          title="Group Rooms"
        />

        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-3 md:p-4">
          {groupsError && (
            <div className="flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
              <CircleAlert size={16} />
              {groupsError}
            </div>
          )}

          {socketMessage && (
            <div className="flex items-center gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
              <CircleAlert size={16} />
              {socketMessage}
            </div>
          )}

          {groupActionError && (
            <div className="flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
              <CircleAlert size={16} />
              {groupActionError}
            </div>
          )}

          {activeGroupSummary}

          <div className={`surface-panel min-h-0 flex-1 overflow-hidden ${activeThemeStyles.shell}`}>
            {groupId ? (
              <div className="flex h-full flex-col">
                <GroupMessagesList
                  messages={displayedMessages}
                  currentUserId={currentUserId}
                  isLoading={messagesLoading}
                  typingNames={typingNames}
                  isSending={isSending}
                  canModerate={canModerate}
                  messageMap={messageMap}
                  isSearchMode={isSearchMode}
                  searchQuery={normalizedSearchQuery}
                  onReplyMessage={handleReplyMessage}
                  onEditMessage={handleEditMessage}
                  onDeleteMessage={handleDeleteMessage}
                  endRef={messagesEndRef}
                />

                <div className={`border-t border-border px-4 pb-4 pt-5 ${activeThemeStyles.composer}`}>
                  {(replyToMessage || editingMessage) && (
                    <div className="mx-auto mb-3 flex w-full max-w-3xl items-start justify-between gap-3 rounded-2xl border border-border bg-muted/35 px-4 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">
                          {editingMessage ? 'Editing message' : `Replying to ${replyToMessage?.sender?.name || 'Member'}`}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {truncateText(editingMessage?.content || replyToMessage?.content || '')}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={clearComposerMode}
                        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <X size={12} />
                        Cancel
                      </button>
                    </div>
                  )}

                  <InputBar
                    onSendMessage={handleSendMessage}
                    isProcessing={isSending || isUploadingFiles || socketStatus !== 'connected'}
                    placeholder={activeGroup ? `Message ${activeGroup.name}` : 'Type a message'}
                    helperText={
                      editingMessage
                        ? 'Editing mode: send to save changes.'
                        : selectedUploadFiles.length > 0
                        ? `Attached: ${selectedUploadFiles.slice(0, 2).map((file, index) => getAttachmentName(file, index)).join(', ')}${selectedUploadFiles.length > 2 ? ` +${selectedUploadFiles.length - 2} more` : ''}`
                        : socketStatus === 'connected'
                        ? ''
                        : 'Waiting for a real-time connection.'
                    }
                    value={composerText}
                    onValueChange={setComposerText}
                    onFilesSelected={handleAddGroupFiles}
                    selectedFiles={groupAttachedFiles}
                    onRemoveSelectedFile={handleRemoveGroupFile}
                  />
                </div>
              </div>
            ) : (
              <EmptyGroupState
                isLoading={groupsLoading}
                onCreateGroup={() => setShowCreateModal(true)}
                onGoBack={() => navigate('/')}
              />
            )}
          </div>
        </div>
      </main>

      <GroupDetailsScreen
        isOpen={showGroupDetailsScreen && Boolean(activeGroup)}
        onClose={() => setShowGroupDetailsScreen(false)}
        group={activeGroup}
        members={memberList}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        onAudioCall={() => handlePrototypeAction('Audio call')}
        onVideoCall={() => handlePrototypeAction('Video call')}
        onAddMember={() => {
          if (!isAdmin) {
            setGroupActionNotice('Only admins can add members.');
            return;
          }
          setAddFriendError('');
          setShowAddFriendModal(true);
        }}
        onSearchInChat={() => {
          setShowHeaderSearch(true);
          setShowGroupDetailsScreen(false);
        }}
        onSaveDescription={handleSaveGroupDescription}
        mediaItems={groupMediaItems}
        linkItems={groupLinkItems}
        documentItems={groupDocumentItems}
        onManageStorage={handleManageStorage}
        isMuted={isMuted}
        onToggleMute={handleToggleMuteMessages}
        mediaVisibility={isMediaVisible}
        onToggleMediaVisibility={handleToggleMediaVisibility}
        chatLockEnabled={isChatLocked}
        onToggleChatLock={handleToggleChatLock}
        isFavorited={isFavorited}
        onToggleFavorite={handleToggleFavorite}
        isAddedToList={isAddedToList}
        onToggleAddToList={handleToggleList}
        onClearChat={handleClearChat}
        onExitGroup={handleLeaveCurrentGroup}
        onDeleteGroup={handleDeleteCurrentGroup}
        onReportGroup={handleReportGroup}
        onConfigureDisappearingMessages={handleConfigureDisappearingMessages}
        onConfigureTheme={handleChatTheme}
        disappearingMode={formatDisappearingMode(disappearingMode)}
        chatTheme={chatTheme}
        onRemoveMember={handleRemoveMemberFromGroup}
        initialContentTab={detailsInitialTab}
      />

      {showCreateModal && (
        <CreateGroupModal
          form={createForm}
          error={createError}
          onChange={setCreateForm}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateGroup}
        />
      )}

      {showAddFriendModal && (
        <AddFriendModal
          email={addFriendEmail}
          error={addFriendError}
          isSubmitting={isAddingFriend}
          onEmailChange={setAddFriendEmail}
          onClose={() => {
            if (isAddingFriend) {
              return;
            }
            setShowAddFriendModal(false);
            setAddFriendError('');
          }}
          onSubmit={handleAddFriend}
        />
      )}
    </div>
  );
}

function GroupMessagesList({
  messages,
  currentUserId,
  isLoading,
  typingNames,
  isSending,
  canModerate,
  messageMap,
  isSearchMode,
  searchQuery,
  onReplyMessage,
  onEditMessage,
  onDeleteMessage,
  endRef,
}) {
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="animate-spin" size={18} />
          Loading messages...
        </div>
      </div>
    );
  }

  if (messages.length === 0 && !isSending) {
    if (isSearchMode) {
      return (
        <div className="flex h-full flex-col items-center justify-center px-6 text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-muted/80 text-muted-foreground shadow-sm">
            <Search size={28} />
          </div>
          <h2 className="text-2xl font-semibold text-foreground">No matching messages</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            No messages matched &quot;{searchQuery}&quot;. Try a different phrase or clear search.
          </p>
        </div>
      );
    }

    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary shadow-sm">
          <Sparkles size={28} />
        </div>
        <h2 className="text-2xl font-semibold text-foreground">Start the conversation</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          Send the first message, tag the assistant, or let the room fill itself with class discussion.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto scroll-smooth">
      {messages.map((message) => {
        const isCurrentUsersMessage = message.sender?.id === currentUserId;
        const repliedMessage = message.reply_to ? messageMap.get(message.reply_to) : null;

        return (
          <GroupMessageBubble
            key={message.id}
            message={message}
            currentUserId={currentUserId}
            repliedMessage={repliedMessage}
            canEdit={isCurrentUsersMessage || canModerate}
            canDelete={isCurrentUsersMessage || canModerate}
            onReply={onReplyMessage}
            onEdit={onEditMessage}
            onDelete={onDeleteMessage}
          />
        );
      })}

      {typingNames.length > 0 && !isSearchMode && (
        <div className="px-4 py-4">
          <div className="mx-auto max-w-5xl rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            {getTypingLabel(typingNames)}
          </div>
        </div>
      )}

      {isSending && !isSearchMode && (
        <div className="px-4 py-4">
          <div className="mx-auto flex max-w-5xl items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="animate-spin" size={16} />
            Sending message...
          </div>
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}

function EmptyGroupState({ isLoading, onCreateGroup, onGoBack }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary shadow-sm">
        <MessageSquare size={28} />
      </div>
      <h2 className="text-2xl font-semibold text-foreground">
        {isLoading ? 'Preparing your rooms' : 'No room selected'}
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
        {isLoading
          ? 'We are fetching the groups you belong to right now.'
          : 'Pick a room from the sidebar, create a new one, or return to the AI chat.'}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onCreateGroup}
          className="inline-flex items-center rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Create group
        </button>
        <button
          type="button"
          onClick={onGoBack}
          className="inline-flex items-center rounded-full border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          <ArrowLeft size={16} className="mr-2" />
          Back to AI chat
        </button>
      </div>
    </div>
  );
}

function MenuEntryButton({ icon: Icon, label, onClick, destructive = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
        destructive
          ? 'text-red-600 hover:bg-red-500/10 dark:text-red-400'
          : 'text-foreground hover:bg-muted/70'
      }`}
    >
      <Icon size={14} className="shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}

function CreateGroupModal({ form, error, onChange, onClose, onSubmit }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-3xl border border-border bg-background shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              New group
            </p>
            <h3 className="mt-1 text-xl font-semibold text-foreground">Create a collaboration room</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Set up a class room, invite members, and decide whether the AI assistant should join.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
          >
            Close
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-5 px-6 py-6">
          {error && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Group name" required>
              <input
                value={form.name}
                onChange={(event) => onChange({ ...form, name: event.target.value })}
                className="w-full rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                placeholder="CSE Final Year"
              />
            </Field>

            <Field label="Avatar URL">
              <input
                value={form.avatarUrl}
                onChange={(event) => onChange({ ...form, avatarUrl: event.target.value })}
                className="w-full rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                placeholder="https://..."
              />
            </Field>
          </div>

          <Field label="Description">
            <textarea
              value={form.description}
              onChange={(event) => onChange({ ...form, description: event.target.value })}
              className="min-h-28 w-full rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
              placeholder="What is this room for?"
            />
          </Field>

          <Field label="Initial member IDs">
            <textarea
              value={form.memberIds}
              onChange={(event) => onChange({ ...form, memberIds: event.target.value })}
              className="min-h-24 w-full rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
              placeholder="Paste user IDs separated by commas or new lines"
            />
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex items-start gap-3 rounded-2xl border border-border bg-muted/20 px-4 py-4">
              <input
                type="checkbox"
                checked={form.isAiEnabled}
                onChange={(event) => onChange({ ...form, isAiEnabled: event.target.checked })}
                className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <div>
                <span className="block text-sm font-medium text-foreground">Enable AI assistant</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Let Miety AI participate in the room.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-2xl border border-border bg-muted/20 px-4 py-4">
              <input
                type="checkbox"
                checked={form.aiAutoRespond}
                onChange={(event) => onChange({ ...form, aiAutoRespond: event.target.checked })}
                className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <div>
                <span className="block text-sm font-medium text-foreground">Auto respond mode</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  AI answers relevant questions automatically.
                </span>
              </div>
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-5">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center rounded-full border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Create group
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddFriendModal({ email, error, isSubmitting, onEmailChange, onClose, onSubmit }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-background shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Add friend
            </p>
            <h3 className="mt-1 text-xl font-semibold text-foreground">Invite to this group</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter your friend&apos;s account email to add them instantly.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
          >
            Close
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-5 px-6 py-6">
          {error && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <Field label="Friend email" required>
            <input
              type="email"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              className="w-full rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
              placeholder="yourrollno@mietjammu.in or yourname.dept@mietjammu.in"
            />
          </Field>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-5">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center rounded-full border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Adding...' : 'Add friend'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, required = false, children }) {
  return (
    <label className="block space-y-2">
      <span className="block text-sm font-medium text-foreground">
        {label}
        {required ? <span className="ml-1 text-primary">*</span> : null}
      </span>
      {children}
    </label>
  );
}
