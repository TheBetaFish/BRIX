import { useMemo, useState } from "react";
import {
  Gamepad2, Home, Library, Search, Settings, SlidersHorizontal,
  Clock3, Play, Monitor, Bell
} from "lucide-react";
import { Slider } from "./components/ui/slider";

type Page = "Home" | "Library" | "Search" | "Recent" | "Settings";
const navigation = [
  { label: "Home" as Page, icon: Home },
  { label: "Library" as Page, icon: Library },
  { label: "Search" as Page, icon: Search },
  { label: "Recent" as Page, icon: Clock3 },
];
const games = [
  { title: "Fortnite", category: "Battle Royale", tag: "Featured" },
  { title: "Forza Horizon 5", category: "Racing" },
  { title: "Starfield", category: "RPG" },
  { title: "Halo Infinite", category: "Shooter" },
];

function App() {
  const [page, setPage] = useState<Page>("Library");
  const [query, setQuery] = useState("");
  const [volume, setVolume] = useState([68]);
  const [brightness, setBrightness] = useState([82]);
  const [notifications, setNotifications] = useState(true);
  const [hardwareAcceleration, setHardwareAcceleration] = useState(true);
  const [notice, setNotice] = useState("Welcome to BRIX Preview");
  const [lastPlayed, setLastPlayed] = useState<string[]>([]);

  const filteredGames = useMemo(
    () => games.filter((game) => `${game.title} ${game.category}`.toLowerCase().includes(query.toLowerCase())),
    [query]
  );

  function launchGame(title: string) {
    setLastPlayed((current) => [title, ...current.filter((item) => item !== title)].slice(0, 5));
    setNotice(`${title}: streaming is not connected yet. This button is wired for the future launch flow.`);
  }

  function goTo(next: Page) {
    setPage(next);
    setNotice(`${next} opened`);
  }

  const pageCopy: Record<Page, { eyebrow: string; title: string; description: string }> = {
    Home: { eyebrow: "BRIX / HOME", title: "Welcome back", description: "Your cloud gaming space." },
    Library: { eyebrow: "BRIX / COLLECTION", title: "Game library", description: "Browse games available to your BRIX collection." },
    Search: { eyebrow: "BRIX / DISCOVER", title: "Find a game", description: "Search your current game catalogue." },
    Recent: { eyebrow: "BRIX / HISTORY", title: "Recently played", description: "Your latest launch attempts appear here." },
    Settings: { eyebrow: "BRIX / PREFERENCES", title: "Settings", description: "Adjust the BRIX interface preferences." },
  };
  const copy = pageCopy[page];

  return (
    <main className="brix-desktop min-h-screen">
      <aside className="sidebar-panel">
        <div className="brand-lockup">
          <div className="brand-mark">B</div>
          <div><div className="brand-name">BRIX</div><div className="brand-caption">CLOUD GAMING</div></div>
        </div>
        <div className="sidebar-label">NAVIGATION</div>
        <nav className="nav-list" aria-label="Main navigation">
          {navigation.map(({ label, icon: Icon }) => (
            <button className={`nav-item ${page === label ? "active" : ""}`} key={label} onClick={() => goTo(label)}>
              <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <button className={`nav-item ${page === "Settings" ? "active" : ""}`} onClick={() => goTo("Settings")}>
          <Settings size={17} strokeWidth={1.8} /><span>Settings</span>
        </button>
        <div className="sidebar-footer">BRIX Preview 0.2.0</div>
      </aside>

      <section className="workspace">
        <header className="toolbar">
          <div className="toolbar-title"><Gamepad2 size={18} /> {page === "Settings" ? "Preferences" : "BRIX Cloud Gaming"}</div>
          <div className="toolbar-status"><span className="status-light pending-light" /> Preview · Streaming offline</div>
        </header>

        <div className="page-content">
          <div className="page-heading">
            <div><div className="eyebrow">{copy.eyebrow}</div><h1>{copy.title}</h1><p>{copy.description}</p></div>
            <div className="heading-icon"><SlidersHorizontal size={22} /></div>
          </div>

          {page === "Home" && (
            <section className="aqua-window feature-window">
              <div className="window-titlebar"><div className="traffic-lights"><i /><i /><i /></div><span>Featured game</span></div>
              <div className="feature-content">
                <div className="feature-art"><Gamepad2 size={58} /><span>BRIX FEATURED</span></div>
                <div className="feature-details"><div className="eyebrow">FEATURED TITLE</div><h2>Fortnite</h2><p>Drop in, explore, and play with friends.</p><button className="aqua-button primary" onClick={() => launchGame("Fortnite")}><Play size={15} fill="currentColor" /> Play game</button></div>
              </div>
            </section>
          )}

          {(page === "Library" || page === "Search") && (
            <>
              {page === "Search" && <div className="search-bar"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search games or genres..." aria-label="Search games" /><button className="aqua-button" onClick={() => setQuery("")}>Clear</button></div>}
              <div className="game-grid">
                {filteredGames.map((game) => (
                  <article className="game-card" key={game.title}>
                    <div className={`game-art art-${game.title.toLowerCase().replaceAll(" ", "-")}`}><Gamepad2 size={34} /><span>{game.category}</span></div>
                    <div className="game-card-info"><div><h2>{game.title}</h2><p>{game.tag ?? game.category}</p></div><button className="icon-button" aria-label={`Play ${game.title}`} title={`Play ${game.title}`} onClick={() => launchGame(game.title)}><Play size={16} fill="currentColor" /></button></div>
                  </article>
                ))}
                {filteredGames.length === 0 && <div className="empty-state">No games match “{query}”. Try another search.</div>}
              </div>
            </>
          )}

          {page === "Recent" && (
            <section className="aqua-window"><div className="window-titlebar"><div className="traffic-lights"><i /><i /><i /></div><span>Recent activity</span></div><div className="window-content">
              {lastPlayed.length ? lastPlayed.map((title) => <div className="recent-row" key={title}><Clock3 size={16} /><strong>{title}</strong><button className="aqua-button" onClick={() => launchGame(title)}>Try again</button></div>) : <div className="empty-state">No recent games yet. Open your Library and select a game.</div>}
            </div></section>
          )}

          {page === "Settings" && (
            <div className="playground-grid">
              <section className="aqua-window"><div className="window-titlebar"><div className="traffic-lights"><i /><i /><i /></div><span>Audio & display</span></div><div className="window-content">
                <div className="control-heading"><div><h2>Output volume</h2><p>Adjust the game audio level.</p></div><strong>{volume[0]}%</strong></div>
                <Slider value={volume} onValueChange={setVolume} max={100} step={1} aria-label="Output volume" />
                <div className="scale-labels"><span>Muted</span><span>Maximum</span></div><div className="control-divider" />
                <div className="control-heading"><div><h2>Display brightness</h2><p>Interface brightness preference.</p></div><strong>{brightness[0]}%</strong></div>
                <Slider value={brightness} onValueChange={setBrightness} max={100} step={1} aria-label="Display brightness" />
                <div className="scale-labels"><span>Dim</span><span>Bright</span></div>
              </div></section>
              <section className="aqua-window"><div className="window-titlebar"><div className="traffic-lights"><i /><i /><i /></div><span>Preferences</span></div><div className="window-content">
                <label className="setting-toggle"><span><Bell size={16} /><span><strong>Notifications</strong><small>Show interface notifications</small></span></span><input type="checkbox" checked={notifications} onChange={(e) => setNotifications(e.target.checked)} /></label>
                <div className="control-divider" />
                <label className="setting-toggle"><span><Monitor size={16} /><span><strong>Hardware acceleration</strong><small>Use GPU acceleration when supported</small></span></span><input type="checkbox" checked={hardwareAcceleration} onChange={(e) => setHardwareAcceleration(e.target.checked)} /></label>
                <div className="control-divider" /><div className="status-row"><span className="status-light pending-light" /> Xbox streaming connection not configured</div>
              </div></section>
            </div>
          )}

          <div className="notice-bar" role="status"><span>{notice}</span><button onClick={() => setNotice("BRIX Preview 0.2.0")} aria-label="Dismiss notification">×</button></div>
          <footer className="page-footer">BRIX is an independent interface project. Xbox sign-in and cloud streaming are not connected yet.</footer>
        </div>
      </section>
    </main>
  );
}

export default App;
