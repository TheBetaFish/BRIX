import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import type { Session } from "@supabase/supabase-js";
import {
  Home, Cloud, Gamepad2, Settings, Search, PanelLeftClose, PanelLeftOpen,
  Play, Clock3, ChevronRight, MoreHorizontal, Star,
  Info, Trash2, X, Wifi, Maximize2, ArrowLeft, Sun, Moon,
  Layers3, Users, UserPlus, ChevronDown, Check, Copy, Monitor
} from "lucide-react";

type Page = "Home" | "Xbox Cloud Gaming Library" | "Local Library" | "Settings" | "Account";
type Theme = "light" | "dark" | "metallic";
type Game = { title: string; category: string; tag?: string; source: "xbox" | "local"; description: string };

const initialGames: Game[] = [
  { title: "Fortnite", category: "Battle Royale", tag: "Featured", source: "xbox", description: "Drop into the island, build, explore, and compete with friends." },
  { title: "Forza Horizon 5", category: "Racing", source: "xbox", description: "Explore an open-world racing festival set across Mexico." },
  { title: "Starfield", category: "RPG", source: "xbox", description: "Explore a vast universe in this science-fiction role-playing adventure." },
  { title: "Halo Infinite", category: "Shooter", source: "xbox", description: "Experience the next chapter of the Halo story." },
];

const navItems = [
  { label: "Home" as Page, icon: Home },
  { label: "Xbox Cloud Gaming Library" as Page, icon: Cloud },
  { label: "Local Library" as Page, icon: Gamepad2 },
];

function App() {
  const [page, setPage] = useState<Page>("Home");
  const [showWelcome, setShowWelcome] = useState(() => localStorage.getItem("brix-entry-choice") !== "guest");
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [accountMode, setAccountMode] = useState<"signin" | "signup">("signin");
  const [authNotice, setAuthNotice] = useState("");
  const [profileName, setProfileName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarPath, setAvatarPath] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileNotice, setProfileNotice] = useState("");
  const avatarInput = useRef<HTMLInputElement>(null);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [friendCodeInput, setFriendCodeInput] = useState("");
  const [friendNotice, setFriendNotice] = useState("");
  const [friendBusy, setFriendBusy] = useState(false);
  const [brixId, setBrixId] = useState("");
  const [friendships, setFriendships] = useState<Array<{
    id: string; requester_id: string; addressee_id: string; status: "pending" | "accepted" | "declined";
    profile: { id: string; brix_id: string; display_name: string; avatar_url: string | null; microsoft_connected: boolean } | null;
  }>>([]);
  const microsoftConnected = Boolean(session?.user.identities?.some(identity => identity.provider === "azure"));

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return; }
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setAuthNotice(error.message);
      setSession(data.session);
      if (data.session) setShowWelcome(false);
      else setShowWelcome(localStorage.getItem("brix-entry-choice") !== "guest");
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) { setShowWelcome(false); localStorage.removeItem("brix-entry-choice"); }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !session?.user.id) {
      setProfileName("");
      setAvatarUrl("");
      setAvatarPath("");
      return;
    }
    let cancelled = false;
    async function loadProfile() {
      const { data, error } = await supabase!
        .from("profiles")
        .select("display_name, avatar_url, avatar_path, brix_id")
        .eq("id", session!.user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setProfileNotice("Profile details could not be loaded. Check that the latest BRIX database schema has been applied.");
        setProfileName(session!.user.user_metadata?.display_name ?? "");
        return;
      }
      setProfileName(data?.display_name || session!.user.user_metadata?.display_name || "");
      setAvatarUrl(data?.avatar_url ?? "");
      setAvatarPath(data?.avatar_path ?? "");
      setBrixId(data?.brix_id ?? "");
    }
    void loadProfile();
    return () => { cancelled = true; };
  }, [session?.user.id]);

  async function loadFriendships() {
    if (!supabase || !session) { setFriendships([]); return; }
    const client = supabase;
    const currentUserId = session.user.id;
    const { data, error } = await client.from("friendships").select("id, requester_id, addressee_id, status")
      .or("requester_id.eq." + currentUserId + ",addressee_id.eq." + currentUserId).order("created_at", { ascending: false });
    if (error) { setFriendNotice("Friends could not be loaded. Apply the latest BRIX SQL schema."); return; }
    const rows = data ?? [];
    const otherIds = [...new Set(rows.map(row => row.requester_id === currentUserId ? row.addressee_id : row.requester_id))];
    if (!otherIds.length) { setFriendships([]); return; }
    const { data: profiles, error: profileError } = await client.from("profiles")
      .select("id, brix_id, display_name, avatar_url, microsoft_connected").in("id", otherIds);
    if (profileError) { setFriendNotice("Friend profiles could not be loaded."); return; }
    const byId = new Map((profiles ?? []).map(profile => [profile.id, profile]));
    setFriendships(rows.map(row => ({ ...row, status: row.status as "pending" | "accepted" | "declined",
      profile: byId.get(row.requester_id === currentUserId ? row.addressee_id : row.requester_id) ?? null })));
  }

  useEffect(() => { void loadFriendships(); }, [session?.user.id]);

  useEffect(() => {
    if (!supabase || !session) return;
    const linked = Boolean(session.user.identities?.some(identity => identity.provider === "azure"));
    void supabase.from("profiles").update({ microsoft_connected: linked }).eq("id", session.user.id);
  }, [session?.user.id, session?.user.identities?.length]);

  async function addFriendByCode() {
    if (!supabase || !session) { setFriendNotice("Sign in to add friends."); return; }
    const code = friendCodeInput.trim().toUpperCase();
    if (!code) return;
    setFriendBusy(true); setFriendNotice("");
    const { data: target, error: lookupError } = await supabase.from("profiles").select("id, brix_id").eq("brix_id", code).maybeSingle();
    if (lookupError || !target) {
      setFriendNotice(lookupError ? "Friend lookup failed: " + lookupError.message : "No BRIX account matches that friend code.");
      setFriendBusy(false); return;
    }
    if (target.id === session.user.id) { setFriendNotice("You cannot add your own account."); setFriendBusy(false); return; }
    const { error } = await supabase.from("friendships").insert({ requester_id: session.user.id, addressee_id: target.id, status: "pending" });
    if (error) setFriendNotice(error.code === "23505" ? "A friendship or request already exists with that account." : "Could not send request: " + error.message);
    else { setFriendNotice("Friend request sent."); setFriendCodeInput(""); await loadFriendships(); }
    setFriendBusy(false);
  }

  async function respondToFriendRequest(id: string, status: "accepted" | "declined") {
    if (!supabase) return;
    const { error } = await supabase.from("friendships").update({ status }).eq("id", id);
    setFriendNotice(error ? "Could not update request: " + error.message : status === "accepted" ? "Friend added." : "Request declined.");
    if (!error) await loadFriendships();
  }

  async function removeFriend(id: string) {
    if (!supabase) return;
    const { error } = await supabase.from("friendships").delete().eq("id", id);
    setFriendNotice(error ? "Could not remove friend: " + error.message : "Friend removed.");
    if (!error) await loadFriendships();
  }

  async function connectMicrosoft() {
    if (!supabase || !session) { setAuthNotice("Sign in to BRIX before linking a Microsoft account."); changePage("Account"); return; }
    setAuthBusy(true); setAuthNotice("");
    try {
      const { data, error } = await supabase.auth.linkIdentity({
        provider: "azure",
        options: { scopes: "openid profile email XboxLive.signin offline_access",
          redirectTo: window.location.origin + window.location.pathname, queryParams: { prompt: "select_account" } }
      });
      if (error) {
        setAuthNotice("Microsoft linking failed: " + error.message);
        setAuthBusy(false);
        changePage("Account");
        return;
      }
      if (data?.url) {
        window.location.assign(data.url);
        return;
      }
      setAuthNotice("Supabase did not return a Microsoft sign-in URL. Check that Azure is enabled in Supabase.");
    } catch (error) {
      setAuthNotice("Microsoft linking request failed: " + (error instanceof Error ? error.message : String(error)));
    }
    setAuthBusy(false);
    changePage("Account");
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !session) return;
    const cleanName = profileName.trim();
    if (!cleanName) { setProfileNotice("Enter a display name."); return; }
    setProfileBusy(true); setProfileNotice("");
    const { error } = await supabase.from("profiles")
      .update({ display_name: cleanName, updated_at: new Date().toISOString() })
      .eq("id", session.user.id);
    if (!error) {
      const { error: metadataError } = await supabase.auth.updateUser({ data: { display_name: cleanName } });
      if (metadataError) setProfileNotice("Your profile was saved, but the account display name could not be refreshed: " + metadataError.message);
      else setProfileNotice("Profile saved.");
    } else setProfileNotice("Could not save profile: " + error.message);
    setProfileBusy(false);
  }

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !supabase || !session) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setProfileNotice("Choose a PNG, JPEG, or WebP image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setProfileNotice("Profile pictures must be 2 MB or smaller.");
      return;
    }
    setProfileBusy(true); setProfileNotice("");
    const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/webp" ? "webp" : "png";
    const path = session.user.id + "/" + crypto.randomUUID() + "." + extension;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, {
      contentType: file.type, cacheControl: "3600", upsert: false
    });
    if (uploadError) {
      setProfileNotice("Avatar upload failed: " + uploadError.message);
      setProfileBusy(false);
      return;
    }
    const { data: publicData } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error: profileError } = await supabase.from("profiles")
      .update({ avatar_url: publicData.publicUrl, avatar_path: path, updated_at: new Date().toISOString() })
      .eq("id", session.user.id);
    if (profileError) {
      await supabase.storage.from("avatars").remove([path]);
      setProfileNotice("Image uploaded, but the profile could not be updated: " + profileError.message);
    } else {
      if (avatarPath) await supabase.storage.from("avatars").remove([avatarPath]);
      setAvatarUrl(publicData.publicUrl);
      setAvatarPath(path);
      setProfileNotice("Profile picture updated.");
    }
    setProfileBusy(false);
  }

  async function removeAvatar() {
    if (!supabase || !session || !avatarPath) return;
    setProfileBusy(true); setProfileNotice("");
    const { error } = await supabase.from("profiles")
      .update({ avatar_url: null, avatar_path: null, updated_at: new Date().toISOString() })
      .eq("id", session.user.id);
    if (error) setProfileNotice("Could not remove profile picture: " + error.message);
    else {
      await supabase.storage.from("avatars").remove([avatarPath]);
      setAvatarUrl(""); setAvatarPath("");
      setProfileNotice("Profile picture removed.");
    }
    setProfileBusy(false);
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) { setAuthNotice("Supabase is not configured yet. Add the BRIX project URL and anon key to the deployment environment."); return; }
    setAuthBusy(true); setAuthNotice("");
    try {
      if (accountMode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email: authEmail.trim(), password: authPassword, options: { data: { display_name: displayName.trim() } } });
        if (error) throw error;
        if (data.session) { setAuthNotice("Account created. You are now signed in."); setPage("Home"); }
        else setAuthNotice("Account created. Check your email for a confirmation link, then return here to sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail.trim(), password: authPassword });
        if (error) throw error;
        setAuthNotice("Signed in successfully."); setPage("Home");
      }
    } catch (error) { setAuthNotice(error instanceof Error ? error.message : "Authentication failed. Please try again."); }
    finally { setAuthBusy(false); }
  }

  async function sendPasswordReset() {
    if (!supabase) { setAuthNotice("Supabase is not configured yet."); return; }
    if (!authEmail.trim()) { setAuthNotice("Enter your email address first."); return; }
    setAuthBusy(true); setAuthNotice("");
    const { error } = await supabase.auth.resetPasswordForEmail(authEmail.trim(), { redirectTo: window.location.origin + window.location.pathname });
    setAuthNotice(error ? error.message : "If an account exists for that email, a password reset link will be sent.");
    setAuthBusy(false);
  }

  async function signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) setAuthNotice(error.message);
    else { setPage("Home"); setAuthNotice("You have signed out."); }
  }
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");
  const [games, setGames] = useState<Game[]>(initialGames);
  const [xboxQuery, setXboxQuery] = useState("");
  const [localQuery, setLocalQuery] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [activeGame, setActiveGame] = useState<Game | null>(null);
  const [detailsGame, setDetailsGame] = useState<Game | null>(null);
  const [context, setContext] = useState<{ game: Game; x: number; y: number } | null>(null);

  const xboxGames = useMemo(() => games.filter(g => g.source === "xbox" && g.title.toLowerCase().includes(xboxQuery.toLowerCase())), [games, xboxQuery]);
  const localGames = useMemo(() => games.filter(g => g.source === "local" && g.title.toLowerCase().includes(localQuery.toLowerCase())), [games, localQuery]);
  const recentGames = recent.map(title => games.find(g => g.title === title)).filter((g): g is Game => Boolean(g));

  function launch(game: Game) {
    setRecent(current => [game.title, ...current.filter(title => title !== game.title)].slice(0, 8));
    setActiveGame(game);
    setContext(null);
  }

  function addFavorite(game: Game) {
    setFavorites(current => current.includes(game.title) ? current.filter(t => t !== game.title) : [...current, game.title]);
    setContext(null);
  }

  function removeLocal(game: Game) {
    setGames(current => current.filter(g => g.title !== game.title));
    setFavorites(current => current.filter(t => t !== game.title));
    setContext(null);
  }

  function changePage(next: Page) {
    setPage(next);
    setContext(null);
  }

  function continueAsGuest() {
    localStorage.setItem("brix-entry-choice", "guest");
    setShowWelcome(false);
    setPage("Home");
  }

  const pageTitle = page === "Xbox Cloud Gaming Library" ? "Xbox Cloud Gaming" : page === "Account" ? "BRIX Account" : page;
  const pageDescription = page === "Home" ? "Your games, ready when you are." : page === "Xbox Cloud Gaming Library" ? "Browse games available through Xbox Cloud Gaming." : page === "Local Library" ? "Your own collection of locally hosted and web games." : "Customize the BRIX experience.";

  function gameCard(game: Game, index: number) {
    return (
      <article className="game-card" key={game.title} onContextMenu={event => { event.preventDefault(); setContext({ game, x: Math.min(event.clientX, window.innerWidth - 230), y: Math.min(event.clientY, window.innerHeight - 190) }); }}>
        <button className={`game-art art-${game.title.toLowerCase().replaceAll(" ", "-")}`} onClick={() => launch(game)} aria-label={`Launch ${game.title}`}>
          <span className="art-index">{String(index + 1).padStart(2, "0")}</span>
          <Gamepad2 size={36} />
          <span className="art-category">{game.category}</span>
        </button>
        <div className="game-card-info">
          <button className="game-title-button" onClick={() => launch(game)}><strong>{game.title}</strong><small>{game.tag ?? game.category}</small></button>
          {game.source === "local" && favorites.includes(game.title) && <Star size={15} className="favorite-mark" fill="currentColor" />}
          <button className="icon-button" title="More options (right-click the artwork)" onClick={() => setContext({ game, x: Math.min(window.innerWidth - 230, 260), y: 160 })}><MoreHorizontal size={18} /></button>
        </div>
      </article>
    );
  }

  return (
    <main className={`brix-desktop theme-${theme}`}>
      <aside className={`sidebar-panel ${collapsed ? "collapsed" : ""}`}>
        <div className="brand-lockup">
          <div className="brand-mark">B</div>
          {!collapsed && <div><div className="brand-name">BRIX</div><div className="brand-caption">CLOUD GAMING</div></div>}
        </div>
        <div className="sidebar-label">{!collapsed && "YOUR SPACE"}</div>
        <nav className="nav-list" aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button className={`nav-item ${page === label ? "active" : ""}`} key={label} onClick={() => changePage(label)} title={collapsed ? label : undefined}>
              <Icon size={18} strokeWidth={1.8} />{!collapsed && <span>{label}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-theme">
          {!collapsed && <span className="sidebar-label">APPEARANCE</span>}
          <div className="theme-switcher">
            {([["light", Sun], ["dark", Moon], ["metallic", Layers3]] as const).map(([value, Icon]) => (
              <button key={value} className={theme === value ? "selected" : ""} onClick={() => setTheme(value)} title={`${value} theme`} aria-label={`${value} theme`}><Icon size={15}/></button>
            ))}
          </div>
        </div>
        <button className={`nav-item settings-nav ${page === "Settings" ? "active" : ""}`} onClick={() => changePage("Settings")} title={collapsed ? "Settings" : undefined}>
          <Settings size={18}/>{!collapsed && <span>Settings</span>}
        </button>
        <button className="collapse-button" onClick={() => setCollapsed(v => !v)} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? <PanelLeftOpen size={17}/> : <><PanelLeftClose size={17}/><span>Collapse sidebar</span></>}
        </button>
        {!collapsed && <div className="sidebar-footer">BRIX PREVIEW · 0.3.0</div>}
      </aside>

      <section className="workspace">
        <header className="toolbar">
          <div className="toolbar-title"><Gamepad2 size={18}/> <span>BRIX</span><ChevronRight size={13}/><span>{pageTitle}</span></div>
          <div className="toolbar-actions">
            <div className="accounts-menu-wrap">
              <button className="account-button accounts-trigger" aria-expanded={accountsOpen} onClick={() => setAccountsOpen(value => !value)}><span className="account-avatar">{avatarUrl ? <img src={avatarUrl} alt="" /> : (profileName || session?.user.email || "A").slice(0, 1).toUpperCase()}</span><span>Accounts</span><ChevronDown size={14}/></button>
              {accountsOpen && <div className="accounts-dropdown">
                <div className="accounts-dropdown-heading"><strong>Accounts</strong><button className="dropdown-close" onClick={() => setAccountsOpen(false)} aria-label="Close accounts menu"><X size={15}/></button></div>
                <button className="dropdown-account-row" onClick={() => { setAccountsOpen(false); changePage("Account"); }}><span className="dropdown-avatar">{avatarUrl ? <img src={avatarUrl} alt="" /> : (profileName || "A").slice(0,1).toUpperCase()}</span><span className="dropdown-account-copy"><strong>{profileName || (session ? "BRIX account" : "Guest")}</strong><small>{session ? session.user.email : "Not signed in"}</small></span><ChevronDown className="dropdown-row-chevron" size={14}/></button>
                {session && <div className="brix-code-row"><span>BRIX ID <strong>{brixId || "Loading…"}</strong></span><button title="Copy BRIX ID" onClick={() => { if (brixId) void navigator.clipboard.writeText(brixId); }}><Copy size={13}/></button></div>}
                <div className="dropdown-section-title"><Users size={14}/> FRIENDS <span>{friendships.filter(row => row.status === "accepted").length}</span></div>
                {session ? <>
                  <div className="friend-add-row"><input value={friendCodeInput} onChange={event => setFriendCodeInput(event.target.value)} placeholder="Enter BRIX friend code" aria-label="BRIX friend code"/><button onClick={addFriendByCode} disabled={friendBusy || !friendCodeInput.trim()} title="Send friend request"><UserPlus size={15}/></button></div>
                  {friendships.filter(row => row.status === "pending" && row.addressee_id === session.user.id).map(row => <div className="friend-dropdown-row" key={row.id}><span className="dropdown-avatar small">{row.profile?.avatar_url ? <img src={row.profile.avatar_url} alt=""/> : (row.profile?.display_name || "?").slice(0,1).toUpperCase()}</span><span className="friend-row-copy"><strong>{row.profile?.display_name || "BRIX player"}</strong><small>Wants to be your friend</small></span><button className="friend-accept" onClick={() => respondToFriendRequest(row.id,"accepted")} title="Accept"><Check size={14}/></button><button className="friend-remove" onClick={() => respondToFriendRequest(row.id,"declined")} title="Decline"><X size={14}/></button></div>)}
                  {friendships.filter(row => row.status === "accepted").map(row => <div className="friend-dropdown-row" key={row.id}><span className="dropdown-avatar small">{row.profile?.avatar_url ? <img src={row.profile.avatar_url} alt=""/> : (row.profile?.display_name || "?").slice(0,1).toUpperCase()}</span><span className="friend-row-copy"><strong>{row.profile?.display_name || "BRIX player"}</strong><small>{row.profile?.brix_id || "BRIX member"}</small></span><span className="platform-mini">BRIX</span>{row.profile?.microsoft_connected && <span className="platform-mini microsoft">MS</span>}<button className="friend-remove" onClick={() => removeFriend(row.id)} title="Remove friend"><X size={13}/></button></div>)}
                  {friendships.filter(row => row.status === "pending" && row.requester_id === session.user.id).map(row => <div className="friend-dropdown-row" key={row.id}><span className="dropdown-avatar small">?</span><span className="friend-row-copy"><strong>{row.profile?.display_name || "BRIX player"}</strong><small>Request sent</small></span><span className="platform-mini">PENDING</span><button className="friend-remove" onClick={() => removeFriend(row.id)} title="Cancel request"><X size={13}/></button></div>)}
                  {friendships.length === 0 && <p className="friends-empty">No friends yet. Add someone with their BRIX ID.</p>}
                </> : <p className="friends-empty">Sign in to add friends and see your friends list.</p>}
                {friendNotice && <p className="dropdown-notice" role="status">{friendNotice}</p>}
                <div className="dropdown-section-title"><Monitor size={14}/> LINKED PLATFORMS</div>
                <div className="platform-row"><span className="platform-dot brix-dot"/> BRIX <span className="platform-state">{session ? "Connected" : "Guest"}</span></div>
                <div className="platform-row"><span className="platform-dot microsoft-dot"/> Microsoft / Xbox <span className="platform-state">{microsoftConnected ? "Linked" : "Not linked"}</span></div>
                {session && !microsoftConnected && <button className="connect-platform-button" onClick={() => { setAccountsOpen(false); void connectMicrosoft(); }}>Connect Microsoft account</button>}
                {!session && <button className="connect-platform-button" onClick={() => { setAccountsOpen(false); changePage("Account"); }}>Sign in to BRIX</button>}
              </div>}
            </div>
            <div className="toolbar-status"><span className="status-light pending-light"/> Xbox streaming not connected</div>
          </div>
        </header>

        <div className="page-content">
          {page !== "Settings" && page !== "Account" && <div className="page-heading">
            <div><div className="eyebrow">BRIX / {page === "Home" ? "DASHBOARD" : page === "Local Library" ? "LOCAL COLLECTION" : "XBOX CLOUD"}</div><h1>{page === "Home" ? "Welcome back." : pageTitle}</h1><p>{pageDescription}</p></div>
          </div>}

          {page === "Home" && <>
            <section className="feature-window">
              <div className="feature-backdrop"><div className="feature-orb orb-one"/><div className="feature-orb orb-two"/></div>
              <div className="feature-content">
                <div className="feature-copy"><div className="eyebrow">FEATURED ON XBOX CLOUD</div><div className="feature-kicker">YOUR NEXT ADVENTURE</div><h2>Fortnite</h2><p>Drop in, explore, and play. Your next match is one click away.</p><button className="aqua-button primary" onClick={() => launch(games[0])}><Play size={15} fill="currentColor"/> Play now</button></div>
                <div className="feature-emblem"><Gamepad2 size={86}/><span>BRIX FEATURED</span></div>
              </div>
              <div className="feature-bottom"><span><span className="status-light pending-light"/> Cloud streaming setup required</span><span>FEATURED GAME <ChevronRight size={12}/></span></div>
            </section>
            <section className="home-section">
              <div className="section-heading"><div><div className="eyebrow">PICK UP WHERE YOU LEFT OFF</div><h2>Recently played</h2></div></div>
              {recentGames.length ? <div className="game-grid">{recentGames.map((g, i) => gameCard(g, i))}</div> : <div className="recent-empty"><Clock3 size={22}/><div><strong>No recent games yet</strong><span>Launch a game from either library and it will appear here.</span></div></div>}
            </section>
          </>}

          {page === "Xbox Cloud Gaming Library" && <>
            <div className="library-toolbar"><div className="library-count">{xboxGames.length} GAMES</div><div className="search-bar"><Search size={16}/><input value={xboxQuery} onChange={e => setXboxQuery(e.target.value)} placeholder="Search Xbox games..." aria-label="Search Xbox Cloud Gaming library"/></div></div>
            <div className="game-grid">{xboxGames.map(gameCard)}{xboxGames.length === 0 && <div className="empty-state">No Xbox games match that search.</div>}</div>
          </>}

          {page === "Local Library" && <>
            <div className="library-toolbar"><div className="library-count">{localGames.length} GAMES · {favorites.length} FAVORITES</div><div className="search-bar"><Search size={16}/><input value={localQuery} onChange={e => setLocalQuery(e.target.value)} placeholder="Search local games..." aria-label="Search Local Library"/></div></div>
            {localGames.length ? <div className="game-grid">{localGames.map(gameCard)}</div> : <div className="local-empty"><Gamepad2 size={30}/><h2>Your Local Library is empty</h2><p>Add your own web games to the local library when you're ready.</p></div>}
          </>}


          {page === "Account" && <div className="account-screen">
            <div className="account-panel">
              <div className="account-brand"><div className="brand-mark">B</div><span>BRIX ACCOUNT</span></div>
              <h1>{session ? "Your account." : accountMode === "signin" ? "Welcome back." : "Create your account."}</h1>
              <p>{session ? `Signed in as ${session.user.email}.` : "Sign in to keep your BRIX experience together across devices."}</p>
              {!isSupabaseConfigured && <p className="auth-notice" role="status">Supabase setup is pending. The form will become active once the project URL and anon key are configured.</p>}
              {session && <div className="account-authenticated">
                <div className="platform-settings-card"><div><strong>Linked platforms</strong><small>Connect external accounts to your BRIX profile.</small></div><div className="platform-row"><span className="platform-dot microsoft-dot"/> Microsoft / Xbox <span className="platform-state">{microsoftConnected ? "Linked" : "Not linked"}</span></div>{!microsoftConnected && <button className="aqua-button" type="button" onClick={connectMicrosoft} disabled={authBusy}>{authBusy ? "Opening Microsoft…" : "Connect Microsoft account"}</button>}{authNotice && <p className="auth-notice" role="status">{authNotice}</p>}<small>Microsoft linking requires the Azure provider to be enabled in Supabase. This links your identity; Xbox Cloud Gaming streaming is a separate integration.</small></div><div className="profile-card">
                  <div className="profile-avatar-large">{avatarUrl ? <img src={avatarUrl} alt="Your profile picture" /> : <span>{(profileName || session.user.email || "A").slice(0, 1).toUpperCase()}</span>}</div>
                  <div className="profile-avatar-actions">
                    <button className="aqua-button" type="button" onClick={() => avatarInput.current?.click()} disabled={profileBusy}>{profileBusy ? "Please wait…" : avatarUrl ? "Change picture" : "Upload picture"}</button>
                    {avatarUrl && <button className="profile-remove" type="button" onClick={removeAvatar} disabled={profileBusy}>Remove</button>}
                    <small>PNG, JPEG, or WebP · 2 MB maximum</small>
                    <input ref={avatarInput} className="visually-hidden-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadAvatar} />
                  </div>
                </div>
                <form className="account-form profile-edit-form" onSubmit={saveProfile}>
                  <label>Display name<input type="text" value={profileName} onChange={e => setProfileName(e.target.value)} maxLength={40} required /></label>
                  <label>Email address<input type="email" value={session.user.email ?? ""} readOnly /></label>
                  <button className="aqua-button primary account-submit" type="submit" disabled={profileBusy}>{profileBusy ? "Saving…" : "Save profile"}</button>
                </form>
                {profileNotice && <p className="auth-notice" role="status">{profileNotice}</p>}
                <button className="aqua-button account-submit" type="button" onClick={signOut}>Sign out</button>
                <button className="back-link" onClick={() => changePage("Home")}><ArrowLeft size={14}/> Back to BRIX</button>
              </div>}
              {!session && <div className="account-unauthenticated">
              <div className="account-tabs"><button className={accountMode === "signin" ? "active" : ""} onClick={() => { setAccountMode("signin"); setAuthNotice(""); }}>Sign in</button><button className={accountMode === "signup" ? "active" : ""} onClick={() => { setAccountMode("signup"); setAuthNotice(""); }}>Create account</button></div>
              <form className="account-form" onSubmit={submitAuth}>
                {accountMode === "signup" && <label>Display name<input type="text" placeholder="How should BRIX address you?" autoComplete="nickname" value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={40}/></label>}
                <label>Email address<input type="email" placeholder="you@example.com" autoComplete="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} required/></label>
                <label>Password<input type="password" placeholder="Enter your password" autoComplete={accountMode === "signin" ? "current-password" : "new-password"} value={authPassword} onChange={e => setAuthPassword(e.target.value)} required minLength={8}/></label>
                <button className="aqua-button primary account-submit" type="submit" disabled={authBusy || authLoading || !isSupabaseConfigured}>{authBusy ? "Please wait…" : accountMode === "signin" ? "Sign in" : "Create account"}</button>
              </form>
              {accountMode === "signin" && <button className="back-link" type="button" onClick={sendPasswordReset} disabled={authBusy || !isSupabaseConfigured}>Forgot password?</button>}
              {authNotice && <p className="auth-notice" role="status">{authNotice}</p>}
              <button className="back-link" onClick={() => changePage("Home")}><ArrowLeft size={14}/> Back to BRIX</button>
              <p className="account-footnote">Use a unique password. BRIX never asks for your Xbox password.</p></div>}
            </div>
          </div>}

          {page === "Settings" && <>
            <div className="page-heading"><div><div className="eyebrow">BRIX / PREFERENCES</div><h1>Settings</h1><p>Customize the BRIX interface.</p></div></div>
            <div className="settings-layout">
              <section className="aqua-window"><div className="window-titlebar"><span>Appearance</span></div><div className="window-content"><h2>Interface theme</h2><p className="setting-description">Choose the visual style used throughout BRIX.</p><div className="theme-cards">
                {([["light", "Aqua Light", "Bright glass and classic Aqua gloss", Sun], ["dark", "Dark Aero", "PS3-inspired dark glass and blue light", Moon], ["metallic", "Metallic", "Longhorn Slate-inspired metal and glass", Layers3]] as const).map(([value, label, description, Icon]) => <button key={value} className={`theme-card ${theme === value ? "chosen" : ""}`} onClick={() => setTheme(value)}><span className="theme-preview"><Icon size={23}/></span><strong>{label}</strong><small>{description}</small>{theme === value && <span className="theme-check">ACTIVE</span>}</button>)}
              </div></div></section>
              <section className="aqua-window"><div className="window-titlebar"><span>Streaming status</span></div><div className="window-content"><h2>Xbox Cloud Gaming is not connected</h2><p className="setting-description">BRIX currently provides the interface and library prototype. Xbox sign-in, stream startup, and controller input have not been implemented yet. No connection settings are available until the streaming client exists.</p></div></section>
            </div>
          </>}

          <footer className="page-footer">BRIX is an independent interface project. Xbox sign-in and cloud streaming are not connected yet.</footer>
        </div>
      </section>


      {showWelcome && !authLoading && !session && <div className="welcome-scrim"><section className="welcome-dialog" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
        <div className="welcome-brand"><div className="brand-mark">B</div><span>BRIX</span></div>
        <div className="eyebrow">YOUR GAMES. YOUR SPACE.</div>
        <h1 id="welcome-title">Welcome to BRIX.</h1>
        <p>Sign in or create an account to get started, or continue as a guest.</p>
        <button className="aqua-button primary welcome-primary" onClick={() => { setShowWelcome(false); setPage("Account"); setAccountMode("signin"); }}>Sign in / Sign up</button>
        <button className="guest-button" onClick={continueAsGuest}>Continue as guest</button>
        <small>You can access the account screen later from the top bar.</small>
      </section></div>}

      {context && <><button className="context-dismiss" aria-label="Close game menu" onClick={() => setContext(null)}/><div className="game-context-menu" style={{ left: context.x, top: context.y }}><div className="context-title">{context.game.title}</div><button onClick={() => { setDetailsGame(context.game); setContext(null); }}><Info size={15}/> View details</button>{context.game.source === "local" && <button onClick={() => addFavorite(context.game)}><Star size={15}/> {favorites.includes(context.game.title) ? "Remove favorite" : "Add to favorites"}</button>}{context.game.source === "local" && <button className="danger-action" onClick={() => removeLocal(context.game)}><Trash2 size={15}/> Remove from library</button>}</div></>}

      {detailsGame && <div className="modal-scrim" onClick={() => setDetailsGame(null)}><section className="details-modal" onClick={e => e.stopPropagation()}><button className="modal-close" onClick={() => setDetailsGame(null)} aria-label="Close details"><X size={18}/></button><div className={`details-art art-${detailsGame.title.toLowerCase().replaceAll(" ", "-")}`}><Gamepad2 size={58}/></div><div className="details-body"><div className="eyebrow">GAME INFORMATION · {detailsGame.source === "xbox" ? "XBOX CLOUD" : "LOCAL"}</div><h2>{detailsGame.title}</h2><p>{detailsGame.description}</p><div className="details-facts"><span>GENRE<strong>{detailsGame.category}</strong></span><span>LIBRARY<strong>{detailsGame.source === "xbox" ? "Xbox Cloud Gaming" : "Local Library"}</strong></span><span>SCREENSHOTS<strong>Not added</strong></span></div><button className="aqua-button primary" onClick={() => { setDetailsGame(null); launch(detailsGame); }}><Play size={15} fill="currentColor"/> Launch game</button></div></section></div>}

      {activeGame && <div className="player-shell"><header className="player-toolbar"><button className="player-back" onClick={() => setActiveGame(null)}><ArrowLeft size={17}/> Back to BRIX</button><strong>{activeGame.title}</strong><span className="player-connection"><span className="status-light pending-light"/> Waiting for streaming connection</span><button className="player-close" onClick={() => setActiveGame(null)} aria-label="Exit game"><X size={18}/></button></header><div className="player-stage"><div className="player-glow"/><div className="player-message"><div className="player-game-icon"><Gamepad2 size={42}/></div><div className="eyebrow">BRIX GAME SESSION</div><h1>{activeGame.title}</h1><p>The game launch interface is ready. Xbox streaming or a local game runtime still needs to be connected.</p><div className="connection-pill"><Wifi size={14}/> Streaming connection unavailable</div><button className="aqua-button" onClick={() => setActiveGame(null)}>Return to library</button></div></div><footer className="player-footer"><span>BRIX PLAYER</span><span><Maximize2 size={13}/> FULLSCREEN SESSION PREVIEW</span></footer></div>}
    </main>
  );
}

export default App;
