import { useUIStore } from "../../store/uiStore";
import { useSettingsStore } from "../../store/settingsStore";
import { useSubscriptions } from "../../queries/subscriptions";
import { setAlwaysOnTop } from "../../utils/window";
import { FIELD_LABELS, type FieldVisibility, type GlobalSettings, type ThemeMode } from "../../types/settings";
import { useUpdateSubscription } from "../../queries/subscriptions";
import { AccountSection } from "./AccountSection";

const FIELD_GROUPS: { title: string; keys: (keyof FieldVisibility)[] }[] = [
  { title: "名片基础", keys: ["banner", "avatar", "name", "uid", "sign"] },
  { title: "身份状态", keys: ["level", "vip", "official", "pendant", "nameplate", "fansMedal", "decoration"] },
  { title: "统计", keys: ["following", "follower", "likes", "totalViews", "videoCount"] },
  { title: "视频数据", keys: ["videoView", "videoLike", "videoCoin", "videoOnline"] },
  { title: "增长", keys: ["growthDay", "growthWeek", "growthMonth"] },
];

export function SettingsPanel() {
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  const tab = useUIStore((s) => s.settingsTab);
  const setSettingsTab = useUIStore((s) => s.setSettingsTab);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.35)" }}
      onClick={() => setSettingsOpen(false)}
    >
      <div
        className="card w-[640px] max-w-[92vw] max-h-[86vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "var(--line)" }}>
          <div className="flex items-center gap-3">
            <span className="font-semibold" style={{ color: "var(--text)" }}>
              设置
            </span>
            <div className="flex items-center gap-1">
              <TabBtn active={tab === "global"} onClick={() => setSettingsTab("global")}>
                全局默认
              </TabBtn>
              <TabBtn active={tab === "perUser"} onClick={() => setSettingsTab("perUser")}>
                当前 UP 主
              </TabBtn>
            </div>
          </div>
          <button className="titlebar-btn" onClick={() => setSettingsOpen(false)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === "global" ? <GlobalSettings /> : <PerUserSettings />}
        </div>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      className="px-2.5 py-1 rounded-md text-xs"
      style={{
        background: active ? "var(--accent-soft)" : "transparent",
        color: active ? "var(--accent)" : "var(--text-2)",
      }}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function GlobalSettings() {
  const global = useSettingsStore((s) => s.global);
  const updateGlobal = useSettingsStore((s) => s.updateGlobal);
  const updateField = useSettingsStore((s) => s.updateField);

  return (
    <div className="flex flex-col gap-5">
      <Section title="基础">
        <Row label="默认视频条数">
          <select
            value={[10, 20, 30, 50].includes(global.videoLimit) ? global.videoLimit : 0}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (n > 0) updateGlobal({ videoLimit: n });
            }}
          >
            {[10, 20, 30, 50].map((n) => (
              <option key={n} value={n}>
                {n} 条
              </option>
            ))}
            {![10, 20, 30, 50].includes(global.videoLimit) && (
              <option value={0}>
                自定义 ({global.videoLimit})
              </option>
            )}
          </select>
          <input
            type="number"
            min={5}
            max={100}
            className="w-20"
            placeholder="自定义"
            title="自定义条数（5-100）"
            onBlur={(e) => {
              const n = Math.round(Number(e.target.value));
              if (Number.isFinite(n)) updateGlobal({ videoLimit: Math.min(100, Math.max(5, n)) });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </Row>
        <Row label="主题">
          <select
            value={global.theme}
            onChange={(e) => updateGlobal({ theme: e.target.value as ThemeMode })}
          >
            <option value="system">跟随系统</option>
            <option value="light">日间</option>
            <option value="dark">夜间</option>
          </select>
        </Row>
        <Row label={`界面透明度（${global.opacity}%）`}>
          <input
            type="range"
            min={60}
            max={100}
            value={global.opacity}
            onChange={(e) => updateGlobal({ opacity: Number(e.target.value) })}
            className="flex-1"
          />
        </Row>
        <Row label="窗口置顶">
          <Switch
            on={global.alwaysOnTop}
            onToggle={(v) => {
              updateGlobal({ alwaysOnTop: v });
              void setAlwaysOnTop(v);
            }}
          />
        </Row>
        <Row label="关闭按钮行为">
          <select
            value={global.closeToTray ? "tray" : "quit"}
            onChange={(e) => updateGlobal({ closeToTray: e.target.value === "tray" })}
          >
            <option value="tray">关闭到系统托盘</option>
            <option value="quit">直接退出程序</option>
          </select>
        </Row>
      </Section>

      <Section title="字段显示（全局默认）">
        {FIELD_GROUPS.map((g) => (
          <div key={g.title} className="mb-3">
            <div className="text-xs mb-1.5" style={{ color: "var(--text-3)" }}>
              {g.title}
            </div>
            <div className="grid grid-cols-3 gap-x-4 gap-y-2">
              {g.keys.map((k) => (
                <FieldToggle
                  key={k}
                  label={FIELD_LABELS[k]}
                  on={global.fields[k]}
                  onToggle={(v) => updateField(k, v)}
                />
              ))}
            </div>
          </div>
        ))}
      </Section>

      <Section title="B 站账号（可选）">
        <AccountSection />
      </Section>
    </div>
  );
}

function PerUserSettings() {
  const selectedMid = useUIStore((s) => s.selectedMid);
  const { data: subs } = useSubscriptions();
  const global = useSettingsStore((s) => s.global);
  const perUser = useSettingsStore((s) => s.perUser);
  const setPerUser = useSettingsStore((s) => s.setPerUser);
  const clearPerUser = useSettingsStore((s) => s.clearPerUser);
  const updateSub = useUpdateSubscription();

  if (selectedMid == null) {
    return (
      <div className="text-sm py-10 text-center" style={{ color: "var(--text-3)" }}>
        请先在左侧选择一个 UP 主
      </div>
    );
  }

  const sub = subs?.find((s) => s.mid === selectedMid);
  const local = perUser[selectedMid] ?? {};
  const fields = { ...global.fields, ...(local.fields ?? {}) };
  const limit = local.videoLimit ?? global.videoLimit;

  const setLimit = (videoLimit: number) => {
    setPerUser(selectedMid, { ...local, videoLimit });
    void updateSub.mutateAsync({ mid: selectedMid, patch: { videoLimit } });
  };

  const toggleField = (k: keyof FieldVisibility, v: boolean) => {
    setPerUser(selectedMid, { ...local, fields: { ...(local.fields ?? {}), [k]: v } });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="text-sm" style={{ color: "var(--text-2)" }}>
        正在为「{sub?.name || selectedMid}」设置独立覆盖项（未覆盖的项沿用全局默认）
      </div>

      <Section title="基础">
        <Row label="视频条数（覆盖全局）">
          <select
            value={[10, 20, 30, 50].includes(limit) ? limit : 0}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (n > 0) setLimit(n);
            }}
          >
            {[10, 20, 30, 50].map((n) => (
              <option key={n} value={n}>
                {n} 条
              </option>
            ))}
            {![10, 20, 30, 50].includes(limit) && <option value={0}>自定义 ({limit})</option>}
          </select>
          <input
            type="number"
            min={5}
            max={100}
            className="w-20"
            placeholder="自定义"
            title="自定义条数（5-100）"
            onBlur={(e) => {
              const n = Math.round(Number(e.target.value));
              if (Number.isFinite(n)) setLimit(Math.min(100, Math.max(5, n)));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </Row>
      </Section>

      <Section title="字段覆盖">
        {FIELD_GROUPS.map((g) => (
          <div key={g.title} className="mb-3">
            <div className="text-xs mb-1.5" style={{ color: "var(--text-3)" }}>
              {g.title}
            </div>
            <div className="grid grid-cols-3 gap-x-4 gap-y-2">
              {g.keys.map((k) => (
                <FieldToggle key={k} label={FIELD_LABELS[k]} on={fields[k]} onToggle={(v) => toggleField(k, v)} />
              ))}
            </div>
          </div>
        ))}
      </Section>

      <button
        className="btn"
        onClick={() => {
          clearPerUser(selectedMid);
          void updateSub.mutateAsync({ mid: selectedMid, patch: { videoLimit: global.videoLimit } });
        }}
      >
        恢复为全局默认
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[13px] font-medium mb-2" style={{ color: "var(--text)" }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[13px]" style={{ color: "var(--text-2)" }}>
        {label}
      </span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function FieldToggle({ label, on, onToggle }: { label: string; on: boolean; onToggle: (v: boolean) => void }) {
  return (
    <button className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text)" }} onClick={() => onToggle(!on)}>
      <Switch on={on} onToggle={onToggle} />
      <span className="truncate">{label}</span>
    </button>
  );
}

function Switch({ on, onToggle }: { on: boolean; onToggle: (v: boolean) => void }) {
  return <span className={`switch ${on ? "on" : ""}`} onClick={() => onToggle(!on)} />;
}

export type { GlobalSettings };
