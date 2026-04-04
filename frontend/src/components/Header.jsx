import React, { useState, useRef, useEffect, useContext } from 'react';
import { Menu, Sun, Moon, PanelLeft, User, LogOut, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export function Header({ toggleSidebar, isDarkMode, toggleDarkMode }) {
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
    <header className="flex-none h-14 border-b border-border bg-background flex items-center justify-between px-4 z-10">
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="p-2 -ml-2 rounded-md hover:bg-muted text-muted-foreground transition-colors"
          aria-label="Toggle sidebar"
        >
          <PanelLeft size={20} className="hidden md:block" />
          <Menu size={20} className="md:hidden" />
        </button>
        <div className="font-semibold text-lg bg-clip-text text-transparent bg-gradient-to-r from-primary to-ring">
          Miety AI
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-full hover:bg-muted text-muted-foreground transition-colors"
          aria-label="Toggle theme"
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        {/* User Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 rounded-full hover:bg-muted text-muted-foreground transition-colors"
            aria-label="User menu"
          >
            <User size={20} />
          </button>

          {showMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-popover border border-border rounded-lg shadow-lg overflow-hidden z-50">
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
                className="w-full px-4 py-2 text-sm text-foreground hover:bg-muted flex items-center gap-2 transition-colors"
              >
                <Settings size={16} />
                Profile Settings
              </button>
              <button
                onClick={handleLogout}
                className="w-full px-4 py-2 text-sm text-destructive hover:bg-muted flex items-center gap-2 transition-colors"
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
