import React, { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import api from '../../utils/api';
import { AuthFrame } from './AuthFrame';

const CAMPUS_EMAIL_REGEX = /^[a-z0-9]+(?:[._-][a-z0-9]+)*@mietjammu\.in$/;

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { loginContext } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogin = async (event) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const normalizedEmail = email.trim().toLowerCase();
    if (!CAMPUS_EMAIL_REGEX.test(normalizedEmail)) {
      setError('Use a MIET email such as name@mietjammu.in.');
      setIsSubmitting(false);
      return;
    }

    try {
      const { data } = await api.post('/auth/login', { email: normalizedEmail, password });
      if (data.success) {
        loginContext(data.user, data.token);
        const role = (data.user?.role || 'student').toLowerCase();
        if (role === 'admin') {
          navigate('/admin/dashboard');
        } else if (role === 'faculty') {
          navigate('/faculty/dashboard');
        } else {
          navigate('/student/dashboard');
        }
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.message || 'Invalid credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthFrame>
      <div className="panel-card p-6 sm:p-8">
        <div className="mb-4 p-3">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-950 bg-primary text-primary-foreground lg:hidden">
            <LogIn size={20} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">MIETY AI</p>
          <h1 className="mt-2 text-2xl font-bold text-foreground">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in with your MIET email. The app opens the workspace that matches your account.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="p-3">
            <label className="mb-1.5 block text-sm font-medium text-foreground">MIET Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@mietjammu.in"
              className="soft-input"
            />
          </div>

          <div className="p-3">
            <label className="mb-1.5 block text-sm font-medium text-foreground">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              className="soft-input"
            />
          </div>

          {error ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className="p-3">
          <button type="submit" disabled={isSubmitting} className="primary-button w-full">
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </button>
          </div>
        </form>

        <div className="p-3">
          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link to="/signup" className="font-semibold text-primary hover:underline">
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </AuthFrame>
  );
};

export default Login;
