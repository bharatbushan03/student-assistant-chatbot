export const LEGACY_WORKSPACE_CHAT_STORAGE_KEY = 'miety-chats';

function getUserIdentifier(user) {
  return user?.id || user?._id || user?.email || null;
}

export function getWorkspaceChatStorageKey(user) {
  const identifier = getUserIdentifier(user);
  if (!identifier) {
    return null;
  }

  return `${LEGACY_WORKSPACE_CHAT_STORAGE_KEY}:${identifier}`;
}

export function readWorkspaceChatsForUser(user) {
  const key = getWorkspaceChatStorageKey(user);
  return readWorkspaceChatsByKey(key);
}

export function writeWorkspaceChatsForUser(user, chats) {
  const key = getWorkspaceChatStorageKey(user);
  writeWorkspaceChatsByKey(key, chats);
}

export function readWorkspaceChatsByKey(storageKey) {
  if (typeof window === 'undefined' || !storageKey) {
    return [];
  }

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeWorkspaceChatsByKey(storageKey, chats) {
  if (typeof window === 'undefined' || !storageKey) {
    return;
  }

  localStorage.setItem(storageKey, JSON.stringify(Array.isArray(chats) ? chats : []));
}