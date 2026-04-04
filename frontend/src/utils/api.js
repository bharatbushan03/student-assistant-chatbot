import axios from 'axios';

// Use relative paths so Vite proxy handles API requests in development
const api = axios.create({
  baseURL: '/',
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
