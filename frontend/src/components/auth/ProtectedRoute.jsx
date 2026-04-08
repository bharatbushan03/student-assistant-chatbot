import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';

const ProtectedRoute = ({ children, allowedRoles = null }) => {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const normalizedRole = user?.role === 'faculty' || user?.role === 'admin'
    ? user.role
    : 'student';

  if (Array.isArray(allowedRoles) && allowedRoles.length > 0 && !allowedRoles.includes(normalizedRole)) {
    const fallbackPath = normalizedRole === 'student' ? '/student/dashboard' : '/faculty/dashboard';
    return <Navigate to={fallbackPath} replace />;
  }

  return children;
};

export default ProtectedRoute;
