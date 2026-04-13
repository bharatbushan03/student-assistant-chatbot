import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, FolderKanban, MessageSquare, Plus, Trash2, Users, X, LayoutDashboard } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { listProjects } from '../utils/projectsApi';
import { listGroups } from '../utils/groupsApi';
import { AuthContext } from '../context/AuthContext';
import { useContext } from 'react';

export function Sidebar({
  isOpen,
  setIsOpen,
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useContext(AuthContext);
  const [projects, setProjects] = useState([]);
  const [groups, setGroups] = useState([]);
  const [isLoadingCollections, setIsLoadingCollections] = useState(true);
  const [expandedSections, setExpandedSections] = useState({
    chats: true,
    projects: false,
    groups: false,
  });

  const isChatView = location.pathname === '/';
  const isProjectView = location.pathname.startsWith('/projects');
  const isGroupView = location.pathname.startsWith('/groups');
  const pathParts = location.pathname.split('/').filter(Boolean);
  const activeProjectId = pathParts[0] === 'projects' ? pathParts[1] : null;
  const activeGroupId = pathParts[0] === 'groups' ? pathParts[1] : null;

  useEffect(() => {
    let isMounted = true;

    const loadCollections = async () => {
      setIsLoadingCollections(true);
      try {
        const [projectsResponse, groupsResponse] = await Promise.all([
          listProjects(),
          listGroups(),
        ]);

        if (!isMounted) {
          return;
        }

        setProjects(projectsResponse || []);
        setGroups(groupsResponse || []);
      } catch {
        if (!isMounted) {
          return;
        }

        setProjects([]);
        setGroups([]);
      } finally {
        if (isMounted) {
          setIsLoadingCollections(false);
        }
      }
    };

    loadCollections();

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
        className={`app-sidebar fixed inset-y-0 left-0 z-30 flex flex-col overflow-hidden transition-transform duration-200 md:static md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:hidden'
        }`}
      >
        <div className="border-b border-border px-4 py-5">
          <p className="section-label">Workspace</p>
          <button
            type="button"
            onClick={onNewChat}
            className="primary-button mt-4 w-full gap-2"
          >
            <Plus size={20} />
            New Chat
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
            {chats.length > 0 ? (
              chats.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => onSelectChat(chat.id)}
                  className={`group flex cursor-pointer items-center justify-between rounded-2xl px-3 py-2.5 text-sm transition-colors ${
                    activeChatId === chat.id
                      ? 'bg-sky-100 text-sky-700 font-medium'
                      : 'text-slate-600 hover:bg-sky-50 hover:text-sky-900'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <MessageSquare size={20} className="shrink-0" />
                    <span className="truncate">{chat.title}</span>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeleteChat(chat.id);
                    }}
                    className="rounded-full p-1 text-slate-400 opacity-0 hover:bg-red-100 hover:text-red-600 group-hover:opacity-100 transition-colors"
                    aria-label="Delete chat"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
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
            {isLoadingCollections ? (
              <p className="px-3 py-1 text-sm text-muted-foreground">Loading projects...</p>
            ) : projects.length > 0 ? (
              projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => navigate(`/projects/${project.id}`)}
                  className={`flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-sm transition-colors ${
                    activeProjectId === project.id
                      ? 'bg-sky-100 text-sky-700 font-medium'
                      : 'text-slate-600 hover:bg-sky-50 hover:text-sky-900'
                  }`}
                >
                  <FolderKanban size={20} className="shrink-0" />
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
            {isLoadingCollections ? (
              <p className="px-3 py-1 text-sm text-muted-foreground">Loading groups...</p>
            ) : groups.length > 0 ? (
              groups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => navigate(`/groups/${group.id}`)}
                  className={`flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-sm transition-colors ${
                    activeGroupId === group.id
                      ? 'bg-sky-100 text-sky-700 font-medium'
                      : 'text-slate-600 hover:bg-sky-50 hover:text-sky-900'
                  }`}
                >
                  <Users size={20} className="shrink-0" />
                  <span className="truncate">{group.name}</span>
                </button>
              ))
            ) : (
              <p className="px-3 py-1 text-sm text-muted-foreground">No groups yet.</p>
            )}
          </WorkspaceSection>

          <section className="rounded-[1.5rem] border border-sky-100 bg-sky-50/50 px-2 py-2 shadow-none">
            <div className="flex items-center gap-2 px-2 py-1">
              <button
                type="button"
                onClick={() => {
                  if (user?.role === 'admin' || user?.role === 'faculty') {
                    navigate('/faculty/dashboard');
                  } else {
                    navigate('/student/dashboard');
                  }
                }}
                className="flex flex-1 items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium transition-colors text-slate-700 hover:bg-sky-50"
              >
                <LayoutDashboard size={20} />
                Dashboard
              </button>
            </div>
          </section>
        </div>

        <div className="border-t border-border px-4 py-4">
          <p className="text-sm text-muted-foreground">Student Assistant</p>
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
    <section className="rounded-[1.5rem] border border-sky-100 bg-sky-50/50 px-2 py-2 shadow-none">
      <div className="flex items-center gap-2 px-2 py-1">
        <button
          type="button"
          onClick={onNavigate}
          className={`flex flex-1 items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium transition-colors ${
            isActive
              ? 'bg-sky-100 text-sky-700'
              : 'text-slate-700 hover:bg-sky-50'
          }`}
        >
          <Icon size={20} />
          {title}
        </button>

        <button
          type="button"
          onClick={onToggle}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-sky-100 hover:text-sky-700 transition-colors"
          aria-label={isExpanded ? `Hide ${title}` : `Show ${title}`}
        >
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
      </div>

      {isExpanded ? <div className="space-y-1 px-1 pb-1 pt-2">{children}</div> : null}
    </section>
  );
}
