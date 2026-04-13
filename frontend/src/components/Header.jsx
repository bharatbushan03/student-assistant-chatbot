import React, { useContext, useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut, Menu, PanelLeft, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

function getInitials(value) {
  if (!value) {
    return 'U';
  }

  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export function Header({ toggleSidebar, title = 'Miety AI', subtitle = '' }) {
  const { user, logoutContext } = useContext(AuthContext);
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);
  const userLabel = user?.name || user?.email || 'User';

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logoutContext();
    navigate('/login');
  };

  return (
    <header className="border-b border-border bg-background px-4 py-3 md:px-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={toggleSidebar}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Toggle sidebar"
          >
            <PanelLeft size={18} className="hidden md:block" />
            <Menu size={18} className="md:hidden" />
          </button>

          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-accent text-sm font-bold text-accent-foreground">
              M
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-foreground">{title}</p>
              {subtitle ? <p className="truncate text-sm text-muted-foreground">{subtitle}</p> : null}
            </div>
          </div>
        </div>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setShowMenu((current) => !current)}
            className="inline-flex items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2 hover:bg-muted"
            aria-label="Open user menu"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
              {getInitials(user?.name || user?.email)}
            </span>
            <div className="hidden text-left md:block">
              <p className="max-w-[180px] truncate text-sm font-medium text-foreground">{userLabel}</p>
              <p className="max-w-[180px] truncate text-xs text-muted-foreground">{user?.email || ''}</p>
            </div>
            <ChevronDown size={16} className="text-muted-foreground" />
          </button>

          {showMenu ? (
            <div className="absolute right-0 z-50 mt-2 w-56 rounded-3xl border border-border bg-popover p-2 shadow-lg">
              <div className="rounded-2xl bg-muted/55 px-3 py-3">
                <p className="truncate text-sm font-medium text-foreground">{userLabel}</p>
                <p className="truncate text-xs text-muted-foreground">{user?.email || ''}</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  navigate('/profile');
                  setShowMenu(false);
                }}
                className="mt-2 flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-sm text-foreground hover:bg-muted"
              >
                <Settings size={16} />
                Profile
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
