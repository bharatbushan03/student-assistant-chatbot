import React, { useContext, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, FolderKanban, MessageSquare, Plus, Users, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { readWorkspaceChatsForUser } from '../../utils/chatStorage';
import { listProjects } from '../../utils/projectsApi';

export function GroupSidebar({
  isOpen,
  setIsOpen,
  groups,
  activeGroupId,
  onSelectGroup,
  onNewGroup,
  isLoading,
}) {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [workspaceChats, setWorkspaceChats] = useState(() => readWorkspaceChatsForUser(user));
  const [projects, setProjects] = useState([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [expandedSections, setExpandedSections] = useState({
    chats: false,
    projects: false,
    groups: true,
  });

  const isChatView = location.pathname === '/';
  const isProjectView = location.pathname.startsWith('/projects');
  const isGroupView = location.pathname.startsWith('/groups');
  const activeWorkspaceChatId = new URLSearchParams(location.search).get('chat');
  const pathParts = location.pathname.split('/').filter(Boolean);
  const activeProjectIdFromRoute = pathParts[0] === 'projects' ? pathParts[1] : null;

  useEffect(() => {
    const syncWorkspaceChats = () => {
      setWorkspaceChats(readWorkspaceChatsForUser(user));
    };

    syncWorkspaceChats();
    window.addEventListener('storage', syncWorkspaceChats);
    return () => window.removeEventListener('storage', syncWorkspaceChats);
  }, [user]);

  useEffect(() => {
    setWorkspaceChats(readWorkspaceChatsForUser(user));
  }, [location.pathname, user]);

  useEffect(() => {
    let isMounted = true;

    const loadProjects = async () => {
      setIsLoadingProjects(true);
      try {
        const response = await listProjects();
        if (!isMounted) {
          return;
        }
        setProjects(response || []);
      } catch {
        if (!isMounted) {
          return;
        }
        setProjects([]);
      } finally {
        if (isMounted) {
          setIsLoadingProjects(false);
        }
      }
    };

    loadProjects();

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
      {isOpen ? (
        <div
          className="fixed inset-0 z-20 bg-slate-900/20 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      ) : null}

      <aside
        className={`app-sidebar fixed inset-y-0 left-0 z-30 flex w-72 flex-col overflow-hidden transition-transform duration-200 md:static md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:hidden'
        }`}
      >
        <div className="border-b border-border px-4 py-5">
          <p className="section-label">Groups</p>
          <button
            type="button"
            onClick={onNewGroup}
            className="primary-button mt-4 w-full gap-2"
          >
            <Plus size={16} />
            New Group
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
          <WorkspaceSection
            title="Chats"
            icon={MessageSquare}
            isActive={isChatView}
            isExpanded={expandedSections.chats}
            onNavigate={() => navigate('/')}
            onToggle={() => toggleSection('chats')}
          >
            {workspaceChats.length > 0 ? (
              workspaceChats.map((chat) => (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => navigate(`/?chat=${chat.id}`)}
                  className={`flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-sm ${
                    activeWorkspaceChatId === chat.id
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <MessageSquare size={14} className="shrink-0" />
                  <span className="truncate">{chat.title}</span>
                </button>
              ))
            ) : (
              <p className="px-3 py-1 text-sm text-muted-foreground">No chats yet.</p>
            )}
          </WorkspaceSection>

          <WorkspaceSection
            title="Projects"
            icon={FolderKanban}
            isActive={isProjectView}
            isExpanded={expandedSections.projects}
            onNavigate={() => navigate('/projects')}
            onToggle={() => toggleSection('projects')}
          >
            {isLoadingProjects ? (
              <p className="px-3 py-1 text-sm text-muted-foreground">Loading projects...</p>
            ) : projects.length > 0 ? (
              projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => navigate(`/projects/${project.id}`)}
                  className={`flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-sm ${
                    activeProjectIdFromRoute === project.id
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <FolderKanban size={14} className="shrink-0" />
                  <span className="truncate">{project.name}</span>
                </button>
              ))
            ) : (
              <p className="px-3 py-1 text-sm text-muted-foreground">No projects yet.</p>
            )}
          </WorkspaceSection>

          <WorkspaceSection
            title="Groups"
            icon={Users}
            isActive={isGroupView}
            isExpanded={expandedSections.groups}
            onNavigate={() => navigate('/groups')}
            onToggle={() => toggleSection('groups')}
          >
            {isLoading ? (
              <p className="px-3 py-1 text-sm text-muted-foreground">Loading groups...</p>
            ) : groups.length > 0 ? (
              groups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => onSelectGroup(group.id)}
                  className={`flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-sm ${
                    activeGroupId === group.id
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <Users size={14} className="shrink-0" />
                  <span className="truncate">{group.name}</span>
                </button>
              ))
            ) : (
              <p className="px-3 py-1 text-sm text-muted-foreground">No groups yet.</p>
            )}
          </WorkspaceSection>
        </div>

        <div className="border-t border-border px-4 py-4">
          <p className="text-sm text-muted-foreground">Group conversations</p>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:bg-muted md:hidden"
          aria-label="Close sidebar"
        >
          <X size={16} />
        </button>
      </aside>
    </>
  );
}

function WorkspaceSection({
  title,
  icon: Icon,
  isActive,
  isExpanded,
  onNavigate,
  onToggle,
  children,
}) {
  return (
    <section className="rounded-[1.5rem] border border-border bg-card px-2 py-2 shadow-[0_8px_24px_rgba(15,23,42,0.03)]">
      <div className="flex items-center gap-2 px-2 py-1">
        <button
          type="button"
          onClick={onNavigate}
          className={`flex flex-1 items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium ${
            isActive
              ? 'bg-accent text-accent-foreground'
              : 'text-foreground hover:bg-muted'
          }`}
        >
          <Icon size={15} />
          {title}
        </button>

        <button
          type="button"
          onClick={onToggle}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={isExpanded ? `Hide ${title}` : `Show ${title}`}
        >
          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>

      {isExpanded ? <div className="space-y-1 px-1 pb-1 pt-2">{children}</div> : null}
    </section>
  );
}
