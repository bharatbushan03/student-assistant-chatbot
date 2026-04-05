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
  CircleAlert,
  Loader2,
  LogOut,
  MessageSquare,
  RefreshCw,
  Search,
  Sparkles,
  UserPlus,
  Users,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';

import { AuthContext } from './context/auth-context';
import { Header } from './components/Header';
import { InputBar } from './components/InputBar';
import { GroupSidebar } from './components/groups/GroupSidebar';
import { GroupMessageBubble } from './components/groups/GroupMessageBubble';
import {
  addGroupMemberByEmail,
  createGroup,
  deleteGroupMessage,
  getGroup,
  getGroupMessages,
  leaveGroup,
  listGroups,
  searchGroupMessages,
  updateGroupMessage,
} from './utils/groupsApi';

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

function getStatusTone(status) {
  switch (status) {
    case 'connected':
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
    case 'connecting':
    case 'reconnecting':
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
    case 'error':
      return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
    default:
      return 'bg-muted/80 text-muted-foreground border-border';
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
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
  const [groupActionError, setGroupActionError] = useState('');
  const [isLeavingGroup, setIsLeavingGroup] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
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

  const socketRef = useRef(null);
  const activeGroupIdRef = useRef(groupId || null);
  const typingTimerRef = useRef(null);
  const messagesEndRef = useRef(null);

  const currentUserId = user?.id || user?._id || null;
  const memberList = useMemo(() => activeGroup?.members || [], [activeGroup?.members]);
  const currentUserRole = useMemo(() => {
    return memberList.find((member) => member.user_id === currentUserId)?.role || null;
  }, [memberList, currentUserId]);
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
    activeGroupIdRef.current = groupId || null;
  }, [groupId]);

  useEffect(() => {
    setComposerText('');
    setReplyToMessage(null);
    setEditingMessage(null);
    setSearchQuery('');
    setSearchResults([]);
    setIsSearchMode(false);
    setGroupActionError('');
  }, [groupId]);

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
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
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

  const handleSendMessage = useCallback(async (content) => {
    if (!groupId) {
      setGroupActionError('Select a group first.');
      return false;
    }

    setGroupActionError('');

    if (editingMessage) {
      setIsSending(true);

      try {
        const updatedMessage = await updateGroupMessage(groupId, editingMessage.id, content);

        setMessages((currentMessages) => upsertMessage(currentMessages, updatedMessage));
        setSearchResults((currentResults) => currentResults.map((currentMessage) => {
          if (currentMessage.id !== updatedMessage.id) {
            return currentMessage;
          }
          return updatedMessage;
        }));

        setEditingMessage(null);
        setComposerText('');
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
    socket.emit('send_message', {
      group_id: groupId,
      content,
      message_type: 'text',
      reply_to_id: replyToMessage?.id,
      metadata: {},
    });
    setReplyToMessage(null);
    return true;
  }, [editingMessage, groupId, replyToMessage, socketStatus]);

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

  const normalizedSearchQuery = searchQuery.trim();
  const displayedMessages = isSearchMode ? searchResults : messages;

  const connectionLabel = formatConnectionStatus(socketStatus);

  const activeGroupSummary = activeGroup ? (
    <div className="rounded-3xl border border-border bg-card/80 px-5 py-4 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="truncate text-2xl font-semibold text-foreground">{activeGroup.name}</h1>
            {activeGroup.is_ai_enabled && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <Sparkles size={12} />
                AI enabled
              </span>
            )}
            {activeGroup.ai_auto_respond && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                Auto respond
              </span>
            )}
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            {activeGroup.description || 'A focused room for classmates, project teammates, and study groups.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${getStatusTone(socketStatus)}`}>
            {socketStatus === 'connected' ? <Wifi size={14} /> : <WifiOff size={14} />}
            {connectionLabel}
          </div>

          {canModerate && (
            <button
              type="button"
              onClick={() => {
                setAddFriendError('');
                setShowAddFriendModal(true);
              }}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              <UserPlus size={14} />
              Add friend
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              refreshActiveGroup();
              refreshMessages();
            }}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <RefreshCw size={14} className={isSearching ? 'animate-spin' : ''} />
            Refresh
          </button>

          <button
            type="button"
            onClick={handleLeaveCurrentGroup}
            disabled={isLeavingGroup}
            className="inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-500/15 disabled:opacity-60 dark:text-red-400"
          >
            {isLeavingGroup ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
            {isLeavingGroup ? 'Leaving...' : 'Leave group'}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-muted/60 px-3 py-1.5 text-xs text-muted-foreground">
          <Users size={14} />
          {memberList.length} members
        </div>
        {memberList.slice(0, 5).map((member) => (
          <span
            key={member.user_id}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
              {(member.name || 'U').slice(0, 1).toUpperCase()}
            </span>
            {member.name}
          </span>
        ))}
      </div>

      <form onSubmit={handleSearchMessages} className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full rounded-full border border-border bg-muted/30 py-2 pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
            placeholder="Search messages in this group"
          />
        </div>

        <button
          type="submit"
          disabled={!normalizedSearchQuery || isSearching}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          {isSearching ? 'Searching...' : 'Search'}
        </button>

        {isSearchMode && (
          <button
            type="button"
            onClick={clearSearchResults}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X size={14} />
            Clear
          </button>
        )}
      </form>

      {isSearchMode && (
        <p className="mt-2 text-xs text-muted-foreground">
          Showing {searchResults.length} result{searchResults.length === 1 ? '' : 's'} for &quot;{normalizedSearchQuery}&quot;.
        </p>
      )}
    </div>
  ) : (
    <div className="rounded-3xl border border-dashed border-border bg-card/60 px-5 py-6">
      <div className="flex items-start gap-4">
        <div className="rounded-2xl bg-primary/10 p-3 text-primary">
          <MessageSquare size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Your group rooms</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Pick a room from the sidebar or create a new one for your class project, discussion circle, or study plan.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background font-sans text-foreground">
      <GroupSidebar
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        groups={groups}
        activeGroupId={groupId || undefined}
        onSelectGroup={handleSelectGroup}
        onNewGroup={() => setShowCreateModal(true)}
        isLoading={groupsLoading}
      />

      <main className="relative flex min-w-0 flex-1 flex-col">
        <Header
          toggleSidebar={() => setIsSidebarOpen((current) => !current)}
          isDarkMode={isDarkMode}
          toggleDarkMode={() => setIsDarkMode((current) => !current)}
          title="Group Rooms"
        />

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 md:p-5">
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

          <div className="min-h-0 flex-1 overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
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

                <div className="border-t border-border bg-gradient-to-t from-card to-transparent p-4">
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
                    isProcessing={isSending || socketStatus !== 'connected'}
                    placeholder={activeGroup ? `Message ${activeGroup.name}` : 'Type a message'}
                    helperText={
                      editingMessage
                        ? 'Editing mode: send to save changes.'
                        : socketStatus === 'connected'
                        ? 'Press Enter to send. Shift+Enter adds a new line.'
                        : 'Waiting for a real-time connection.'
                    }
                    value={composerText}
                    onValueChange={setComposerText}
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
              placeholder="friend@mietjammu.in"
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
