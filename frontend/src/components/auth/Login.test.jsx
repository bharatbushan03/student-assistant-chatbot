import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, beforeEach, describe, expect, it } from 'vitest';

import Login from './Login';
import { AuthContext } from '../../context/AuthContext';
import api from '../../utils/api';

vi.mock('../../utils/api', () => ({
  default: {
    post: vi.fn(),
  },
}));

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderLogin(loginContext = vi.fn()) {
  return render(
    <AuthContext.Provider value={{ loginContext }}>
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('Login mode handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits in student mode by default and redirects to student dashboard', async () => {
    const loginContext = vi.fn();
    api.post.mockResolvedValueOnce({
      data: {
        success: true,
        user: { id: 'u1', role: 'student' },
        token: 'token-123',
      },
    });

    renderLogin(loginContext);

    await userEvent.type(screen.getByPlaceholderText('yourrollno@mietjammu.in'), '2024a6r009@mietjammu.in');
    await userEvent.type(screen.getByPlaceholderText('Enter your password'), 'StrongPass123');
    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/login', {
        email: '2024a6r009@mietjammu.in',
        password: 'StrongPass123',
        mode: 'student',
      });
    });

    expect(loginContext).toHaveBeenCalledWith({ id: 'u1', role: 'student' }, 'token-123');
    expect(mockNavigate).toHaveBeenCalledWith('/student/dashboard');
  });

  it('submits in faculty/admin mode and redirects to faculty dashboard', async () => {
    api.post.mockResolvedValueOnce({
      data: {
        success: true,
        user: { id: 'u2', role: 'faculty' },
        token: 'token-456',
      },
    });

    renderLogin();

    await userEvent.click(screen.getByRole('button', { name: 'Faculty/Admin' }));
    await userEvent.type(screen.getByPlaceholderText('yourname.dept@mietjammu.in'), 'john.cse@mietjammu.in');
    await userEvent.type(screen.getByPlaceholderText('Enter your password'), 'StrongPass123');
    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/login', {
        email: 'john.cse@mietjammu.in',
        password: 'StrongPass123',
        mode: 'faculty_admin',
      });
    });

    expect(mockNavigate).toHaveBeenCalledWith('/faculty/dashboard');
  });
});
