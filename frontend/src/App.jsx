import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Login from './components/auth/Login';
import Signup from './components/auth/Signup';
import ProtectedRoute from './components/auth/ProtectedRoute';
import ChatApp from './ChatApp';
import ProjectsApp from './ProjectsApp';
import GroupChatApp from './GroupChatApp';
import Profile from './components/profile/Profile';
import PrivacyPolicy from './components/legal/PrivacyPolicy';
import TermsAndConditions from './components/legal/TermsAndConditions';
import StudentDashboard from './components/dashboard/StudentDashboard';
import FacultyDashboard from './components/dashboard/FacultyDashboard';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <ChatApp />
              </ProtectedRoute>
            }
          />

          <Route
            path="/student/dashboard"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <StudentDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/faculty/dashboard"
            element={
              <ProtectedRoute allowedRoles={['faculty', 'admin']}>
                <FacultyDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/projects"
            element={
              <ProtectedRoute>
                <ProjectsApp />
              </ProtectedRoute>
            }
          />

          <Route
            path="/projects/:projectId"
            element={
              <ProtectedRoute>
                <ProjectsApp />
              </ProtectedRoute>
            }
          />

          <Route
            path="/projects/:projectId/chats/:chatId"
            element={
              <ProtectedRoute>
                <ProjectsApp />
              </ProtectedRoute>
            }
          />

          <Route
            path="/groups"
            element={
              <ProtectedRoute>
                <GroupChatApp />
              </ProtectedRoute>
            }
          />

          <Route
            path="/groups/:groupId"
            element={
              <ProtectedRoute>
                <GroupChatApp />
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />

          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms-and-conditions" element={<TermsAndConditions />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
