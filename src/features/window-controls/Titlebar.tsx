import { useState } from "react";
import { appWindow } from "../../utils/window";
import { useSettingsStore } from "../../store/settingsStore";
import {
  useUIStore,
  WINDOW_MODE_LABEL,
  isOnTop,
  isThrough,
  type WindowMode,
} from "../../store/uiStore";
import type { ThemeMode } from "../../types/settings";
import { Gear, Lock, Maximize, Minus, Monitor, Moon, Pin, Restore, Sun, XIcon } from "../../components/ui/Icons";

const THEME_CYCLE: ThemeMode[] = ["system", "light", "dark"];

/**
 * Window control with four states, cycled by repeated clicks:
 *   正常窗口 → 置顶 → 置顶 · 鼠标穿透 → 鼠标穿透 → 正常窗口
 * The pin icon keeps its meaning; the two pass-through states add a small lock
 * badge in the icon's lower-left corner.
 */
function WindowModeIcon({ mode }: { mode: WindowMode }) {
  return (
    <span className="winmode-icon">
      {isOnTop(mode) ? <Pin size={13} /> : <WindowFrameIcon />}
      {isThrough(mode) && (
        <span className="winmode-lock">
          <Lock size={7} />
        </span>
      )}
    </span>
  );
}

/** The plain (not pinned) window glyph. */
function WindowFrameIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18" />
    </svg>
  );
}

export function Titlebar() {
  const theme = useSettingsStore((s) => s.global.theme);
  const updateGlobal = useSettingsStore((s) => s.updateGlobal);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  const windowMode = useUIStore((s) => s.windowMode);
  const cycleWindowMode = useUIStore((s) => s.cycleWindowMode);
  const showToast = useUIStore((s) => s.showToast);
  const [maximized, setMaximized] = useState(false);

  const cycleMode = () => {
    const next = cycleWindowMode();
    updateGlobal({ alwaysOnTop: isOnTop(next) });
    showToast(WINDOW_MODE_LABEL[next], 1600);
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
          <img src="/icons/icon.png" alt="Bili Monitor" width={15} height={15} className="app-logo" />
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
        <button
          className="titlebar-btn"
          title={`${WINDOW_MODE_LABEL[windowMode]}（点击切换）`}
          onClick={cycleMode}
          style={isOnTop(windowMode) || isThrough(windowMode) ? { color: "var(--accent)" } : undefined}
        >
          <WindowModeIcon mode={windowMode} />
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
