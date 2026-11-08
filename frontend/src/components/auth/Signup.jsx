import React, { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, UserPlus } from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import api from '../../utils/api';
import { AuthFrame } from './AuthFrame';

const CAMPUS_EMAIL_REGEX = /^[a-z0-9]+(?:[._-][a-z0-9]+)*@mietjammu\.in$/;

const Signup = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { loginContext } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSignup = async (event) => {
    event.preventDefault();
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();

    if (!CAMPUS_EMAIL_REGEX.test(normalizedEmail)) {
      setError('Use a MIET email such as name@mietjammu.in.');
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
      const { data } = await api.post('/auth/signup', { email: normalizedEmail, password });
      if (data.success) {
        loginContext(data.user, data.token);
        navigate('/student/dashboard');
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
    <AuthFrame>
      <div className="panel-card p-7 sm:p-8">
        <div className="mb-6">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-950 bg-primary text-primary-foreground lg:hidden">
            <UserPlus size={20} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Create account</p>
          <h1 className="mt-2 text-2xl font-bold text-foreground">Join as a student</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every new registration is a student account, including name@mietjammu.in. An admin can appoint faculty or admin later.
          </p>
        </div>

        <form onSubmit={handleSignup} className="space-y-5">
          <div>
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

          <div className="rounded-xl border border-border bg-muted/55 px-4 py-3">
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
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
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
    </AuthFrame>
  );
};

export default Signup;
