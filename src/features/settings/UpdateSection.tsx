import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useSettingsStore } from "../../store/settingsStore";
import { checkForUpdate, installUpdate, type UpdateInfo } from "../../services/updater";
import { DOWNLOAD_URL } from "../../config/app";

/** Update controls, plus a manual download path when the updater cannot run. */
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
        新版本会在这里提示并可以直接安装。安装只更新程序本身，订阅、备注、设置和 B 站登录状态都会保留。
      </div>

      <Row label="自动检查更新">
        <Switch on={autoCheck} onToggle={(v) => updateGlobal({ updateAutoCheck: v })} />
      </Row>
      <Row label="启动时检查一次">
        <Switch on={checkOnStart} onToggle={(v) => updateGlobal({ updateCheckOnStart: v })} />
      </Row>
      <Row label="软件下载地址">
        <button className="link-btn" onClick={() => void openUrl(DOWNLOAD_URL)}>
          {DOWNLOAD_URL.replace(/^https?:\/\//, "")}
        </button>
      </Row>

      <div className="flex items-center gap-2 mt-1">
        <button className="btn text-xs" disabled={status === "checking" || status === "downloading"} onClick={() => void check()}>
          {status === "checking" ? "正在检查…" : "检查更新"}
        </button>
        <button className="btn text-xs" title="在浏览器中打开下载页" onClick={() => void openUrl(DOWNLOAD_URL)}>
          手动下载
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
    <div className="settings-row py-1.5">
      <span className="settings-row-label text-[12.5px]" style={{ color: "var(--text-2)" }}>{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function Switch({ on, onToggle }: { on: boolean; onToggle: (v: boolean) => void }) {
  return <span className={`switch ${on ? "on" : ""}`} onClick={() => onToggle(!on)} />;
}
