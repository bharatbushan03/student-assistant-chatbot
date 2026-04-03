import React from 'react';
import { Menu, Sun, Moon, PanelLeft } from 'lucide-react';

export function Header({ toggleSidebar, isDarkMode, toggleDarkMode }) {
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
      
      <div>
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-full hover:bg-muted text-muted-foreground transition-colors"
          aria-label="Toggle theme"
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>
    </header>
  );
}
