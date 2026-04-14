import React, { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, UserPlus } from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import api from '../../utils/api';

const STUDENT_EMAIL_REGEX = /^[a-z0-9]+@mietjammu\.in$/;

const Signup = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mode, setMode] = useState('student');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { loginContext } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSignup = async (event) => {
    event.preventDefault();
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();

    if (mode !== 'student') {
      setError('Faculty/Admin accounts are provisioned by system administrators only.');
      return;
    }

    if (!STUDENT_EMAIL_REGEX.test(normalizedEmail)) {
      setError('Student email must follow format yourrollno@mietjammu.in.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data } = await api.post('/auth/signup', { email: normalizedEmail, password, mode });
      if (data.success) {
        loginContext(data.user, data.token);
        const role = (data.user?.role || 'student').toLowerCase();
        navigate(role === 'student' ? '/student/dashboard' : '/faculty/dashboard');
      }
    } catch (err) {
      if (!err.response) {
        setError('Could not connect to the server. Please check your connection.');
      } else {
        setError(err.response.data?.detail || err.response.data?.message || 'An error occurred during registration.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const passwordRequirements = [
    { label: 'At least 8 characters', met: password.length >= 8 },
  ];

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 to-slate-100 dark:from-background dark:to-background px-4 py-8">
      <div className="w-full max-w-md">
        <div className="panel-card p-8 shadow-md rounded-[12px]">
          <div className="text-center mb-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-primary/10 text-primary mb-4">
              <UserPlus size={24} />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Create Account</h1>
            <p className="mt-1 text-sm text-muted-foreground">Use your MIET email to open a student account.</p>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Signup Mode</label>
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
              {mode === 'faculty_admin' ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Faculty/Admin signup is not available from this screen.
                </p>
              ) : null}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">MIET Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="yourrollno@mietjammu.in"
                className="soft-input"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Create a password"
                className="soft-input"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Confirm Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Re-enter your password"
                className="soft-input"
              />
            </div>

            <div className="rounded-2xl bg-muted/55 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Password rule
              </p>
              <div className="mt-2 space-y-2">
                {passwordRequirements.map((requirement) => (
                  <div key={requirement.label} className="flex items-center gap-2 text-sm">
                    <CheckCircle2
                      size={16}
                      className={requirement.met ? 'text-primary' : 'text-muted-foreground'}
                    />
                    <span className={requirement.met ? 'text-foreground' : 'text-muted-foreground'}>
                      {requirement.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {error ? (
              <div className="rounded-2xl border border-destructive/15 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <button type="submit" disabled={isSubmitting} className="primary-button w-full mt-2">
              {isSubmitting ? 'Creating account...' : 'Sign Up'}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-primary hover:underline">
              Sign In
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

export default Signup;
