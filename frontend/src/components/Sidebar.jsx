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
        <div className="border-b border-white/30 px-4 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-200">MIETY AI</p>
          <p className="mt-1 text-sm text-slate-300">Campus workspace</p>
          <button
            type="button"
            onClick={onNewChat}
            className="primary-button mt-4 w-full gap-2"
          >
            <Plus size={18} />
            New Chat
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5">
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
                  className={`group flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2 text-sm transition-colors ${
                    activeChatId === chat.id
                      ? 'border-white/40 bg-white/15 font-medium text-white'
                      : 'border-white/15 text-slate-300 hover:border-white/30 hover:bg-white/10 hover:text-white'
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
                    className="rounded-full p-1 text-slate-400 opacity-0 transition-colors hover:bg-red-500/20 hover:text-red-200 group-hover:opacity-100"
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
                  className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                    activeProjectId === project.id
                      ? 'border-white/40 bg-white/15 font-medium text-white'
                      : 'border-white/15 text-slate-300 hover:border-white/30 hover:bg-white/10 hover:text-white'
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
                  className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                    activeGroupId === group.id
                      ? 'border-white/40 bg-white/15 font-medium text-white'
                      : 'border-white/15 text-slate-300 hover:border-white/30 hover:bg-white/10 hover:text-white'
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

          <section className="rounded-xl border border-white/30 bg-white/5 px-2 py-2">
            <div className="flex items-center gap-2 px-2 py-1">
              <button
                type="button"
                onClick={() => {
                  if (user?.role === 'admin') {
                    navigate('/admin/dashboard');
                  } else if (user?.role === 'faculty') {
                    navigate('/faculty/dashboard');
                  } else {
                    navigate('/student/dashboard');
                  }
                }}
                className="flex flex-1 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
              >
                <LayoutDashboard size={18} />
                Dashboard
              </button>
            </div>
          </section>
        </div>

        <div className="border-t border-white/30 px-4 py-4">
          <p className="text-sm text-slate-400">Student Assistant</p>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white hover:bg-white/20 md:hidden"
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
    <section className="rounded-xl border border-white/30 bg-white/5 px-2 py-2">
      <div className="flex items-center gap-2 px-1 py-1">
        <button
          type="button"
          onClick={onNavigate}
          className={`flex flex-1 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            isActive
              ? 'bg-white/15 text-white'
              : 'text-slate-200 hover:bg-white/10'
          }`}
        >
          <Icon size={18} />
          {title}
        </button>

        <button
          type="button"
          onClick={onToggle}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
          aria-label={isExpanded ? `Hide ${title}` : `Show ${title}`}
        >
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
      </div>

      {isExpanded ? <div className="mt-2 space-y-2 px-2 pb-2">{children}</div> : null}
    </section>
  );
}
