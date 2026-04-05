import api from './api';

export async function listGroups() {
  const response = await api.get('/api/groups');
  return response.data;
}

export async function getGroup(groupId) {
  const response = await api.get(`/api/groups/${groupId}`);
  return response.data;
}

export async function getGroupMessages(groupId, params = {}) {
  const query = new URLSearchParams();

  if (params.limit) {
    query.set('limit', String(params.limit));
  }

  if (params.before) {
    query.set('before', params.before);
  }

  const suffix = query.toString() ? `?${query.toString()}` : '';
  const response = await api.get(`/api/groups/${groupId}/messages${suffix}`);
  return response.data;
}

export async function createGroup(groupPayload) {
  const response = await api.post('/api/groups', groupPayload);
  return response.data;
}

export async function addGroupMemberByEmail(groupId, email) {
  const response = await api.post(`/api/groups/${groupId}/members/by-email`, {
    email,
  });
  return response.data;
}

export async function searchGroupMessages(groupId, query, limit = 20) {
  const response = await api.get(`/api/groups/${groupId}/search`, {
    params: { q: query, limit },
  });
  return response.data;
}

export async function updateGroupMessage(groupId, messageId, content) {
  const response = await api.put(`/api/groups/${groupId}/messages/${messageId}`, {
    content,
  });
  return response.data;
}

export async function deleteGroupMessage(groupId, messageId) {
  await api.delete(`/api/groups/${groupId}/messages/${messageId}`);
}

export async function leaveGroup(groupId) {
  await api.post(`/api/groups/${groupId}/leave`);
}
