import { useState } from "react";
import { useSettingsStore } from "../../store/settingsStore";
import { checkForUpdate, installUpdate, type UpdateInfo } from "../../services/updater";

/**
 * Update controls. The app never touches user data during an update: the
 * database, settings, credential and caches all live under %APPDATA% and the
 * installer only replaces program files.
 */
export function UpdateSection() {
  const autoCheck = useSettingsStore((s) => s.global.updateAutoCheck);
  const checkOnStart = useSettingsStore((s) => s.global.updateCheckOnStart);
  const updateGlobal = useSettingsStore((s) => s.updateGlobal);

  const [status, setStatus] = useState<"idle" | "checking" | "found" | "none" | "error" | "downloading">("idle");
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const check = async () => {
    setStatus("checking");
    setError(null);
    setInfo(null);
    try {
      const found = await checkForUpdate();
      if (found) {
        setInfo(found);
        setStatus("found");
      } else {
        setStatus("none");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "检查更新失败");
      setStatus("error");
    }
  };

  const install = async () => {
    if (!info) return;
    setStatus("downloading");
    setProgress(0);
    try {
      await installUpdate(info, (p) => setProgress(p));
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新失败");
      setStatus("error");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="text-[12px] leading-relaxed" style={{ color: "var(--text-2)" }}>
        更新通过 GitHub Releases 分发。安装包只替换程序文件，订阅、备注、设置、历史增长、B 站登录与缓存都不会被清空。
      </div>

      <Row label="自动检查更新">
        <Switch on={autoCheck} onToggle={(v) => updateGlobal({ updateAutoCheck: v })} />
      </Row>
      <Row label="启动时静默检查一次">
        <Switch on={checkOnStart} onToggle={(v) => updateGlobal({ updateCheckOnStart: v })} />
      </Row>

      <div className="flex items-center gap-2 mt-1">
        <button className="btn text-xs" disabled={status === "checking" || status === "downloading"} onClick={() => void check()}>
          {status === "checking" ? "正在检查…" : "手动检查更新"}
        </button>
        {status === "none" && <span className="text-[12px]" style={{ color: "var(--text-3)" }}>已是最新版本</span>}
        {status === "error" && <span className="text-[12px]" style={{ color: "#e5484d" }}>{error}</span>}
      </div>

      {status === "found" && info && (
        <div className="p-3 rounded-lg flex flex-col gap-2" style={{ background: "var(--surface-2)", border: "1px solid var(--accent-ring)" }}>
          <div className="text-[12.5px]" style={{ color: "var(--text)" }}>
            发现新版本 <b style={{ color: "var(--accent)" }}>{info.version}</b>
          </div>
          {info.notes && (
            <pre className="text-[11.5px] whitespace-pre-wrap max-h-40 overflow-y-auto m-0" style={{ color: "var(--text-2)" }}>
              {info.notes}
            </pre>
          )}
          <div className="flex items-center gap-2">
            <button className="btn btn-primary text-xs" onClick={() => void install()}>下载并安装</button>
            <span className="text-[11px]" style={{ color: "var(--text-3)" }}>安装完成后程序会自动重启</span>
          </div>
        </div>
      )}

      {status === "downloading" && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
            <div className="h-full rounded-full" style={{ width: `${progress}%`, background: "var(--accent)", transition: "width .2s ease" }} />
          </div>
          <span className="text-[11px] w-10 text-right" style={{ color: "var(--text-3)" }}>{progress}%</span>
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 gap-3">
      <span className="text-[12.5px]" style={{ color: "var(--text-2)" }}>{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function Switch({ on, onToggle }: { on: boolean; onToggle: (v: boolean) => void }) {
  return <span className={`switch ${on ? "on" : ""}`} onClick={() => onToggle(!on)} />;
}
