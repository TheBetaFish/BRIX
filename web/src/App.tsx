import { useState } from "react";
import { Gamepad2, Home, Library, Search, Settings, SlidersHorizontal } from "lucide-react";

import { Slider } from "./components/ui/slider";

const navigation = [
  { label: "Home", icon: Home },
  { label: "Library", icon: Library },
  { label: "Search", icon: Search },
];

function App() {
  const [volume, setVolume] = useState([68]);
  const [brightness, setBrightness] = useState([82]);

  return (
    <main className="brix-desktop min-h-screen">
      <aside className="sidebar-panel">
        <div className="brand-lockup">
          <div className="brand-mark">B</div>
          <div>
            <div className="brand-name">BRIX</div>
            <div className="brand-caption">CLOUD GAMING</div>
          </div>
        </div>

        <div className="sidebar-label">NAVIGATION</div>
        <nav className="nav-list" aria-label="Main navigation">
          {navigation.map(({ label, icon: Icon }) => (
            <button className={`nav-item ${label === "Library" ? "active" : ""}`} key={label}>
              <Icon size={17} strokeWidth={1.8} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />
        <button className="nav-item">
          <Settings size={17} strokeWidth={1.8} />
          <span>Settings</span>
        </button>
        <div className="sidebar-footer">BRIX Preview 0.1.0</div>
      </aside>

      <section className="workspace">
        <header className="toolbar">
          <div className="toolbar-title"><Gamepad2 size={18} /> Component Playground</div>
          <div className="toolbar-status"><span className="status-light" /> Interface preview</div>
        </header>

        <div className="page-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">BRIX / DESIGN SYSTEM</div>
              <h1>Aqua controls</h1>
              <p>Testing the classic Mac OS X Aqua component style.</p>
            </div>
            <div className="heading-icon"><SlidersHorizontal size={22} /></div>
          </div>

          <div className="playground-grid">
            <section className="aqua-window">
              <div className="window-titlebar">
                <div className="traffic-lights"><i /><i /><i /></div>
                <span>Audio settings</span>
                <span className="window-titlebar-end">BRIX</span>
              </div>
              <div className="window-content">
                <div className="control-heading">
                  <div>
                    <h2>Output volume</h2>
                    <p>Adjust the game audio level.</p>
                  </div>
                  <strong>{volume[0]}%</strong>
                </div>
                <Slider value={volume} onValueChange={setVolume} max={100} step={1} aria-label="Output volume" />
                <div className="scale-labels"><span>Muted</span><span>Maximum</span></div>

                <div className="control-divider" />

                <div className="control-heading">
                  <div>
                    <h2>Display brightness</h2>
                    <p>Preview of a second Aqua slider.</p>
                  </div>
                  <strong>{brightness[0]}%</strong>
                </div>
                <Slider value={brightness} onValueChange={setBrightness} max={100} step={1} aria-label="Display brightness" />
                <div className="scale-labels"><span>Dim</span><span>Bright</span></div>
              </div>
            </section>

            <section className="aqua-window notes-window">
              <div className="window-titlebar">
                <div className="traffic-lights"><i /><i /><i /></div>
                <span>Component status</span>
              </div>
              <div className="window-content">
                <div className="status-row"><span className="status-light" /> React frontend scaffolded</div>
                <div className="status-row"><span className="status-light" /> Aqua slider integrated</div>
                <div className="status-row pending"><span className="status-light" /> Streaming not connected</div>
                <div className="control-divider" />
                <h2>Next components</h2>
                <ul className="component-list">
                  <li>Aqua gel buttons</li>
                  <li>Switches and checkboxes</li>
                  <li>Tabs, dialogs, and selectors</li>
                  <li>Brushed-metal application panels</li>
                </ul>
              </div>
            </section>
          </div>

          <footer className="page-footer">Aqua design reference: igorfelipeduca/aqua · BRIX is an independent project.</footer>
        </div>
      </section>
    </main>
  );
}

export default App;
