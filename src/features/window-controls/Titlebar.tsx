import { useState } from "react";
import { appWindow, setAlwaysOnTop } from "../../utils/window";
import { useSettingsStore } from "../../store/settingsStore";
import { useUIStore } from "../../store/uiStore";

function Icon({ d }: { d: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  pin: "M12 17v5M5 3h14l-1 7 2 2-8 3-8-3 2-2-1-7z",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
  minimize: "M5 12h14",
  maximize: "M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3",
  restore: "M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3",
  close: "M18 6 6 18M6 6l12 12",
};

export function Titlebar() {
  const alwaysOnTop = useSettingsStore((s) => s.global.alwaysOnTop);
  const updateGlobal = useSettingsStore((s) => s.updateGlobal);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  const [maximized, setMaximized] = useState(false);

  const togglePin = () => {
    const next = !alwaysOnTop;
    updateGlobal({ alwaysOnTop: next });
    void setAlwaysOnTop(next);
  };

  const toggleMaximize = async () => {
    try {
      await appWindow.toggleMaximize();
      setMaximized(await appWindow.isMaximized());
    } catch {
      /* ignore */
    }
  };

  return (
    <header className="titlebar">
      <div className="drag-region" data-tauri-drag-region>
        <div className="flex items-center gap-2 no-drag" data-tauri-drag-region>
          <img src="/icons/icon.png" alt="" width={20} height={20} style={{ borderRadius: 5 }} />
          <span className="font-semibold text-[13px]" style={{ color: "var(--text)" }}>
            BiliUPMonitor
          </span>
        </div>
      </div>
      <button className="titlebar-btn" title="窗口置顶" onClick={togglePin} style={alwaysOnTop ? { color: "var(--accent)" } : undefined}>
        <Icon d={ICONS.pin} />
      </button>
      <button className="titlebar-btn" title="设置" onClick={() => setSettingsOpen(true)}>
        <Icon d={ICONS.settings} />
      </button>
      <button className="titlebar-btn" title="最小化" onClick={() => void appWindow.minimize()}>
        <Icon d={ICONS.minimize} />
      </button>
      <button className="titlebar-btn" title={maximized ? "还原" : "最大化"} onClick={() => void toggleMaximize()}>
        <Icon d={maximized ? ICONS.restore : ICONS.maximize} />
      </button>
      <button className="titlebar-btn close" title="关闭" onClick={() => void appWindow.close()}>
        <Icon d={ICONS.close} />
      </button>
    </header>
  );
}
