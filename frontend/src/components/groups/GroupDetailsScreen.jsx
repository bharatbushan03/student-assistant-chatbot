import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  BellOff,
  BookmarkPlus,
  FileText,
  Images,
  ListPlus,
  Link as LinkIcon,
  Lock,
  LockOpen,
  MoreHorizontal,
  Phone,
  Search,
  Shield,
  Star,
  Trash2,
  UserPlus,
  Video,
  X,
} from 'lucide-react';

function getInitials(name) {
  if (!name) {
    return 'G';
  }

  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function DetailActionButton({ icon, label, onClick, disabled = false }) {
  const ActionIcon = icon;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-w-[86px] flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-card px-3 py-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
    >
      <ActionIcon size={14} />
      <span>{label}</span>
    </button>
  );
}

function SectionTitle({ title, subtitle }) {
  return (
    <div className="mb-3">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {subtitle ? <p className="text-xs text-muted-foreground/90">{subtitle}</p> : null}
    </div>
  );
}

function SettingRow({
  icon,
  label,
  description,
  stateLabel,
  onClick,
  destructive = false,
}) {
  const RowIcon = icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 text-left transition-all duration-300 ${
        destructive
          ? 'border-red-500/25 bg-red-500/8 hover:bg-red-500/12'
          : 'border-border/80 bg-card/70 hover:bg-muted/60'
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${
            destructive ? 'bg-red-500/10 text-red-600 dark:text-red-300' : 'bg-muted/80 text-muted-foreground'
          }`}
        >
          <RowIcon size={14} />
        </div>
        <div className="min-w-0">
          <p className={`text-sm font-medium ${destructive ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
            {label}
          </p>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
      </div>

      {stateLabel ? <span className="text-xs font-medium text-muted-foreground">{stateLabel}</span> : null}
    </button>
  );
}

function ContentCard({ item, type }) {
  const isImage = /\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(item.url);

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="group min-w-[210px] overflow-hidden rounded-2xl border border-border/80 bg-card/65 transition duration-200 hover:-translate-y-0.5 hover:bg-card"
    >
      <div className="relative h-28 overflow-hidden border-b border-border/60 bg-muted/40">
        {type === 'media' && isImage ? (
          <img src={item.url} alt="media" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            {type === 'media' ? <Images size={20} /> : null}
            {type === 'links' ? <LinkIcon size={20} /> : null}
            {type === 'documents' ? <FileText size={20} /> : null}
          </div>
        )}
      </div>
      <div className="space-y-1 px-3 py-2">
        <p className="truncate text-xs font-medium text-foreground">{item.url}</p>
        <p className="text-[11px] text-muted-foreground">
          Shared by {item.sender}
          {item.created_at ? ` - ${new Date(item.created_at).toLocaleDateString()}` : ''}
        </p>
      </div>
    </a>
  );
}

function MemberRow({
  member,
  currentUserId,
  isAdmin,
  onRemoveMember,
  onFavoriteMember,
  onAddMemberToList,
  isRemoving,
}) {
  const canRemove = isAdmin && member.user_id !== currentUserId;
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="relative flex items-center justify-between gap-2 rounded-2xl border border-border/80 bg-card/70 px-3 py-2.5 transition-colors hover:bg-muted/60">
      <div className="flex min-w-0 items-center gap-3">
        {member.avatar_url ? (
          <img
            src={member.avatar_url}
            alt={member.name}
            className="h-10 w-10 rounded-full border border-border object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted text-xs font-semibold text-foreground">
            {getInitials(member.name)}
          </div>
        )}

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium text-foreground">{member.name || member.user_id}</p>
            {member.role === 'admin' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                <Shield size={10} />
                Admin
              </span>
            ) : null}
          </div>

          <p className="truncate text-xs text-muted-foreground">
            {member.phone_number || member.phone || 'Phone not shared'}
          </p>
        </div>
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setIsMenuOpen((current) => !current)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/70 bg-background/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Member actions"
        >
          <MoreHorizontal size={14} />
        </button>

        {isMenuOpen ? (
          <div className="absolute right-0 top-9 z-20 w-44 rounded-xl border border-border/80 bg-popover/95 p-1.5 shadow-lg backdrop-blur">
            <button
              type="button"
              onClick={() => {
                onFavoriteMember(member);
                setIsMenuOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-foreground transition-colors hover:bg-muted"
            >
              <Star size={13} />
              Add to favorites
            </button>
            <button
              type="button"
              onClick={() => {
                onAddMemberToList(member);
                setIsMenuOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-foreground transition-colors hover:bg-muted"
            >
              <ListPlus size={13} />
              Add to list
            </button>

            {canRemove ? (
              <button
                type="button"
                onClick={() => {
                  onRemoveMember(member);
                  setIsMenuOpen(false);
                }}
                disabled={isRemoving}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-60"
              >
                <Trash2 size={13} />
                {isRemoving ? 'Removing...' : 'Remove member'}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function GroupDetailsScreen({
  isOpen,
  onClose,
  group,
  members,
  currentUserId,
  isAdmin,
  onAudioCall,
  onVideoCall,
  onAddMember,
  onSearchInChat,
  onSaveDescription,
  mediaItems,
  linkItems,
  documentItems,
  onManageStorage,
  isMuted,
  onToggleMute,
  mediaVisibility,
  onToggleMediaVisibility,
  chatLockEnabled,
  onToggleChatLock,
  isFavorited,
  onToggleFavorite,
  isAddedToList,
  onToggleAddToList,
  onClearChat,
  onExitGroup,
  onDeleteGroup,
  onReportGroup,
  onConfigureDisappearingMessages,
  onConfigureTheme,
  disappearingMode,
  chatTheme,
  onRemoveMember,
  initialContentTab = 'media',
}) {
  const [activeContentTab, setActiveContentTab] = useState(initialContentTab);
  const [visibleContentCount, setVisibleContentCount] = useState(8);
  const [isViewingAllContent, setIsViewingAllContent] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [visibleMembersCount, setVisibleMembersCount] = useState(20);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [isSavingDescription, setIsSavingDescription] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState(null);

  useEffect(() => {
    if (!isOpen || !group) {
      return;
    }

    setActiveContentTab(initialContentTab || 'media');
    setVisibleContentCount(8);
    setIsViewingAllContent(false);
    setVisibleMembersCount(20);
    setMemberSearch('');
    setDescriptionDraft(group.description || '');
    setIsEditingDescription(false);
    setIsSavingDescription(false);
    setRemovingMemberId(null);
  }, [group, initialContentTab, isOpen]);

  const filteredMembers = useMemo(() => {
    const term = memberSearch.trim().toLowerCase();
    if (!term) {
      return members;
    }

    return members.filter((member) => {
      const name = String(member.name || '').toLowerCase();
      const userId = String(member.user_id || '').toLowerCase();
      const phone = String(member.phone_number || member.phone || '').toLowerCase();
      return name.includes(term) || userId.includes(term) || phone.includes(term);
    });
  }, [memberSearch, members]);

  const contentByTab = useMemo(() => {
    return {
      media: mediaItems,
      links: linkItems,
      documents: documentItems,
    };
  }, [documentItems, linkItems, mediaItems]);

  const activeItems = contentByTab[activeContentTab] || [];
  const visibleItems = activeItems.slice(0, visibleContentCount);
  const visibleMembers = filteredMembers.slice(0, visibleMembersCount);

  const handleSaveDescription = async () => {
    if (!isAdmin || !onSaveDescription) {
      return;
    }

    setIsSavingDescription(true);
    try {
      await onSaveDescription(descriptionDraft.trim());
      setIsEditingDescription(false);
    } finally {
      setIsSavingDescription(false);
    }
  };

  const handleRemoveMember = async (member) => {
    if (!onRemoveMember) {
      return;
    }

    const confirmed = window.confirm(`Remove ${member.name || member.user_id} from this group?`);
    if (!confirmed) {
      return;
    }

    setRemovingMemberId(member.user_id);
    try {
      await onRemoveMember(member.user_id);
    } finally {
      setRemovingMemberId(null);
    }
  };

  const handleFavoriteMember = (member) => {
    if (onToggleFavorite) {
      onToggleFavorite(member);
    }
  };

  const handleAddMemberToList = (member) => {
    if (onToggleAddToList) {
      onToggleAddToList(member);
    }
  };

  if (!isOpen || !group) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] animate-fade-in bg-black/65 backdrop-blur-sm">
      <div className="h-full w-full md:p-6">
        <div className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden border border-border bg-background shadow-[0_18px_50px_rgba(2,6,23,0.28)] md:rounded-3xl">
          <div className="sticky top-0 z-30 border-b border-border/70 bg-background/92 px-4 py-3 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Back to chat"
                >
                  <ArrowLeft size={16} />
                </button>

                <div className={`rounded-full bg-gradient-to-br p-[2px] ${isMuted ? 'from-muted-foreground/55 to-muted-foreground/35' : 'from-primary/80 to-primary/40'}`}>
                  {group.avatar_url ? (
                    <img
                      src={group.avatar_url}
                      alt={group.name}
                      className="h-12 w-12 rounded-full border border-border object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card text-sm font-semibold text-foreground">
                      {getInitials(group.name)}
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold text-foreground">{group.name}</h2>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{members.length} members</span>
                    <span className="h-1 w-1 rounded-full bg-muted-foreground" />
                    <span className="truncate">Premium group controls</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Close details"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto bg-gradient-to-b from-background/96 via-background to-background px-4 py-4 md:px-6 md:py-5">
            <section className="rounded-2xl border border-border/80 bg-card/80 p-3 shadow-sm">
              <SectionTitle title="Quick Actions" subtitle="Audio, video, add, and search with one tap." />
              <div className="flex flex-wrap gap-2">
                <DetailActionButton icon={Phone} label="Audio" onClick={onAudioCall} />
                <DetailActionButton icon={Video} label="Video" onClick={onVideoCall} />
                <DetailActionButton
                  icon={UserPlus}
                  label="Add Member"
                  onClick={onAddMember}
                  disabled={!isAdmin}
                />
                <DetailActionButton icon={Search} label="Search" onClick={onSearchInChat} />
              </div>
            </section>

            <section className="space-y-3 border-b border-border pb-5">
              <SectionTitle title="About Group" subtitle="Only admins can edit group description." />

              {!isEditingDescription ? (
                <div className="rounded-2xl border border-border/80 bg-card/70 px-4 py-3">
                  <p className="text-sm text-foreground">
                    {group.description || 'No group description available.'}
                  </p>

                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={() => setIsEditingDescription(true)}
                      className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      Edit Description
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-3 rounded-2xl border border-border/80 bg-card/70 px-4 py-3">
                  <textarea
                    value={descriptionDraft}
                    onChange={(event) => setDescriptionDraft(event.target.value)}
                    className="min-h-24 w-full rounded-xl border border-border bg-background/70 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary"
                    placeholder="Describe this group"
                  />

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDescriptionDraft(group.description || '');
                        setIsEditingDescription(false);
                      }}
                      className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/70"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveDescription}
                      disabled={isSavingDescription}
                      className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
                    >
                      {isSavingDescription ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              )}
            </section>

            <section className="space-y-3 border-b border-border pb-5">
              <SectionTitle title="Media and Content" subtitle="Browse recent media, links, and documents." />

              <div className="flex flex-wrap items-center gap-2">
                {[
                  { key: 'media', label: 'Media', count: mediaItems.length },
                  { key: 'links', label: 'Links', count: linkItems.length },
                  { key: 'documents', label: 'Documents', count: documentItems.length },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setActiveContentTab(tab.key);
                      setVisibleContentCount(8);
                      setIsViewingAllContent(false);
                    }}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      activeContentTab === tab.key
                        ? 'border border-primary/25 bg-primary/12 text-foreground'
                        : 'border border-border bg-background/65 text-foreground hover:bg-muted'
                    }`}
                  >
                    {tab.label} ({tab.count})
                  </button>
                ))}

                {activeItems.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setVisibleContentCount(activeItems.length);
                      setIsViewingAllContent((current) => !current);
                    }}
                    className="ml-auto rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    {isViewingAllContent ? 'Back to Strip' : 'View All'}
                  </button>
                ) : null}
              </div>

              {visibleItems.length > 0 ? (
                <div className="space-y-3">
                  {isViewingAllContent ? (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {visibleItems.map((item) => (
                        <ContentCard key={`${item.url}-${item.created_at || ''}`} item={item} type={activeContentTab} />
                      ))}
                    </div>
                  ) : (
                    <div className="-mx-1 overflow-x-auto pb-1">
                      <div className="flex min-w-max gap-2 px-1">
                        {visibleItems.map((item) => (
                          <ContentCard key={`${item.url}-${item.created_at || ''}`} item={item} type={activeContentTab} />
                        ))}
                      </div>
                    </div>
                  )}

                  {visibleItems.length < activeItems.length ? (
                    <button
                      type="button"
                      onClick={() => setVisibleContentCount((current) => current + 8)}
                      className="mt-1 rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      Load More
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
                  No {activeContentTab} shared yet.
                </div>
              )}
            </section>

            <section className="space-y-3 border-b border-border pb-5">
              <SectionTitle title="Settings and Controls" subtitle="Manage privacy, notifications, and storage." />

              <div className="grid gap-2 sm:grid-cols-2">
                <SettingRow
                  icon={FileText}
                  label="Manage Storage"
                  description="Review heavy media and free up chat space."
                  onClick={onManageStorage}
                />
                <SettingRow
                  icon={isMuted ? BellOff : Bell}
                  label="Notifications"
                  description="Mute or customize notification behavior."
                  stateLabel={isMuted ? 'Muted' : 'On'}
                  onClick={onToggleMute}
                />
                <SettingRow
                  icon={Images}
                  label="Media Visibility"
                  description="Allow media from this group in gallery view."
                  stateLabel={mediaVisibility ? 'Visible' : 'Hidden'}
                  onClick={onToggleMediaVisibility}
                />
                <SettingRow
                  icon={chatLockEnabled ? Lock : LockOpen}
                  label="Chat Lock"
                  description="Protect this group with an additional lock."
                  stateLabel={chatLockEnabled ? 'Enabled' : 'Off'}
                  onClick={onToggleChatLock}
                />
              </div>

              <div className="space-y-2">
                <SettingRow
                  icon={Bell}
                  label="Disappearing Messages"
                  description="Set auto-delete timer for old messages."
                  stateLabel={disappearingMode}
                  onClick={onConfigureDisappearingMessages}
                />
                <SettingRow
                  icon={Shield}
                  label="Chat Theme"
                  description="Customize this group's chat appearance."
                  stateLabel={chatTheme}
                  onClick={onConfigureTheme}
                />
              </div>
            </section>

            <section className="space-y-3 border-b border-border pb-5">
              <SectionTitle title="Members" subtitle="Search and manage group participants." />

              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={memberSearch}
                  onChange={(event) => {
                    setMemberSearch(event.target.value);
                    setVisibleMembersCount(20);
                  }}
                  className="w-full rounded-full border border-border bg-muted/20 py-2 pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                  placeholder="Search members"
                />
              </div>

              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {visibleMembers.map((member) => (
                  <MemberRow
                    key={member.user_id}
                    member={member}
                    currentUserId={currentUserId}
                    isAdmin={isAdmin}
                    onRemoveMember={handleRemoveMember}
                    onFavoriteMember={handleFavoriteMember}
                    onAddMemberToList={handleAddMemberToList}
                    isRemoving={removingMemberId === member.user_id}
                  />
                ))}

                {visibleMembers.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
                    No members match your search.
                  </div>
                ) : null}
              </div>

              {visibleMembers.length < filteredMembers.length ? (
                <button
                  type="button"
                  onClick={() => setVisibleMembersCount((current) => current + 20)}
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                >
                  Load More Members
                </button>
              ) : null}
            </section>

            <section className="space-y-3 border-b border-border pb-5">
              <SectionTitle title="Your Actions" subtitle="Personalize this group chat for your workflow." />
              <div className="space-y-2">
                <SettingRow
                  icon={Star}
                  label={isFavorited ? 'Remove from Favorites' : 'Add to Favorites'}
                  onClick={onToggleFavorite}
                  stateLabel={isFavorited ? 'Saved' : 'Off'}
                />
                <SettingRow
                  icon={BookmarkPlus}
                  label={isAddedToList ? 'Remove from Custom List' : 'Add to Custom List'}
                  onClick={onToggleAddToList}
                  stateLabel={isAddedToList ? 'Added' : 'Off'}
                />
                <SettingRow
                  icon={Trash2}
                  label="Clear Chat"
                  description="Remove messages from this device view."
                  onClick={onClearChat}
                  destructive
                />
              </div>
            </section>

            <section className="space-y-3 pb-3">
              <SectionTitle title="Danger Zone" subtitle="Critical actions, protected with minimal red accents." />
              <div className="space-y-2">
                <SettingRow
                  icon={ArrowLeft}
                  label="Exit Group"
                  description="Leave this group conversation."
                  onClick={onExitGroup}
                  destructive
                />

                {isAdmin ? (
                  <SettingRow
                    icon={Trash2}
                    label="Delete Group"
                    description="Permanently delete this group and all associated messages."
                    onClick={onDeleteGroup}
                    destructive
                  />
                ) : null}

                <SettingRow
                  icon={Shield}
                  label="Report Group"
                  description="Flag inappropriate behavior to moderators."
                  onClick={onReportGroup}
                  destructive
                />
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

