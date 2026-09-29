import { useState } from "react";
import { appWindow, setAlwaysOnTop } from "../../utils/window";
import { useSettingsStore } from "../../store/settingsStore";
import { useUIStore } from "../../store/uiStore";
import type { ThemeMode } from "../../types/settings";
import { Gear, Maximize, Minus, Monitor, Moon, Pin, Restore, Sun, XIcon } from "../../components/ui/Icons";

const THEME_CYCLE: ThemeMode[] = ["system", "light", "dark"];

export function Titlebar() {
  const alwaysOnTop = useSettingsStore((s) => s.global.alwaysOnTop);
  const updateGlobal = useSettingsStore((s) => s.updateGlobal);
  const theme = useSettingsStore((s) => s.global.theme);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  const [maximized, setMaximized] = useState(false);

  const togglePin = () => {
    const next = !alwaysOnTop;
    updateGlobal({ alwaysOnTop: next });
    void setAlwaysOnTop(next);
  };

  const cycleTheme = () => {
    const i = THEME_CYCLE.indexOf(theme);
    updateGlobal({ theme: THEME_CYCLE[(i + 1) % THEME_CYCLE.length] });
  };

  const toggleMaximize = async () => {
    try {
      await appWindow.toggleMaximize();
      setMaximized(await appWindow.isMaximized());
    } catch {
      /* ignore */
    }
  };

  const themeIcon = theme === "dark" ? <Moon size={13} /> : theme === "light" ? <Sun size={13} /> : <Monitor size={13} />;
  const themeTitle = theme === "dark" ? "夜间（点击切换）" : theme === "light" ? "日间（点击切换）" : "跟随系统（点击切换）";

  return (
    <header className="titlebar">
      <div className="drag-region" data-tauri-drag-region>
        <div className="flex items-center gap-1.5 no-drag" data-tauri-drag-region>
          <img src="/icons/icon.png" alt="" width={15} height={15} style={{ borderRadius: 3 }} />
          <span className="font-semibold text-[12px]" style={{ color: "var(--text)" }}>Bili Monitor</span>
          <button className="titlebar-btn" style={{ width: 22, height: 22 }} title={themeTitle} onClick={cycleTheme}>
            {themeIcon}
          </button>
          <button className="titlebar-btn" style={{ width: 22, height: 22 }} title="设置" onClick={() => setSettingsOpen(true)}>
            <Gear size={13} />
          </button>
        </div>
      </div>

      <div className="flex items-center no-drag">
        <button className="titlebar-btn" title="窗口置顶" onClick={togglePin} style={alwaysOnTop ? { color: "var(--accent)" } : undefined}>
          <Pin size={13} />
        </button>
        <button className="titlebar-btn" title="最小化" onClick={() => void appWindow.minimize()}>
          <Minus size={13} />
        </button>
        <button className="titlebar-btn" title={maximized ? "还原" : "最大化"} onClick={() => void toggleMaximize()}>
          {maximized ? <Restore size={13} /> : <Maximize size={13} />}
        </button>
        <button className="titlebar-btn close" title="关闭" onClick={() => void appWindow.close()}>
          <XIcon size={13} />
        </button>
      </div>
    </header>
  );
}
