import React, { createContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import api from '../utils/api';

export const AuthContext = createContext(null);

function normalizeUser(rawUser) {
  if (!rawUser || typeof rawUser !== 'object') {
    return null;
  }

  const normalizedId = rawUser.id || rawUser._id || null;
  const normalizedAvatar = rawUser.avatar_url || rawUser.profile_picture || null;

  return {
    ...rawUser,
    id: normalizedId,
    _id: rawUser._id || normalizedId,
    avatar_url: normalizedAvatar,
    profile_picture: rawUser.profile_picture || normalizedAvatar,
  };
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkLoggedUser = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const res = await api.get('/auth/profile');
          setUser(normalizeUser(res.data.user));
        } catch (error) {
          const statusCode = error?.response?.status;
          const isAuthFailure = statusCode === 401 || statusCode === 403;

          if (isAuthFailure) {
            localStorage.removeItem('token');
            setUser(null);
          } else {
            // Keep user session on transient profile endpoint failures.
            try {
              const decoded = jwtDecode(token);
              setUser(normalizeUser({
                id: decoded?.id || decoded?._id,
                _id: decoded?._id || decoded?.id,
                email: decoded?.email,
                name: decoded?.name,
                avatar_url: decoded?.avatar_url || decoded?.profile_picture,
                profile_picture: decoded?.profile_picture || decoded?.avatar_url,
              }));
            } catch {
              setUser(null);
            }
          }
        }
      }
      setLoading(false);
    };
    checkLoggedUser();
  }, []);

  const loginContext = (userData, token) => {
    localStorage.setItem('token', token);
    setUser(normalizeUser(userData));
  };

  const logoutContext = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginContext, logoutContext }}>
      {children}
    </AuthContext.Provider>
  );
};
