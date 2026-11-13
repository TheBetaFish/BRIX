import { useMemo, useState } from "react";
import {
  Home, Cloud, Gamepad2, Settings, Search, PanelLeftClose, PanelLeftOpen,
  Play, Clock3, ChevronRight, MoreHorizontal, Star,
  Info, Trash2, X, Wifi, Maximize2, ArrowLeft, Sun, Moon,
  Layers3
} from "lucide-react";

type Page = "Home" | "Xbox Cloud Gaming Library" | "Local Library" | "Settings";
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

  const pageTitle = page === "Xbox Cloud Gaming Library" ? "Xbox Cloud Gaming" : page;
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
          <div className="toolbar-status"><span className="status-light pending-light"/> Xbox streaming not connected</div>
        </header>

        <div className="page-content">
          {page !== "Settings" && <div className="page-heading">
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

      {context && <><button className="context-dismiss" aria-label="Close game menu" onClick={() => setContext(null)}/><div className="game-context-menu" style={{ left: context.x, top: context.y }}><div className="context-title">{context.game.title}</div><button onClick={() => { setDetailsGame(context.game); setContext(null); }}><Info size={15}/> View details</button>{context.game.source === "local" && <button onClick={() => addFavorite(context.game)}><Star size={15}/> {favorites.includes(context.game.title) ? "Remove favorite" : "Add to favorites"}</button>}{context.game.source === "local" && <button className="danger-action" onClick={() => removeLocal(context.game)}><Trash2 size={15}/> Remove from library</button>}</div></>}

      {detailsGame && <div className="modal-scrim" onClick={() => setDetailsGame(null)}><section className="details-modal" onClick={e => e.stopPropagation()}><button className="modal-close" onClick={() => setDetailsGame(null)} aria-label="Close details"><X size={18}/></button><div className={`details-art art-${detailsGame.title.toLowerCase().replaceAll(" ", "-")}`}><Gamepad2 size={58}/></div><div className="details-body"><div className="eyebrow">GAME INFORMATION · {detailsGame.source === "xbox" ? "XBOX CLOUD" : "LOCAL"}</div><h2>{detailsGame.title}</h2><p>{detailsGame.description}</p><div className="details-facts"><span>GENRE<strong>{detailsGame.category}</strong></span><span>LIBRARY<strong>{detailsGame.source === "xbox" ? "Xbox Cloud Gaming" : "Local Library"}</strong></span><span>SCREENSHOTS<strong>Not added</strong></span></div><button className="aqua-button primary" onClick={() => { setDetailsGame(null); launch(detailsGame); }}><Play size={15} fill="currentColor"/> Launch game</button></div></section></div>}

      {activeGame && <div className="player-shell"><header className="player-toolbar"><button className="player-back" onClick={() => setActiveGame(null)}><ArrowLeft size={17}/> Back to BRIX</button><strong>{activeGame.title}</strong><span className="player-connection"><span className="status-light pending-light"/> Waiting for streaming connection</span><button className="player-close" onClick={() => setActiveGame(null)} aria-label="Exit game"><X size={18}/></button></header><div className="player-stage"><div className="player-glow"/><div className="player-message"><div className="player-game-icon"><Gamepad2 size={42}/></div><div className="eyebrow">BRIX GAME SESSION</div><h1>{activeGame.title}</h1><p>The game launch interface is ready. Xbox streaming or a local game runtime still needs to be connected.</p><div className="connection-pill"><Wifi size={14}/> Streaming connection unavailable</div><button className="aqua-button" onClick={() => setActiveGame(null)}>Return to library</button></div></div><footer className="player-footer"><span>BRIX PLAYER</span><span><Maximize2 size={13}/> FULLSCREEN SESSION PREVIEW</span></footer></div>}
    </main>
  );
}

export default App;
