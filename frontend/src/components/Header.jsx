import React, { useState, useRef, useEffect, useContext } from 'react';
import { Menu, Sun, Moon, PanelLeft, User, LogOut, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export function Header({ toggleSidebar, isDarkMode, toggleDarkMode, title = 'Miety AI' }) {
  const { user, logoutContext } = useContext(AuthContext);
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

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
    <header className="z-20 flex h-14 flex-none items-center justify-between border-b border-border/70 bg-background/92 px-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="-ml-2 rounded-lg p-2 text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          aria-label="Toggle sidebar"
        >
          <PanelLeft size={20} className="hidden md:block" />
          <Menu size={20} className="md:hidden" />
        </button>
        <div className="text-[15px] font-semibold tracking-tight text-foreground">
          {title}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleDarkMode}
          className="rounded-lg p-2 text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          aria-label="Toggle theme"
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        {/* User Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            aria-label="User menu"
          >
            <User size={20} />
          </button>

          {showMenu && (
            <div className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-xl border border-border bg-popover/95 shadow-xl backdrop-blur">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-sm font-medium text-foreground truncate">
                  {user?.name || 'User'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user?.email || ''}
                </p>
              </div>
              <button
                onClick={() => {
                  navigate('/profile');
                  setShowMenu(false);
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted/70"
              >
                <Settings size={16} />
                Profile Settings
              </button>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-destructive transition-colors hover:bg-muted/70"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
