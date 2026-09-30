import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useUIStore } from "../../store/uiStore";
import { useSettingsStore } from "../../store/settingsStore";
import { useSubscriptions } from "../../queries/subscriptions";
import { setAlwaysOnTop } from "../../utils/window";
import { setRemark } from "../../services/database/subscriptions";
import {
  DEFAULT_SETTINGS,
  DEFAULT_VIDEO_FIELD_ORDER,
  type FieldVisibility,
  type GlobalSettings,
  type PerUserSettings,
  type VideoFieldKey,
} from "../../types/settings";
import { AccountSection } from "./AccountSection";
import { UpdateSection } from "./UpdateSection";
import { PreviewCard } from "./PreviewCard";
import { VideoPreview } from "./VideoPreview";
import { ChevronDown, XIcon } from "../../components/ui/Icons";

type Category = "appearance" | "subs" | "card" | "video" | "data" | "system";

const CATEGORIES: { id: Category; label: string; tabs: string[] }[] = [
  { id: "appearance", label: "外观", tabs: ["主题与窗口", "布局"] },
  { id: "subs", label: "订阅", tabs: ["订阅列表", "默认值"] },
  { id: "card", label: "用户名片", tabs: ["显示项", "当前 UP 覆盖"] },
  { id: "video", label: "视频", tabs: ["字段与顺序", "当前 UP 覆盖"] },
  { id: "data", label: "数据", tabs: ["刷新与增长", "缓存"] },
  { id: "system", label: "系统", tabs: ["B 站账号", "自动更新", "关于"] },
];

export function SettingsPanel() {
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  const [category, setCategory] = useState<Category>("appearance");
  const [tabIndex, setTabIndex] = useState(0);
  const original = useRef<{ global: GlobalSettings; perUser: Record<number, PerUserSettings> } | null>(null);

  // Snapshot on open so the live preview can be rolled back by 取消; 保存 keeps it.
  useEffect(() => {
    const s = useSettingsStore.getState();
    original.current = { global: s.global, perUser: s.perUser };
  }, []);

  const cancel = () => {
    const snap = original.current;
    if (snap) {
      useSettingsStore.setState({ global: snap.global, perUser: snap.perUser });
      void import("../../services/database/settings").then(({ setSetting }) => {
        void setSetting("global_settings_v1", snap.global);
        void setSetting("per_user_settings_v1", snap.perUser);
      });
    }
    setSettingsOpen(false);
  };

  const cat = CATEGORIES.find((c) => c.id === category)!;
  const tab = cat.tabs[Math.min(tabIndex, cat.tabs.length - 1)];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.35)" }}
      onClick={cancel}
    >
      <div
        className="card w-[720px] max-w-[94vw] max-h-[88vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "var(--line)" }}>
          <span className="font-semibold" style={{ color: "var(--text)" }}>设置</span>
          <button className="titlebar-btn" onClick={cancel}><XIcon size={14} /></button>
        </div>

        <div className="flex-1 min-h-0 flex">
          {/* level 1: categories */}
          <nav className="w-[132px] flex-none border-r py-2 flex flex-col gap-0.5" style={{ borderColor: "var(--line)" }}>
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                className="text-left px-4 py-2 text-[13px] rounded-md mx-1.5 transition-colors"
                style={{
                  background: category === c.id ? "var(--accent-soft)" : "transparent",
                  color: category === c.id ? "var(--accent)" : "var(--text-2)",
                }}
                onClick={() => {
                  setCategory(c.id);
                  setTabIndex(0);
                }}
              >
                {c.label}
              </button>
            ))}
          </nav>

          {/* level 2 + 3 */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex items-center gap-1 px-4 pt-3">
              {cat.tabs.map((t, i) => (
                <button
                  key={t}
                  className="px-2.5 py-1 rounded-md text-xs"
                  style={{
                    background: tab === t ? "var(--accent-soft)" : "transparent",
                    color: tab === t ? "var(--accent)" : "var(--text-2)",
                  }}
                  onClick={() => setTabIndex(i)}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3">
              <CategoryBody category={category} tab={tab} />
            </div>
          </div>
        </div>

        {/* fixed footer: destructive on the left */}
        <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: "var(--line)" }}>
          <button
            className="btn text-xs"
            onClick={() => useSettingsStore.getState().updateGlobal({ ...DEFAULT_SETTINGS })}
          >
            恢复默认
          </button>
          <div className="flex items-center gap-2">
            <button className="btn text-xs" onClick={cancel}>取消</button>
            <button className="btn btn-primary text-xs" onClick={() => setSettingsOpen(false)}>保存并退出</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function CategoryBody({ category, tab }: { category: Category; tab: string }) {
  const global = useSettingsStore((s) => s.global);
  const perUserAll = useSettingsStore((s) => s.perUser);
  const updateGlobal = useSettingsStore((s) => s.updateGlobal);
  const updateField = useSettingsStore((s) => s.updateField);
  const selectedMid = useUIStore((s) => s.selectedMid);
  const { data: subs } = useSubscriptions();

  switch (category) {
    case "appearance":
      return tab === "主题与窗口" ? (
        <Sections>
          <Section title="主题" open>
            <Row label="主题模式">
              <select value={global.theme} onChange={(e) => updateGlobal({ theme: e.target.value as GlobalSettings["theme"] })}>
                <option value="system">跟随系统</option>
                <option value="light">日间</option>
                <option value="dark">夜间</option>
              </select>
            </Row>
            <Row label={`界面透明度（${global.opacity}%）`}>
              <input type="range" min={60} max={100} value={global.opacity}
                onChange={(e) => updateGlobal({ opacity: Number(e.target.value) })} className="w-48" />
            </Row>
          </Section>
          <Section title="窗口" open>
            <Row label="窗口置顶">
              <Switch on={global.alwaysOnTop} onToggle={(v) => { updateGlobal({ alwaysOnTop: v }); void setAlwaysOnTop(v); }} />
            </Row>
            <Row label="关闭按钮行为">
              <select value={global.closeToTray ? "tray" : "quit"} onChange={(e) => updateGlobal({ closeToTray: e.target.value === "tray" })}>
                <option value="tray">关闭到系统托盘</option>
                <option value="quit">直接退出程序</option>
              </select>
            </Row>
          </Section>
        </Sections>
      ) : (
        <Sections>
          <Section title="侧栏" open>
            <Row label={`侧栏宽度（${global.sidebarWidth}px）`}>
              <input type="range" min={140} max={260} value={global.sidebarWidth}
                onChange={(e) => updateGlobal({ sidebarWidth: Number(e.target.value) })} className="w-48" />
            </Row>
            <div className="text-[11px] mt-1" style={{ color: "var(--text-3)" }}>
              也可以直接拖动侧栏右侧的分隔线调整宽度。
            </div>
          </Section>
          <Section title="名片与提醒" open>
            <Row label="名片默认折叠">
              <Switch on={global.profileCollapsed} onToggle={(v) => updateGlobal({ profileCollapsed: v })} />
            </Row>
            <Row label="新投稿标记（粉点）">
              <Switch on={global.newPostBadge} onToggle={(v) => updateGlobal({ newPostBadge: v })} />
            </Row>
          </Section>
        </Sections>
      );

    case "subs":
      return tab === "订阅列表" ? (
        <Sections>
          <Section title="已订阅（拖动侧栏头像可排序）" open>
            <div className="flex flex-col gap-1">
              {(subs ?? []).map((s) => (
                <div key={s.mid} className="flex items-center gap-2">
                  <span className="w-32 shrink-0 truncate text-[12px]" style={{ color: "var(--text)" }}>{s.name || `UID ${s.mid}`}</span>
                  <input
                    className="flex-1 min-w-0 text-[12px]"
                    placeholder="备注名（留空则显示原用户名）"
                    defaultValue={s.remark ?? ""}
                    onBlur={(e) => void setRemark(s.mid, e.target.value).then(() => void 0)}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                  />
                </div>
              ))}
              {(subs ?? []).length === 0 && <div className="text-[12px]" style={{ color: "var(--text-3)" }}>还没有订阅</div>}
            </div>
          </Section>
        </Sections>
      ) : (
        <Sections>
          <Section title="默认视频条数" open>
            <Row label="每个 UP 的投稿条数（5–100）">
              <input
                type="number" min={5} max={100} className="w-24"
                value={global.videoLimit}
                onChange={(e) => {
                  const n = Math.round(Number(e.target.value));
                  if (Number.isFinite(n)) updateGlobal({ videoLimit: Math.min(100, Math.max(5, n)) });
                }}
              />
            </Row>
          </Section>
        </Sections>
      );

    case "card": {
      const targetMid = selectedMid;
      const perUser = targetMid != null ? perUserAll[targetMid]?.fields : undefined;
      const effective = tab === "当前 UP 覆盖" && perUser ? { ...global.fields, ...perUser } : global.fields;
      return (
        <Sections>
          <Section title={tab === "当前 UP 覆盖" ? "点击预览里的元素开关字段（仅覆盖当前 UP）" : "点击预览里的元素开关字段"} open>
            {tab === "当前 UP 覆盖" && targetMid == null && (
              <div className="text-[12px] mb-2" style={{ color: "var(--text-3)" }}>请先在侧栏选择一个 UP 主</div>
            )}
            <PreviewCard
              fields={effective}
              onToggle={(k, v) => {
                if (tab === "当前 UP 覆盖" && targetMid != null) {
                  const store = useSettingsStore.getState();
                  store.setPerUser(targetMid, { ...store.perUser[targetMid], fields: { ...(store.perUser[targetMid]?.fields ?? {}), [k]: v } });
                } else {
                  updateField(k, v);
                }
              }}
            />
            {tab === "当前 UP 覆盖" && targetMid != null && (
              <>
                <RefreshUpSection mid={targetMid} />
                <button
                  className="btn text-xs mt-3"
                  onClick={() => useSettingsStore.getState().clearPerUser(targetMid)}
                >
                  清除该 UP 的全部覆盖
                </button>
              </>
            )}
          </Section>
        </Sections>
      );
    }

    case "video": {
      const targetMid = selectedMid;
      const perUser = targetMid != null ? perUserAll[targetMid]?.fields : undefined;
      const effective = tab === "当前 UP 覆盖" && perUser ? { ...global.fields, ...perUser } : global.fields;
      const applyField = (k: keyof FieldVisibility, v: boolean) => {
        if (tab === "当前 UP 覆盖" && targetMid != null) {
          const store = useSettingsStore.getState();
          store.setPerUser(targetMid, { ...store.perUser[targetMid], fields: { ...(store.perUser[targetMid]?.fields ?? {}), [k]: v } });
        } else {
          updateField(k, v);
        }
      };
      return (
        <Sections>
          <Section title="视频行预览" open>
            {tab === "当前 UP 覆盖" && targetMid == null && (
              <div className="text-[12px] mb-2" style={{ color: "var(--text-3)" }}>请先在侧栏选择一个 UP 主</div>
            )}
            <VideoPreview
              fields={effective}
              onToggle={applyField}
              order={global.videoFieldOrder}
              onOrder={(next: VideoFieldKey[]) => updateGlobal({ videoFieldOrder: next })}
              pinnedRight={global.videoPinnedRight}
              onPinnedRight={(k) => updateGlobal({ videoPinnedRight: k })}
            />
            {tab === "当前 UP 覆盖" && targetMid != null && <RefreshUpSection mid={targetMid} />}
            <button
              className="btn text-xs mt-3"
              onClick={() => updateGlobal({ videoFieldOrder: [...DEFAULT_VIDEO_FIELD_ORDER], videoPinnedRight: "pubdate" })}
            >
              恢复默认顺序
            </button>
          </Section>
        </Sections>
      );
    }

    case "data":
      return tab === "刷新与增长" ? (
        <Sections>
          <Section title="增长周期" open>
            <Row label="卡片上显示的增长">
              <select value={global.growthPeriod} onChange={(e) => updateGlobal({ growthPeriod: e.target.value as GlobalSettings["growthPeriod"] })}>
                <option value="day">日增长</option>
                <option value="week">周增长</option>
                <option value="month">月增长</option>
              </select>
            </Row>
            <Row label="增长胶囊显示（名片）">
              <Switch on={global.fields.growthDay} onToggle={(v) => { updateField("growthDay", v); updateField("growthWeek", v); updateField("growthMonth", v); }} />
            </Row>
          </Section>
          <Section title="刷新节奏" open>
            <div className="text-[12px] leading-relaxed" style={{ color: "var(--text-2)" }}>
              前台选中 UP：资料 15 分钟、视频统计 5 分钟、在线人数 60 秒。<br />
              后台 UP：资料 30 分钟、视频统计 15 分钟，在线人数不轮询。<br />
              窗口隐藏到托盘后自动降低频率。
            </div>
          </Section>
        </Sections>
      ) : (
        <Sections>
          <Section title="缓存" open>
            <div className="text-[12px] mb-2" style={{ color: "var(--text-2)" }}>
              头像 / Banner / 挂件 / 装扮图都缓存在本机，缓存失败时不会覆盖已成功的文件。
            </div>
            <div className="flex flex-col gap-1">
              {(subs ?? []).map((s) => (
                <Row key={s.mid} label={s.name || `UID ${s.mid}`}>
                  <button
                    className="btn text-[11px] px-2 py-1"
                    onClick={() => void import("@tauri-apps/api/core").then(({ invoke }) => invoke("clear_user_cache", { mid: String(s.mid) }))}
                  >
                    清除该 UP 缓存
                  </button>
                </Row>
              ))}
            </div>
          </Section>
        </Sections>
      );

    case "system":
      return tab === "B 站账号" ? (
        <Sections>
          <Section title="账号" open><AccountSection /></Section>
        </Sections>
      ) : tab === "自动更新" ? (
        <Sections>
          <Section title="更新" open><UpdateSection /></Section>
        </Sections>
      ) : (
        <Sections>
          <Section title="关于" open>
            <div className="text-[12px] leading-relaxed" style={{ color: "var(--text-2)" }}>
              BiliUPMonitor · 桌面版 B 站 UP 主数据监控<br />
              用户数据（订阅 / 备注 / 设置 / 历史增长 / 登录凭据 / 缓存）全部保存在
              <code className="mx-1">%APPDATA%\com.biliupmonitor.app</code>
              与本地缓存目录，程序更新不会影响这些数据。<br />
              数据库结构升级全部走 migration（v1 → v2 → …），不会重建数据库。
            </div>
          </Section>
        </Sections>
      );
  }
}

/**
 * Refresh everything for one UP (profile, banner/avatar/pendant, level, VIP,
 * certification, fans medal, decoration, following/follower/likes/views/video
 * count, recent posts and per-video stats) while the cached view stays on
 * screen. Shares the main progress line with the video-list refresh.
 */
function RefreshUpSection({ mid }: { mid: number }) {
  const qc = useQueryClient();
  const setRefreshing = useUIStore((s) => s.setRefreshing);
  const [done, setDone] = useState(false);

  const refreshAll = async () => {
    setRefreshing(true);
    setDone(false);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["profile", mid] }),
      qc.invalidateQueries({ queryKey: ["stats", mid] }),
      qc.invalidateQueries({ queryKey: ["decoration", mid] }),
      qc.invalidateQueries({ queryKey: ["videos", mid] }),
      qc.invalidateQueries({ queryKey: ["videoDetail"] }),
      qc.invalidateQueries({ queryKey: ["online"] }),
      qc.invalidateQueries({ queryKey: ["statsGrowth", mid] }),
    ]);
    window.setTimeout(() => setRefreshing(false), 600);
    setDone(true);
  };

  return (
    <div className="flex items-center gap-2 mt-3">
      <button className="btn text-xs" onClick={() => void refreshAll()}>
        刷新当前 UP 全部数据
      </button>
      {done && <span className="text-[11px]" style={{ color: "#22a06b" }}>已发起刷新，缓存会继续显示</span>}
    </div>
  );
}

/* ---- level 3: collapsible sections ---- */

function Sections({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-2">{children}</div>;
}

function Section({ title, open: initialOpen, children }: { title: string; open?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(!!initialOpen);
  return (
    <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--line)" }}>
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
        style={{ background: "var(--surface-2)" }}
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronDown size={13} />
        <span className="text-[12.5px] font-medium" style={{ color: "var(--text)" }}>{title}</span>
      </button>
      {open && <div className="px-3 py-2">{children}</div>}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 gap-3">
      <span className="text-[12.5px] shrink-0" style={{ color: "var(--text-2)" }}>{label}</span>
      <div className="flex items-center gap-2 min-w-0">{children}</div>
    </div>
  );
}

function Switch({ on, onToggle }: { on: boolean; onToggle: (v: boolean) => void }) {
  return <span className={`switch ${on ? "on" : ""}`} onClick={() => onToggle(!on)} />;
}

export type { GlobalSettings };
