import api from './api';

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function listProjects() {
  const response = await api.get('/api/projects');
  return response.data;
}

export async function createProject(payload) {
  const response = await api.post('/api/projects', payload);
  return response.data;
}

export async function updateProject(projectId, payload) {
  const response = await api.patch(`/api/projects/${projectId}`, payload);
  return response.data;
}

export async function deleteProject(projectId) {
  await api.delete(`/api/projects/${projectId}`);
}

export async function shareProject(projectId, userEmail) {
  const response = await api.post(`/api/projects/${projectId}/share`, {
    user_email: userEmail,
  });
  return response.data;
}

export async function listProjectChats(projectId) {
  const response = await api.get(`/api/projects/${projectId}/chats`);
  return response.data;
}

export async function createProjectChat(projectId, title = 'New Chat') {
  const response = await api.post(`/api/projects/${projectId}/chats`, { title });
  return response.data;
}

export async function updateProjectChat(projectId, chatId, payload) {
  const response = await api.patch(`/api/projects/${projectId}/chats/${chatId}`, payload);
  return response.data;
}

export async function deleteProjectChat(projectId, chatId) {
  await api.delete(`/api/projects/${projectId}/chats/${chatId}`);
}

export async function listProjectMessages(projectId, chatId, params = {}) {
  const response = await api.get(`/api/projects/${projectId}/chats/${chatId}/messages`, {
    params,
  });
  return response.data;
}

export async function searchProjectMessages(projectId, query, limit = 20) {
  const response = await api.get(`/api/projects/${projectId}/search`, {
    params: { q: query, limit },
  });
  return response.data;
}

export async function listProjectFiles(projectId) {
  const response = await api.get(`/api/projects/${projectId}/files`);
  return response.data;
}

export async function uploadProjectFiles(projectId, files) {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));

  const response = await api.post(`/api/projects/${projectId}/files`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}

export async function deleteProjectFile(projectId, fileId) {
  await api.delete(`/api/projects/${projectId}/files/${fileId}`);
}

export async function downloadProjectFile(projectId, fileId) {
  const response = await api.get(`/api/projects/${projectId}/files/${fileId}/preview`, {
    responseType: 'blob',
  });
  return {
    blob: response.data,
    contentType: response.headers['content-type'] || 'application/octet-stream',
    contentDisposition: response.headers['content-disposition'] || '',
  };
}

export async function exportProjectChat(projectId, chatId, format = 'markdown') {
  const response = await api.get(`/api/projects/${projectId}/chats/${chatId}/export`, {
    params: { format },
    responseType: 'blob',
  });

  return {
    blob: response.data,
    contentType: response.headers['content-type'] || 'application/octet-stream',
    contentDisposition: response.headers['content-disposition'] || '',
  };
}

export async function streamProjectResponse({
  projectId,
  chatId,
  payload,
  onStart,
  onToken,
  onDone,
}) {
  const response = await fetch(`/api/projects/${projectId}/chats/${chatId}/messages/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let detail = 'Failed to stream response.';
    try {
      const errorBody = await response.json();
      detail = errorBody?.detail || detail;
    } catch {
      // Keep default detail.
    }
    throw new Error(detail);
  }

  if (!response.body) {
    throw new Error('Streaming is not supported by this browser response.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const segments = buffer.split('\n\n');
    buffer = segments.pop() || '';

    for (const segment of segments) {
      const dataLine = segment
        .split('\n')
        .find((line) => line.startsWith('data: '));

      if (!dataLine) {
        continue;
      }

      let parsed;
      try {
        parsed = JSON.parse(dataLine.slice(6));
      } catch {
        continue;
      }

      if (parsed.type === 'start' && onStart) {
        onStart(parsed.user_message);
      }
      if (parsed.type === 'token' && onToken) {
        onToken(parsed.delta || '');
      }
      if (parsed.type === 'done' && onDone) {
        onDone(parsed.assistant_message);
      }
    }
  }
}