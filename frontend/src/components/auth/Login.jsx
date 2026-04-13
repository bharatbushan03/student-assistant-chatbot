import React, { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import api from '../../utils/api';

const STUDENT_EMAIL_REGEX = /^[a-z0-9]+@mietjammu\.in$/;
const FACULTY_ADMIN_EMAIL_REGEX = /^[a-z]+(?:\.[a-z]+)+@mietjammu\.in$/;

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('student');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { loginContext } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogin = async (event) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const normalizedEmail = email.trim().toLowerCase();
    if (mode === 'student' && !STUDENT_EMAIL_REGEX.test(normalizedEmail)) {
      setError('Student email must follow format yourrollno@mietjammu.in.');
      setIsSubmitting(false);
      return;
    }

    if (mode === 'faculty_admin' && !FACULTY_ADMIN_EMAIL_REGEX.test(normalizedEmail)) {
      setError('Faculty/Admin email must follow format yourname.dept@mietjammu.in.');
      setIsSubmitting(false);
      return;
    }

    try {
      const { data } = await api.post('/auth/login', { email: normalizedEmail, password, mode });
      if (data.success) {
        loginContext(data.user, data.token);
        const role = (data.user?.role || 'student').toLowerCase();
        navigate(role === 'student' ? '/student/dashboard' : '/faculty/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.message || 'Invalid credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const emailPlaceholder =
    mode === 'faculty_admin' ? 'yourname.dept@mietjammu.in' : 'yourrollno@mietjammu.in';
  const emailHint =
    mode === 'faculty_admin'
      ? 'Faculty/Admin format: yourname.dept@mietjammu.in'
      : 'Student format: yourrollno@mietjammu.in';

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 to-slate-100 dark:from-background dark:to-background px-4 py-8">
      <div className="w-full max-w-md">
        <div className="panel-card p-8 shadow-md rounded-[12px]">
          <div className="text-center mb-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-primary/10 text-primary mb-4">
              <LogIn size={24} />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Welcome Back</h1>
            <p className="mt-1 text-sm text-muted-foreground">Sign in to continue to your assistant.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Login Mode</label>
              <div className="grid grid-cols-2 gap-2 rounded-3xl bg-muted p-1">
                <button
                  type="button"
                  onClick={() => setMode('student')}
                  className={`rounded-[1.1rem] px-4 py-3 text-sm font-semibold ${
                    mode === 'student'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-card hover:text-foreground'
                  }`}
                >
                  Student
                </button>
                <button
                  type="button"
                  onClick={() => setMode('faculty_admin')}
                  className={`rounded-[1.1rem] px-4 py-3 text-sm font-semibold ${
                    mode === 'faculty_admin'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-card hover:text-foreground'
                  }`}
                >
                  Faculty/Admin
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">MIET Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={emailPlaceholder}
                className="soft-input"
              />
              <p className="mt-2 text-xs text-muted-foreground">{emailHint}</p>
            </div>

            <div>
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
              <div className="rounded-2xl border border-destructive/15 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <button type="submit" disabled={isSubmitting} className="primary-button w-full mt-2">
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link to="/signup" className="font-semibold text-primary hover:underline">
              Sign Up
            </Link>
          </p>
        </div>

        <div className="mt-5 text-center text-sm text-muted-foreground">
          <Link to="/privacy-policy" className="hover:text-foreground">
            Privacy Policy
          </Link>
          <span className="px-2">|</span>
          <Link to="/terms-and-conditions" className="hover:text-foreground">
            Terms & Conditions
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
