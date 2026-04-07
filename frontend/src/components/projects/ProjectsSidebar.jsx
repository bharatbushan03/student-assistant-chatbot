import React, { useContext, useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  FolderKanban,
  MessageSquare,
  Plus,
  Users,
  X,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { readWorkspaceChatsForUser } from '../../utils/chatStorage';
import { listGroups } from '../../utils/groupsApi';

export function ProjectsSidebar({
  isOpen,
  setIsOpen,
  projects,
  activeProjectId,
  chats: projectChats,
  activeChatId,
  onSelectProject,
  onCreateProject,
  onRenameProject,
  onDeleteProject,
  onSelectChat,
  onCreateChat,
  onRenameChat,
  onDeleteChat,
  onTogglePinChat,
}) {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [workspaceChats, setWorkspaceChats] = useState(() => readWorkspaceChatsForUser(user));
  const [groups, setGroups] = useState([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [expandedSections, setExpandedSections] = useState({
    chats: true,
    projects: true,
    groups: true,
  });

  const isChatView = location.pathname === '/';
  const isProjectView = location.pathname.startsWith('/projects');
  const isGroupView = location.pathname.startsWith('/groups');
  const activeWorkspaceChatId = new URLSearchParams(location.search).get('chat');
  const showingProjectChats = Boolean(activeProjectId);
  const pathParts = location.pathname.split('/').filter(Boolean);
  const activeGroupIdFromRoute = pathParts[0] === 'groups' ? pathParts[1] : null;

  useEffect(() => {
    const syncWorkspaceChats = () => {
      setWorkspaceChats(readWorkspaceChatsForUser(user));
    };

    syncWorkspaceChats();
    window.addEventListener('storage', syncWorkspaceChats);

    return () => {
      window.removeEventListener('storage', syncWorkspaceChats);
    };
  }, [user]);

  useEffect(() => {
    setWorkspaceChats(readWorkspaceChatsForUser(user));
  }, [location.pathname, user]);

  useEffect(() => {
    let isMounted = true;

    const loadGroups = async () => {
      setIsLoadingGroups(true);
      try {
        const response = await listGroups();
        if (!isMounted) {
          return;
        }
        setGroups(response || []);
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setGroups([]);
      } finally {
        if (isMounted) {
          setIsLoadingGroups(false);
        }
      }
    };

    loadGroups();

    return () => {
      isMounted = false;
    };
  }, []);

  const toggleSection = (sectionKey) => {
    setExpandedSections((previous) => ({
      ...previous,
      [sectionKey]: !previous[sectionKey],
    }));
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-20 animate-fade-in bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-72 flex-col overflow-hidden border-r border-border/80 bg-card/95 backdrop-blur-xl transition-all duration-300 ease-in-out md:static md:flex md:translate-x-0 md:duration-200 ${
          isOpen
            ? 'translate-x-0 md:w-72'
            : '-translate-x-full md:w-0 md:border-r-0'
        }`}
      >
        <div className="border-b border-border p-4">
          <div className="mb-3 px-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Workspace
          </div>

          <button
            type="button"
            onClick={onCreateProject}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus size={16} />
            New Project
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
          <section className="rounded-lg border border-border/70 bg-muted/20">
            <div className="flex items-center justify-between px-2 py-2">
              <div className="flex flex-1 items-center gap-1">
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className={`flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
                    isChatView
                      ? 'bg-foreground text-background'
                      : 'text-foreground hover:bg-muted/70'
                  }`}
                >
                  <MessageSquare size={15} />
                  <span>Chats</span>
                </button>

                <button
                  type="button"
                  onClick={onCreateChat}
                  disabled={!activeProjectId}
                  className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-muted/80 disabled:opacity-40"
                  title={activeProjectId ? 'Create new project chat' : 'Select a project first'}
                >
                  <Plus size={12} />
                  New
                </button>

                <button
                  type="button"
                  onClick={() => toggleSection('chats')}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
                  aria-label={expandedSections.chats ? 'Hide chats' : 'Show chats'}
                >
                  {expandedSections.chats ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>
              </div>
            </div>

            {expandedSections.chats && (
              <div className="space-y-1 px-2 pb-2">
                {(showingProjectChats ? projectChats : workspaceChats).length > 0 ? (
                  (showingProjectChats ? projectChats : workspaceChats).map((chat) => (
                    <button
                      key={chat.id}
                      type="button"
                      onClick={() => {
                        if (showingProjectChats) {
                          onSelectChat(chat.id);
                        } else {
                          navigate(`/?chat=${chat.id}`);
                        }
                      }}
                      className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                        (showingProjectChats ? activeChatId === chat.id : activeWorkspaceChatId === chat.id)
                          ? 'bg-foreground/[0.08] text-foreground font-medium'
                          : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                      }`}
                    >
                      <MessageSquare size={14} className="shrink-0 opacity-75" />
                      <span className="truncate">{chat.title}</span>
                    </button>
                  ))
                ) : (
                  <p className="px-2 py-2 text-xs text-muted-foreground">
                    {showingProjectChats ? 'No chats in this project yet.' : 'No chats yet.'}
                  </p>
                )}
              </div>
            )}
          </section>

          <section className="rounded-lg border border-border/70 bg-muted/20">
            <div className="flex items-center justify-between px-2 py-2">
              <button
                type="button"
                onClick={() => navigate('/projects')}
                className={`flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
                  isProjectView
                    ? 'bg-foreground text-background'
                    : 'text-foreground hover:bg-muted/70'
                }`}
              >
                <FolderKanban size={15} />
                <span>Projects</span>
              </button>
              <button
                type="button"
                onClick={() => toggleSection('projects')}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
                aria-label={expandedSections.projects ? 'Hide projects' : 'Show projects'}
              >
                {expandedSections.projects ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
            </div>

            {expandedSections.projects && (
              <div className="space-y-1 px-2 pb-2">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => onSelectProject(project.id)}
                    className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                      activeProjectId === project.id
                        ? 'bg-foreground/[0.08] text-foreground font-medium'
                        : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                    }`}
                  >
                    <FolderKanban size={14} className="shrink-0 opacity-75" />
                    <span className="truncate">{project.name}</span>
                  </button>
                ))}

                {projects.length === 0 && (
                  <p className="px-2 py-2 text-xs text-muted-foreground">No projects yet.</p>
                )}
              </div>
            )}
          </section>

          <section className="rounded-lg border border-border/70 bg-muted/20">
            <div className="flex items-center justify-between px-2 py-2">
              <button
                type="button"
                onClick={() => navigate('/groups')}
                className={`flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
                  isGroupView
                    ? 'bg-foreground text-background'
                    : 'text-foreground hover:bg-muted/70'
                }`}
              >
                <Users size={15} />
                <span>Groups</span>
              </button>
              <button
                type="button"
                onClick={() => toggleSection('groups')}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
                aria-label={expandedSections.groups ? 'Hide groups' : 'Show groups'}
              >
                {expandedSections.groups ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
            </div>

            {expandedSections.groups && (
              <div className="space-y-1 px-2 pb-2">
                {isLoadingGroups ? (
                  <p className="px-2 py-2 text-xs text-muted-foreground">Loading groups...</p>
                ) : groups.length > 0 ? (
                  groups.map((group) => (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => navigate(`/groups/${group.id}`)}
                      className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                        activeGroupIdFromRoute === group.id
                          ? 'bg-foreground/[0.08] text-foreground font-medium'
                          : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                      }`}
                    >
                      <Users size={14} className="shrink-0 opacity-75" />
                      <span className="truncate">{group.name}</span>
                    </button>
                  ))
                ) : (
                  <p className="px-2 py-2 text-xs text-muted-foreground">No groups yet.</p>
                )}
              </div>
            )}
          </section>
        </div>

        <div className="border-t border-border p-4">
          <p className="text-center text-xs tracking-wide text-muted-foreground">
            Miety AI - Your Study Assistant
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="absolute top-3 right-3 z-40 rounded-md p-1.5 text-muted-foreground hover:bg-muted md:hidden"
          aria-label="Close sidebar"
        >
          <X size={18} />
        </button>
      </aside>
    </>
  );
}