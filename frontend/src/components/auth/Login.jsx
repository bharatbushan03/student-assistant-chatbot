import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import api from '../../utils/api';
import { LogIn, Mail, Lock } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { loginContext } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const { data } = await api.post('/auth/login', { email, password });
      if (data.success) {
        loginContext(data.user, data.token);
        navigate('/');
      }
    } catch (err) {
      // Backend returns {detail: "..."} not {message: "..."}
      setError(err.response?.data?.detail || err.response?.data?.message || 'Invalid credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md relative">
        {/* Card */}
        <div className="rounded-2xl border border-border bg-card/95 p-8 shadow-[0_18px_50px_-24px_hsl(var(--foreground)/0.3)] backdrop-blur">
          {/* Logo and Title */}
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/12">
              <LogIn size={26} className="text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-1">
              Welcome Back
            </h2>
            <p className="text-muted-foreground text-sm">
              Sign in to continue to Miety AI
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-sm text-center">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Mail size={14} className="text-muted-foreground" />
                Email Address
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
                placeholder="Enter your password"
                className="w-full px-4 py-3 bg-background border border-border rounded-xl
                  text-foreground placeholder:text-muted-foreground
                  focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
                  transition-all duration-200"
              />
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
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Footer */}
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Link
              to="/signup"
              className="text-primary font-medium hover:underline transition-colors"
            >
              Create one
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

export default Login;
