import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import api from '../../utils/api';
import { UserPlus, Mail, Lock, Key, CheckCircle } from 'lucide-react';

const Signup = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { loginContext } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setError(null);

    if (!email.endsWith('@mietjammu.in')) {
      return setError('Registration is restricted to @mietjammu.in email addresses only.');
    }
    if (password.length < 8) {
      return setError('Password must be at least 8 characters long.');
    }
    if (password !== confirmPassword) {
      return setError('Passwords do not match.');
    }

    setIsSubmitting(true);
    try {
      const { data } = await api.post('/auth/signup', { email, password });
      if (data.success) {
        loginContext(data.user, data.token);
        navigate('/');
      }
    } catch (err) {
      if (!err.response) {
        setError('Could not connect to the server. Please check your connection.');
      } else {
        // Backend returns {detail: "..."} not {message: "..."}
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
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md relative">
        {/* Card */}
        <div className="rounded-2xl border border-border bg-card/95 p-8 shadow-[0_18px_50px_-24px_hsl(var(--foreground)/0.3)] backdrop-blur">
          {/* Logo and Title */}
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/12">
              <UserPlus size={26} className="text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-1">
              Create Account
            </h2>
            <p className="text-muted-foreground text-sm">
              Join Miety AI with your MIET email
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-sm text-center">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSignup} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Mail size={14} className="text-muted-foreground" />
                MIET Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="yourname@mietjammu.in"
                className="w-full px-4 py-3 bg-background border border-border rounded-xl
                  text-foreground placeholder:text-muted-foreground
                  focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
                  transition-all duration-200"
              />
              <p className="text-xs text-muted-foreground">
                Only @mietjammu.in email addresses are accepted
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Lock size={14} className="text-muted-foreground" />
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a strong password"
                className="w-full px-4 py-3 bg-background border border-border rounded-xl
                  text-foreground placeholder:text-muted-foreground
                  focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
                  transition-all duration-200"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Key size={14} className="text-muted-foreground" />
                Confirm Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                className="w-full px-4 py-3 bg-background border border-border rounded-xl
                  text-foreground placeholder:text-muted-foreground
                  focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
                  transition-all duration-200"
              />
            </div>

            {/* Password requirements */}
            <div className="pt-2">
              <p className="text-xs font-medium text-muted-foreground mb-2">Password requirements:</p>
              <div className="space-y-1">
                {passwordRequirements.map((req, index) => (
                  <div key={index} className="flex items-center gap-2 text-xs">
                    <CheckCircle
                      size={14}
                      className={req.met ? 'text-green-500' : 'text-muted-foreground'}
                    />
                    <span className={req.met ? 'text-green-500' : 'text-muted-foreground'}>
                      {req.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 bg-primary
                text-primary-foreground font-semibold rounded-xl
                hover:bg-primary/90
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors duration-200 shadow-sm"
            >
              {isSubmitting ? 'Creating Account...' : 'Sign Up'}
            </button>
          </form>

          {/* Footer */}
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link
              to="/login"
              className="text-primary font-medium hover:underline transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>

        {/* Legal links */}
        <div className="mt-6 flex justify-center gap-4 text-xs text-muted-foreground">
          <Link to="/privacy-policy" className="hover:text-foreground transition-colors">
            Privacy Policy
          </Link>
          <span>•</span>
          <Link to="/terms-and-conditions" className="hover:text-foreground transition-colors">
            Terms & Conditions
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Signup;
