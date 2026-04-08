import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import ProtectedRoute from './ProtectedRoute';
import { AuthContext } from '../../context/AuthContext';

function renderWithUser(user, route = '/faculty/dashboard') {
  return render(
    <AuthContext.Provider value={{ user, loading: false }}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route
            path="/faculty/dashboard"
            element={(
              <ProtectedRoute allowedRoles={['faculty', 'admin']}>
                <div>Faculty Page</div>
              </ProtectedRoute>
            )}
          />
          <Route path="/student/dashboard" element={<div>Student Landing</div>} />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('ProtectedRoute role checks', () => {
  it('renders protected content for allowed role', () => {
    renderWithUser({ id: 'u1', role: 'faculty' });
    expect(screen.getByText('Faculty Page')).toBeInTheDocument();
  });

  it('redirects disallowed role to role-specific fallback', () => {
    renderWithUser({ id: 'u2', role: 'student' });
    expect(screen.getByText('Student Landing')).toBeInTheDocument();
  });
});
