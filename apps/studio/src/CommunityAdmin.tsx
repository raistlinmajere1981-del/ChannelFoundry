import { FormEvent, useEffect, useMemo, useState } from "react";
import { saveCommunitySummary } from "./community-summary-cache";

type CommunityUserView = StudioCommunityUser & {
  email?: string | null;
  emailVerified?: boolean;
  specialAccess?: boolean;
};

type ComposerVisibility = "community" | "special";

type ForumAuthor = {
  username: string;
  displayName: string;
};

type ForumAttachment = {
  id: number;
  name: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  url: string;
};

type ForumPost = {
  id: number;
  body: string;
  createdAt: string;
  editedAt: string | null;
  attachments: ForumAttachment[];
  author: ForumAuthor;
};

type ForumThreadSummary = {
  id: number;
  title: string;
  visibility: ComposerVisibility;
  locked: boolean;
  createdAt: string;
  updatedAt: string;
  postCount: number;
  author: ForumAuthor;
};

type ForumThreadDetail = Omit<ForumThreadSummary, "postCount"> & {
  posts: ForumPost[];
};

type CommunityCommandResult = Record<string, unknown>;
type CommunityCommand = (input: Record<string, unknown>) => Promise<CommunityCommandResult>;

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function formatDate(value: string | null) {
  if (!value) return "Henüz giriş yapmadı";
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 KB";
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function specialAccess(user: CommunityUserView) {
  return Boolean(user.specialAccess ?? user.researchAccess);
}

export default function CommunityAdmin({ projectId = "" }: { projectId?: string }) {
  const bridge = window.channelFoundryStudio;
  const command = bridge?.communitySetResearch as unknown as CommunityCommand | undefined;
  const [session, setSession] = useState<StudioCommunitySession | null>(null);
  const [users, setUsers] = useState<CommunityUserView[]>([]);
  const [threads, setThreads] = useState<ForumThreadSummary[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const [selectedThread, setSelectedThread] = useState<ForumThreadDetail | null>(null);
  const [query, setQuery] = useState("");
  const [forumQuery, setForumQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [forumBusy, setForumBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [postTitle, setPostTitle] = useState("");
  const [postBody, setPostBody] = useState("");
  const [postVisibility, setPostVisibility] = useState<ComposerVisibility>("community");
  const [postAttachment, setPostAttachment] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [bootState, setBootState] = useState<"loading" | "ready" | "unavailable" | "error">("loading");
  const [bootRetry, setBootRetry] = useState(0);
  const [view, setView] = useState<"threads" | "users">("threads");
  const [composeOpen, setComposeOpen] = useState(false);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [threadFilter, setThreadFilter] = useState<"all" | "community" | "special" | "locked">("all");
  const [userFilter, setUserFilter] = useState<"all" | "active" | "suspended" | "special">("all");
  const [threadPage, setThreadPage] = useState(1);
  const [userPage, setUserPage] = useState(1);
  const [postPage, setPostPage] = useState(1);
  const LIST_PAGE_SIZE = 40;
  const POSTS_PAGE_SIZE = 40;

  const loadUsers = async () => {
    if (!bridge) throw new Error("Community yönetim köprüsü bulunamadı.");
    setUsersLoading(true);
    try {
      const result = await bridge.communityUsers();
      const next = result.users as CommunityUserView[];
      setUsers(next);
      setUsersLoaded(true);
      setSelectedUserId((previous) => previous && next.some((user) => user.id === previous) ? previous : next[0]?.id ?? null);
    } finally {
      setUsersLoading(false);
    }
  };

  const loadThread = async (threadId: number) => {
    if (!command) throw new Error("Forum yönetim komutu bulunamadı.");
    const result = await command({ action: "forumThread", threadId });
    const thread = result.thread as ForumThreadDetail | undefined;
    if (!thread) throw new Error("Forum konusu alınamadı.");
    setSelectedThread(thread);
    return thread;
  };

  const loadForum = async (preferredThreadId?: number | null) => {
    if (!command) throw new Error("Forum yönetim komutu bulunamadı.");
    const result = await command({ action: "forumThreads" });
    const nextThreads = (result.threads as ForumThreadSummary[] | undefined) ?? [];
    setThreads(nextThreads);
    const nextSelected = preferredThreadId && nextThreads.some((thread) => thread.id === preferredThreadId)
      ? preferredThreadId
      : selectedThreadId && nextThreads.some((thread) => thread.id === selectedThreadId)
        ? selectedThreadId
        : nextThreads[0]?.id ?? null;
    setSelectedThreadId(nextSelected);
    if (!nextSelected) setSelectedThread(null);
    return nextSelected;
  };

  // StudioPipeline lazy-loads this component only when Topluluk is selected.
  // Keep the whole first view behind one loading surface until authentication,
  // topic list and the selected topic have completed. Members are fetched on demand.
  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      if (!bridge || !command) { setBootState("unavailable"); return; }
      setBootState("loading");
      setError(null);
      try {
        const cached = await bridge.communitySession();
        const nextSession = cached.connected ? cached : await bridge.communityAdminConnect();
        if (cancelled) return;
        setSession(nextSession);
        if (!nextSession.connected) { setBootState("unavailable"); return; }
        const result = await command({ action: "forumThreads" });
        const nextThreads = (result.threads as ForumThreadSummary[] | undefined) ?? [];
        const firstId = nextThreads[0]?.id ?? null;
        const firstDetail = firstId ? await command({ action: "forumThread", threadId: firstId }) : null;
        if (cancelled) return;
        setThreads(nextThreads);
        setSelectedThreadId(firstId);
        setSelectedThread(firstDetail ? (firstDetail.thread as ForumThreadDetail ?? null) : null);
        setBootState("ready");
      } catch (bootError) {
        if (cancelled) return;
        setError(errorText(bootError));
        setBootState("error");
      }
    };
    void boot();
    return () => { cancelled = true; };
  }, [bootRetry]);

  useEffect(() => {
    if (bootState !== "ready" || view !== "users" || usersLoaded) return;
    void loadUsers().catch((reason) => setError(errorText(reason)));
  }, [view, bootState, usersLoaded]);

  useEffect(() => {
    if (bootState !== "ready" || view !== "threads" || composeOpen || !selectedThreadId || !command) return;
    if (selectedThread?.id === selectedThreadId) return;
    let cancelled = false;
    setThreadLoading(true);
    void command({ action: "forumThread", threadId: selectedThreadId })
      .then((result) => { if (!cancelled) { setSelectedThread(result.thread as ForumThreadDetail ?? null); setPostPage(1); } })
      .catch((reason) => { if (!cancelled) setError(errorText(reason)); })
      .finally(() => { if (!cancelled) setThreadLoading(false); });
    return () => { cancelled = true; };
  }, [selectedThreadId, view, bootState, composeOpen]);

  const metrics = useMemo(() => ({
    total: users.length,
    threads: threads.length,
    posts: threads.reduce((sum, thread) => sum + thread.postCount, 0),
  }), [threads, users]);

  // Dashboard reads only this small local snapshot, never the community API.
  useEffect(() => {
    if (bootState === "ready") saveCommunitySummary(projectId, {
      threads: metrics.threads, posts: metrics.posts,
      ...(usersLoaded ? { members: metrics.total } : {}),
    });
  }, [bootState, projectId, metrics.threads, metrics.posts, metrics.total, usersLoaded]);

  const filteredUsers = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("tr-TR");
    return users.filter((user) => {
      if (userFilter === "active" && user.status !== "active") return false;
      if (userFilter === "suspended" && user.status !== "suspended") return false;
      if (userFilter === "special" && !specialAccess(user) && user.role !== "admin") return false;
      return !term || `${user.displayName} ${user.username} ${user.email ?? ""}`.toLocaleLowerCase("tr-TR").includes(term);
    });
  }, [query, users, userFilter]);

  const filteredThreads = useMemo(() => {
    const term = forumQuery.trim().toLocaleLowerCase("tr-TR");
    return threads.filter((thread) => {
      if (threadFilter === "locked" && !thread.locked) return false;
      if (threadFilter === "community" && thread.visibility !== "community") return false;
      if (threadFilter === "special" && thread.visibility !== "special") return false;
      return !term || `${thread.title} ${thread.author.displayName} ${thread.author.username} ${thread.visibility}`
        .toLocaleLowerCase("tr-TR").includes(term);
    });
  }, [forumQuery, threads, threadFilter]);

  const changeSpecial = async (user: CommunityUserView) => {
    if (!bridge) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const enabled = !specialAccess(user);
      await bridge.communitySetResearch({ userId: user.id, enabled });
      setUsers((current) => current.map((candidate) => candidate.id === user.id
        ? { ...candidate, specialAccess: enabled, researchAccess: enabled }
        : candidate));
      setNotice(`${user.displayName} için özel paylaşım yetkisi ${enabled ? "açıldı" : "kapatıldı"}.`);
    } catch (changeError) {
      setError(errorText(changeError));
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (user: CommunityUserView) => {
    if (!bridge) return;
    const nextStatus = user.status === "active" ? "suspended" : "active";
    const action = nextStatus === "suspended" ? "üyeliği iptal edilsin" : "üyeliği yeniden açılsın";
    if (!window.confirm(`“${user.displayName}” için ${action} mı? Forum geçmişi korunacaktır.`)) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await bridge.communitySetStatus({ userId: user.id, status: nextStatus });
      setUsers((current) => current.map((candidate) => candidate.id === user.id
        ? { ...candidate, status: nextStatus, ...(nextStatus === "suspended" ? { specialAccess: false, researchAccess: false } : {}) }
        : candidate));
      setNotice(`${user.displayName} üyeliği ${nextStatus === "active" ? "yeniden açıldı" : "iptal edildi"}.`);
    } catch (changeError) {
      setError(errorText(changeError));
    } finally {
      setBusy(false);
    }
  };

  const submitPost = async (event: FormEvent) => {
    event.preventDefault();
    if (!command) return;
    if (postAttachment && postAttachment.size > 12 * 1024 * 1024) {
      setError("Forum eki 12 MB sınırını aşıyor.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const attachment = postAttachment ? {
        name: postAttachment.name,
        type: postAttachment.type || "application/octet-stream",
        data: new Uint8Array(await postAttachment.arrayBuffer()),
      } : null;
      const result = await command({
        action: "createThread",
        title: postTitle,
        body: postBody,
        visibility: postVisibility,
        attachment,
      });
      const createdThreadId = Number(result.threadId || 0) || null;
      setPostTitle("");
      setPostBody("");
      setPostAttachment(null);
      setFileKey((value) => value + 1);
      setNotice(postVisibility === "special"
        ? "Özel paylaşım yayınlandı. Yalnızca özel yetkili üyeler görebilir."
        : "Topluluk paylaşımı yayınlandı.");
      setSelectedThread(null);
      setUsersLoaded(false); // Refresh member activity only when the Üyeler tab is opened.
      await loadForum(createdThreadId);
      setComposeOpen(false);
      setThreadPage(1);
    } catch (postError) {
      setError(errorText(postError));
    } finally {
      setBusy(false);
    }
  };

  const refreshForum = async () => {
    setForumBusy(true);
    setError(null);
    try {
      const nextSelected = await loadForum(selectedThreadId);
      if (nextSelected) await loadThread(nextSelected);
    } catch (refreshError) {
      setError(errorText(refreshError));
    } finally {
      setForumBusy(false);
    }
  };

  const updateThread = async (changes: Partial<Pick<ForumThreadDetail, "visibility" | "locked">>) => {
    if (!command || !selectedThread) return;
    const visibility = changes.visibility ?? selectedThread.visibility;
    const locked = changes.locked ?? selectedThread.locked;
    setForumBusy(true);
    setError(null);
    setNotice(null);
    try {
      await command({
        action: "updateThread",
        threadId: selectedThread.id,
        visibility,
        locked,
      });
      setSelectedThread((current) => current ? { ...current, visibility, locked } : current);
      setThreads((current) => current.map((thread) => thread.id === selectedThread.id
        ? { ...thread, visibility, locked }
        : thread));
      setNotice(`“${selectedThread.title}” konusu güncellendi.`);
    } catch (updateError) {
      setError(errorText(updateError));
    } finally {
      setForumBusy(false);
    }
  };

  const deleteThread = async () => {
    if (!command || !selectedThread) return;
    if (!window.confirm(`“${selectedThread.title}” konusu ve tüm mesajları kalıcı olarak silinsin mi?`)) return;
    setForumBusy(true);
    setError(null);
    setNotice(null);
    try {
      await command({ action: "deleteThread", threadId: selectedThread.id });
      setNotice(`“${selectedThread.title}” konusu silindi.`);
      setSelectedThread(null);
      setSelectedThreadId(null);
      setUsersLoaded(false);
      await loadForum(null);
    } catch (deleteError) {
      setError(errorText(deleteError));
    } finally {
      setForumBusy(false);
    }
  };

  const deletePost = async (post: ForumPost) => {
    if (!command || !selectedThread) return;
    if (!window.confirm(`${post.author.displayName} tarafından gönderilen bu mesaj silinsin mi?`)) return;
    setForumBusy(true);
    setError(null);
    setNotice(null);
    try {
      await command({ action: "deletePost", postId: post.id });
      setNotice("Forum mesajı silindi.");
      setUsersLoaded(false);
      await Promise.all([loadThread(selectedThread.id), loadForum(selectedThread.id)]);
    } catch (deleteError) {
      setError(errorText(deleteError));
    } finally {
      setForumBusy(false);
    }
  };

  const selectedUser = users.find((user) => user.id === selectedUserId) ?? null;
  const threadPages = Math.max(1, Math.ceil(filteredThreads.length / LIST_PAGE_SIZE));
  const userPages = Math.max(1, Math.ceil(filteredUsers.length / LIST_PAGE_SIZE));
  const visibleThreads = filteredThreads.slice((Math.min(threadPage, threadPages) - 1) * LIST_PAGE_SIZE, Math.min(threadPage, threadPages) * LIST_PAGE_SIZE);
  const visibleUsers = filteredUsers.slice((Math.min(userPage, userPages) - 1) * LIST_PAGE_SIZE, Math.min(userPage, userPages) * LIST_PAGE_SIZE);
  const displayedThread = selectedThread?.id === selectedThreadId ? selectedThread : null;
  const postPages = Math.max(1, Math.ceil((displayedThread?.posts.length ?? 0) / POSTS_PAGE_SIZE));
  const visiblePosts = displayedThread?.posts.slice((Math.min(postPage, postPages) - 1) * POSTS_PAGE_SIZE, Math.min(postPage, postPages) * POSTS_PAGE_SIZE) ?? [];

  if (!bridge || !command) {
    return <section className="community-console-state panel" role="alert"><h2>Topluluk bağlantısı bulunamadı</h2><p>Bu bölüm yalnızca Studio içinde çalışır.</p></section>;
  }

  if (bootState === "loading") {
    return <section className="community-console-state panel" role="status" aria-live="polite">
      <span className="community-console-spinner" aria-hidden="true"/>
      <h2>Topluluk hazırlanıyor</h2>
      <p>Yönetici bağlantısı doğrulanıyor, konular ve ilk mesajlar yükleniyor…</p>
    </section>;
  }

  if (bootState !== "ready") {
    return <section className="community-console-state panel" role="alert">
      <h2>{bootState === "unavailable" ? "Yönetici bağlantısı gerekli" : "Topluluk yüklenemedi"}</h2>
      <p>{error || session?.lastError || "Yönetici bağlantısı Ayarlar bölümünden yapılandırılabilir."}</p>
      <button type="button" className="secondary-button" onClick={() => { setBootState("loading"); setBootRetry((value) => value + 1); }}>Tekrar bağlan</button>
    </section>;
  }

  return <section className="community-admin-view community-console" aria-label="Topluluk yönetimi">
    <header className="community-console-header">
      <div className="community-console-tabs" role="tablist" aria-label="Topluluk çalışma alanı">
        <button type="button" id="community-topics-tab" role="tab" aria-selected={view === "threads"} aria-controls="community-console-workspace"
          className={view === "threads" ? "active" : ""} onClick={() => { setView("threads"); setComposeOpen(false); }}>Konular <span>{metrics.threads}</span></button>
        <button type="button" id="community-users-tab" role="tab" aria-selected={view === "users"} aria-controls="community-console-workspace"
          className={view === "users" ? "active" : ""} onClick={() => setView("users")}>Üyeler <span>{usersLoaded ? metrics.total : "—"}</span></button>
      </div>
      <div className="community-console-summary">
        <span><i className="community-console-dot" aria-hidden="true"/>Bağlı</span>
        <span>{metrics.threads} konu · {metrics.posts} mesaj{usersLoaded ? ` · ${metrics.total} üye` : ""}</span>
      </div>
      <div className="community-console-main-actions">
        {view === "threads" && <button type="button" className={composeOpen ? "community-console-action active" : "community-console-action"}
          onClick={() => setComposeOpen((current) => !current)} aria-expanded={composeOpen}>
          {composeOpen ? "Konulara dön" : "+ Yeni konu"}
        </button>}
        <button type="button" className="community-console-action" onClick={() => void (view === "threads" ? refreshForum() : loadUsers().catch((reason) => setError(errorText(reason))))}
          disabled={view === "threads" ? forumBusy : usersLoading} aria-label="Görünümü yenile">↻ Yenile</button>
      </div>
    </header>

    {(error || notice) && <div className={error ? "community-console-feedback error" : "community-console-feedback success"} role={error ? "alert" : "status"}>
      <span>{error ?? notice}</span>
      <button type="button" onClick={() => { setError(null); setNotice(null); }} aria-label="Bildirimi kapat">×</button>
    </div>}

    <div className="community-console-body" id="community-console-workspace" role="tabpanel" aria-labelledby={view === "threads" ? "community-topics-tab" : "community-users-tab"}>
      <aside className="community-console-sidebar">
        <div className="community-console-search">
          <input aria-label={view === "threads" ? "Konu ara" : "Üye ara"}
            value={view === "threads" ? forumQuery : query}
            placeholder={view === "threads" ? "Konu veya kullanıcı ara…" : "Ad, kullanıcı veya e-posta ara…"}
            onChange={(event) => view === "threads" ? (setForumQuery(event.target.value), setThreadPage(1)) : (setQuery(event.target.value), setUserPage(1))}/>
          {view === "threads"
            ? <select aria-label="Konu filtresi" value={threadFilter} onChange={(event) => { setThreadFilter(event.target.value as typeof threadFilter); setThreadPage(1); }}>
                <option value="all">Tüm konular</option><option value="community">Topluluk</option><option value="special">Özel</option><option value="locked">Kilitli</option>
              </select>
            : <select aria-label="Üye filtresi" value={userFilter} onChange={(event) => { setUserFilter(event.target.value as typeof userFilter); setUserPage(1); }}>
                <option value="all">Tüm üyeler</option><option value="active">Aktif</option><option value="suspended">Kapalı</option><option value="special">Özel yetkili</option>
              </select>}
        </div>
        <div className="community-console-list" role="list" aria-label={view === "threads" ? "Konu listesi" : "Üye listesi"}>
          {view === "threads" ? <>
            {visibleThreads.map((thread) => <button type="button" role="listitem" key={thread.id}
              className={thread.id === selectedThreadId && !composeOpen ? "community-console-item selected" : "community-console-item"}
              onClick={() => { setSelectedThreadId(thread.id); setComposeOpen(false); setPostPage(1); }}>
              <span className="community-console-item-upper"><span className={thread.visibility === "special" ? "community-console-kind special" : "community-console-kind"}>{thread.visibility === "special" ? "ÖZEL" : "TOPLULUK"}</span>
                {thread.locked && <span className="community-console-kind">KİLİTLİ</span>}</span>
              <strong>{thread.title}</strong><small>@{thread.author.username} · {thread.postCount} mesaj · {formatDate(thread.updatedAt)}</small>
            </button>)}
            {!filteredThreads.length && <p className="community-console-list-empty">Konu bulunamadı.</p>}
          </> : <>
            {!usersLoaded && <p className="community-console-list-empty">{usersLoading || !error ? "Üyeler yükleniyor…" : "Üyeler alınamadı. Yenile ile tekrar dene."}</p>}
            {visibleUsers.map((user) => <button type="button" role="listitem" key={user.id}
              className={user.id === selectedUserId ? "community-console-item selected" : "community-console-item"}
              onClick={() => setSelectedUserId(user.id)}>
              <span className="community-console-user-line"><span className={user.role === "admin" ? "community-console-avatar admin" : "community-console-avatar"}>{user.displayName.trim().slice(0, 2).toLocaleUpperCase("tr-TR") || "ÜY"}</span>
                <span><strong>{user.displayName}</strong><small>@{user.username} · {user.role === "admin" ? "Yönetici" : "Üye"}</small></span>
                <span className={user.status === "active" ? "community-console-user-state" : "community-console-user-state suspended"}>{user.status === "active" ? "Aktif" : "Kapalı"}</span>
              </span>
              <small>{user.threadCount} konu · {user.postCount} mesaj · {formatDate(user.lastLoginAt)}</small>
            </button>)}
            {usersLoaded && !filteredUsers.length && <p className="community-console-list-empty">Üye bulunamadı.</p>}
          </>}
        </div>
        <div className="community-console-pagination">
          <span>{view === "threads" ? filteredThreads.length : filteredUsers.length} kayıt</span>
          <div>
            <button type="button" aria-label="Önceki liste sayfası" disabled={(view === "threads" ? threadPage : userPage) <= 1}
              onClick={() => view === "threads" ? setThreadPage((p) => Math.max(1, p - 1)) : setUserPage((p) => Math.max(1, p - 1))}>‹</button>
            <span>{view === "threads" ? Math.min(threadPage, threadPages) : Math.min(userPage, userPages)} / {view === "threads" ? threadPages : userPages}</span>
            <button type="button" aria-label="Sonraki liste sayfası" disabled={(view === "threads" ? threadPage >= threadPages : userPage >= userPages)}
              onClick={() => view === "threads" ? setThreadPage((p) => p + 1) : setUserPage((p) => p + 1)}>›</button>
          </div>
        </div>
      </aside>

      <div className="community-console-detail">
        {view === "threads" && composeOpen && <section className="community-console-composer" aria-label="Yeni konu">
          <header className="community-console-detail-top"><div><small>YENİ PAYLAŞIM</small><h2>Yeni konu aç</h2></div>
            <button type="button" className="community-console-close" onClick={() => setComposeOpen(false)} aria-label="Yeni konuyu kapat">×</button>
          </header>
          <form onSubmit={submitPost} className="community-console-form">
            <label><span>Başlık</span><input value={postTitle} onChange={(event) => setPostTitle(event.target.value)} minLength={4} maxLength={140} placeholder="Konu başlığı" required/></label>
            <label><span>Görünürlük</span><select value={postVisibility} onChange={(event) => setPostVisibility(event.target.value as ComposerVisibility)}>
              <option value="community">Topluluk</option><option value="special">Özel yetkili üyeler</option>
            </select></label>
            <label className="community-console-form-message"><span>Mesaj</span><textarea value={postBody} onChange={(event) => setPostBody(event.target.value)} minLength={2} maxLength={12000} rows={9} placeholder="Mesajınızı yazın…" required/></label>
            <label className="community-console-form-file"><span>Dosya ekle (en fazla 12 MB)</span>
              <input key={fileKey} type="file" accept=".pdf,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp,.gif,.mp4,.webm,.zip,.docx,.xlsx,.pptx"
                onChange={(event) => setPostAttachment(event.target.files?.[0] || null)}/></label>
            <footer><small>{postAttachment ? `${postAttachment.name} · ${formatBytes(postAttachment.size)}` : "Ek yok"}</small>
              <button className="primary-button" disabled={busy} type="submit">{busy ? "Yayınlanıyor…" : "Foruma yayınla"}</button></footer>
          </form>
        </section>}

        {view === "threads" && !composeOpen && <>
          {threadLoading && <div className="community-console-detail-empty" role="status">Konu yükleniyor…</div>}
          {!threadLoading && !displayedThread && <div className="community-console-detail-empty">Bir konu seç.</div>}
          {!threadLoading && displayedThread && <>
            <header className="community-console-detail-top">
              <div><small>@{displayedThread.author.username} · {formatDate(displayedThread.createdAt)}</small>
                <h2>{displayedThread.title}</h2></div>
              <div className="community-console-topic-actions">
                <label><span>Görünürlük</span><select aria-label="Konu görünürlüğü" value={displayedThread.visibility} disabled={forumBusy}
                  onChange={(event) => void updateThread({visibility:event.target.value as ComposerVisibility})}>
                  <option value="community">Topluluk</option><option value="special">Özel</option></select></label>
                <button className="community-console-action" type="button" disabled={forumBusy} onClick={() => void updateThread({locked:!displayedThread.locked})}>{displayedThread.locked ? "Yanıtları aç" : "Yanıtları kilitle"}</button>
                <button className="community-console-danger" type="button" disabled={forumBusy} onClick={() => void deleteThread()}>Konuyu sil</button>
              </div>
            </header>
            <div className="community-console-posts">
              {visiblePosts.map((post, index) => <article className="community-console-post" key={post.id}>
                <div className="community-console-post-head">
                  <div><strong>{post.author.displayName}</strong><small>@{post.author.username} · {formatDate(post.createdAt)}{post.editedAt ? " · düzenlendi" : ""}</small></div>
                  {post.id === displayedThread.posts[0]?.id ? <span className="community-console-origin">Başlangıç mesajı</span> :
                    <button className="community-console-danger-link" type="button" disabled={forumBusy} onClick={() => void deletePost(post)}>Mesajı sil</button>}
                </div>
                <p>{post.body}</p>
                {!!post.attachments.length && <div className="community-console-attachments">
                  {post.attachments.map((attachment) => <span key={attachment.id}>{attachment.name} · {formatBytes(attachment.sizeBytes)}</span>)}
                </div>}
              </article>)}
            </div>
            {postPages > 1 && <footer className="community-console-post-pages">
              <button type="button" disabled={postPage <= 1} onClick={() => setPostPage((value) => Math.max(1,value-1))}>Önceki mesajlar</button>
              <span>{Math.min(postPage,postPages)} / {postPages}</span>
              <button type="button" disabled={postPage >= postPages} onClick={() => setPostPage((value) => value+1)}>Sonraki mesajlar</button>
            </footer>}
          </>}
        </>}

        {view === "users" && <>
          {!usersLoaded && <div className="community-console-detail-empty" role="status">{usersLoading || !error ? "Üyeler yükleniyor…" : "Üyeler alınamadı. Yenile ile tekrar dene."}</div>}
          {usersLoaded && !selectedUser && <div className="community-console-detail-empty">Bir üye seç.</div>}
          {selectedUser && <section className="community-console-member">
            <header className="community-console-detail-top">
              <div><small>{selectedUser.role === "admin" ? "YÖNETİCİ" : "ÜYE"} · @{selectedUser.username}</small>
                <h2>{selectedUser.displayName}</h2></div>
              <span className={selectedUser.status === "active" ? "community-console-member-status" : "community-console-member-status suspended"}>{selectedUser.status === "active" ? "Aktif" : "Erişime kapalı"}</span>
            </header>
            <dl className="community-console-member-facts">
              <div><dt>E-posta</dt><dd>{selectedUser.email || "Kayıt yok"}{selectedUser.email && <small>{selectedUser.emailVerified === false ? "Doğrulanmamış" : "Doğrulandı"}</small>}</dd></div>
              <div><dt>Son giriş</dt><dd>{formatDate(selectedUser.lastLoginAt)}</dd></div>
              <div><dt>Konular</dt><dd>{selectedUser.threadCount}</dd></div>
              <div><dt>Mesajlar</dt><dd>{selectedUser.postCount}</dd></div>
            </dl>
            <div className="community-console-member-controls">
              <div><strong>Özel paylaşım yetkisi</strong><small>Özel konuları görme erişimi</small></div>
              <button type="button" className={specialAccess(selectedUser) || selectedUser.role === "admin" ? "community-console-action active" : "community-console-action"}
                disabled={busy || selectedUser.status === "suspended" || selectedUser.role === "admin"}
                onClick={() => void changeSpecial(selectedUser)} aria-pressed={specialAccess(selectedUser) || selectedUser.role === "admin"}>
                {specialAccess(selectedUser) || selectedUser.role === "admin" ? "Açık" : "Kapalı"}
              </button>
            </div>
            <div className="community-console-member-controls">
              <div><strong>Üyelik durumu</strong><small>{selectedUser.status === "active" ? "Üyeliği kapatmak geçmiş mesajları silmez" : "Erişimi yeniden aç"}</small></div>
              <button type="button" className={selectedUser.status === "active" ? "community-console-danger" : "community-console-action"}
                disabled={busy || selectedUser.username === session?.username}
                onClick={() => void changeStatus(selectedUser)}>
                {selectedUser.status === "active" ? "Üyeliği iptal et" : "Üyeliği yeniden aç"}
              </button>
            </div>
          </section>}
        </>}
      </div>
    </div>
  </section>;
}
