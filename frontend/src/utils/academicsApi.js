import api from './api';

export async function fetchStudentDashboard() {
  const { data } = await api.get('/api/academics/student/dashboard');
  return data;
}

export async function fetchStudentRecords(filters = {}) {
  const { data } = await api.get('/api/academics/students', {
    params: filters,
  });
  return data;
}

export async function fetchStudentRecord(studentId) {
  const { data } = await api.get(`/api/academics/students/${encodeURIComponent(studentId)}`);
  return data;
}

export async function upsertStudentRecord(studentId, payload) {
  const { data } = await api.put(`/api/academics/students/${encodeURIComponent(studentId)}`, payload);
  return data;
}

export async function fetchAdminOverview() {
  const { data } = await api.get('/api/admin/overview');
  return data;
}

export async function fetchAdminStudents(filters = {}) {
  const { data } = await api.get('/api/admin/students', { params: filters });
  return data;
}

export async function fetchAdminStudentDashboard(studentId) {
  const { data } = await api.get(`/api/admin/students/${encodeURIComponent(studentId)}/dashboard`);
  return data;
}

export async function fetchNotices() {
  const { data } = await api.get('/api/admin/notices');
  return data;
}

export async function createNotice(payload) {
  const { data } = await api.post('/api/admin/notices', payload);
  return data;
}

export async function deleteNotice(noticeId) {
  const { data } = await api.delete(`/api/admin/notices/${encodeURIComponent(noticeId)}`);
  return data;
}

export async function provisionStaffAccount(payload) {
  const { data } = await api.post('/api/admin/accounts', payload);
  return data;
}

export async function bulkUploadStudentRecords(file) {
  const formData = new FormData();
  formData.append('file', file);

  const { data } = await api.post('/api/academics/students/bulk-upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return data;
}
