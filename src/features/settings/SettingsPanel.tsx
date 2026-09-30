import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useUIStore } from "../../store/uiStore";
import { useSettingsStore } from "../../store/settingsStore";
import {
  useAddSubscriptionFlow,
  useRemarkEditor,
  useRemoveSubscriptions,
  useSaveSubscriptionOrder,
  useSubscriptions,
} from "../../queries/subscriptions";
import { ConfirmButton } from "../../components/ui/ConfirmButton";
import { invalidateUserAssets } from "../../utils/assetCache";
import { setAlwaysOnTop } from "../../utils/window";
import type { Subscription } from "../../services/database/subscriptions";
import {
  DEFAULT_OPACITY,
  DEFAULT_SETTINGS,
  DEFAULT_VIDEO_FIELD_ORDER,
  FIELD_LABELS,
  HIGHLIGHT_OPTIONS,
  type FieldVisibility,
  type GlobalSettings,
  type HighlightField,
  type PerUserSettings,
  type VideoFieldKey,
} from "../../types/settings";
import { AccountSection } from "./AccountSection";
import { UpdateSection } from "./UpdateSection";
import { PreviewCard } from "./PreviewCard";
import { VideoPreview } from "./VideoPreview";
import {
  APP_AUTHOR,
  APP_DISPLAY_NAME,
  AUTHOR_BILIBILI_URL,
  GITHUB_OWNER,
  GITHUB_OWNER_URL,
  GITHUB_REPO_URL,
  HAS_REPO,
  LICENSE_NAME,
} from "../../config/app";
import { ChevronDown, ExternalLink, Plus, Undo, XIcon } from "../../components/ui/Icons";

type Category = "appearance" | "subs" | "card" | "video" | "data" | "system";
type Mode = "global" | "perUser";

/**
 * 全局设置 only edits the shared defaults; 某个 UP 的设置 only edits that UP's
 * overrides. The two never mix, so neither page offers a mode switch.
 */
const GLOBAL_CATEGORIES: { id: Category; label: string; tabs: string[] }[] = [
  { id: "appearance", label: "外观", tabs: ["主题与窗口", "布局"] },
  { id: "subs", label: "订阅", tabs: ["订阅列表", "默认值"] },
  { id: "card", label: "用户名片", tabs: ["显示项"] },
  { id: "video", label: "视频", tabs: ["字段与顺序"] },
  { id: "data", label: "数据", tabs: ["刷新与增长", "缓存"] },
  { id: "system", label: "系统", tabs: ["B 站账号", "自动更新", "关于"] },
];

const PER_USER_CATEGORIES: { id: Category; label: string; tabs: string[] }[] = [
  { id: "card", label: "用户名片", tabs: ["显示项"] },
  { id: "video", label: "视频", tabs: ["字段与顺序"] },
  { id: "data", label: "数据", tabs: ["投稿与刷新"] },
];

export function SettingsPanel() {
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  const mode = useUIStore((s) => s.settingsTab) as Mode;
  const selectedMid = useUIStore((s) => s.selectedMid);
  const { data: subs } = useSubscriptions();
  const [category, setCategory] = useState<Category>("appearance");
  const [tabIndex, setTabIndex] = useState(0);
  const original = useRef<{ global: GlobalSettings; perUser: Record<number, PerUserSettings> } | null>(null);

  const categories = mode === "global" ? GLOBAL_CATEGORIES : PER_USER_CATEGORIES;
  const target = subs?.find((s) => s.mid === selectedMid);
  const targetName = target ? (target.remark || target.name || `UID ${target.mid}`) : null;

  // Snapshot on open so the live preview can be rolled back by 取消; 保存 keeps it.
  useEffect(() => {
    const s = useSettingsStore.getState();
    original.current = { global: s.global, perUser: s.perUser };
  }, []);

  // 外观 / 订阅 / 系统 don't exist in the per-UP page, so land on a valid one.
  useEffect(() => {
    if (!categories.some((c) => c.id === category)) {
      setCategory(categories[0].id);
      setTabIndex(0);
    }
  }, [categories, category]);

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

  const cat = categories.find((c) => c.id === category) ?? categories[0];
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
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="font-semibold" style={{ color: "var(--text)" }}>
              {mode === "global" ? "设置" : "这个 UP 的设置"}
            </span>
            {mode === "perUser" && targetName && (
              <span className="text-[12px] truncate" style={{ color: "var(--accent)" }}>{targetName}</span>
            )}
          </div>
          <button className="titlebar-btn" onClick={cancel}><XIcon size={14} /></button>
        </div>

        <div className="flex-1 min-h-0 flex">
          {/* level 1: categories */}
          <nav className="w-[132px] flex-none border-r py-2 flex flex-col gap-0.5" style={{ borderColor: "var(--line)" }}>
            {categories.map((c) => (
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
              {mode === "global" ? (
                <GlobalBody category={category} tab={tab} />
              ) : target == null ? (
                <div className="text-[12px]" style={{ color: "var(--text-3)" }}>请先在侧栏选择一个 UP 主</div>
              ) : (
                <PerUserBody mid={target.mid} category={category} />
              )}
            </div>
          </div>
        </div>

        {/* fixed footer: destructive on the left */}
        <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: "var(--line)" }}>
          {mode === "global" ? (
            <button
              className="btn text-xs"
              onClick={() => useSettingsStore.getState().updateGlobal({ ...DEFAULT_SETTINGS })}
            >
              恢复默认
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button className="btn text-xs" onClick={cancel}>取消</button>
            <button className="btn btn-primary text-xs" onClick={() => setSettingsOpen(false)}>保存并退出</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 全局设置
 * ------------------------------------------------------------------ */

function GlobalBody({ category, tab }: { category: Category; tab: string }) {
  const global = useSettingsStore((s) => s.global);
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
              <button
                className="reset-btn"
                title="恢复默认透明度"
                onClick={() => updateGlobal({ opacity: DEFAULT_OPACITY })}
              >
                <Undo size={13} />
              </button>
              <input type="range" min={60} max={100} value={global.opacity}
                onChange={(e) => updateGlobal({ opacity: Number(e.target.value) })} className="w-44" />
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
              <button
                className="reset-btn"
                title="恢复默认侧栏宽度"
                onClick={() => updateGlobal({ sidebarWidth: DEFAULT_SETTINGS.sidebarWidth })}
              >
                <Undo size={13} />
              </button>
              <input type="range" min={140} max={260} value={global.sidebarWidth}
                onChange={(e) => updateGlobal({ sidebarWidth: Number(e.target.value) })} className="w-44" />
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
        <SubscriptionManager subs={subs ?? []} />
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
            <div className="text-[11px] mt-1" style={{ color: "var(--text-3)" }}>
              个别 UP 主可以在它的独立设置里单独调整。
            </div>
          </Section>
        </Sections>
      );

    case "card":
      return (
        <Sections>
          <Section title="名片上显示的内容" open>
            <div className="text-[12px] mb-2" style={{ color: "var(--text-2)" }}>
              点击预览中的项目，可以选择它们是否显示在名片中。
            </div>
            {/* Global defaults only — an individual UP's overrides never leak in,
                and the sample identity is always the neutral one. */}
            <PreviewCard mid={selectedMid} fields={global.fields} onToggle={updateField} neutral />
          </Section>
        </Sections>
      );

    case "video":
      return (
        <Sections>
          <Section title="每条投稿显示的字段" open>
            <div className="text-[12px] mb-2" style={{ color: "var(--text-2)" }}>
              点击预览中的项目可以显示或隐藏对应字段。
            </div>
            <VideoPreview
              fields={global.fields}
              onToggle={updateField}
              order={global.videoFieldOrder}
              onOrder={(next: VideoFieldKey[]) => updateGlobal({ videoFieldOrder: next })}
              pinnedRight={global.videoPinnedRight}
              onPinnedRight={(k) => updateGlobal({ videoPinnedRight: k })}
            />
            <button
              className="btn text-xs mt-3"
              onClick={() => updateGlobal({ videoFieldOrder: [...DEFAULT_VIDEO_FIELD_ORDER], videoPinnedRight: "pubdate" })}
            >
              恢复默认顺序
            </button>
          </Section>

          <Section title="固定高亮字段" open>
            <div className="text-[12px] mb-2" style={{ color: "var(--text-2)" }}>
              选中的字段在每条投稿里会一直用 B站蓝显示，方便一眼扫到。排序字段始终使用粉色。
            </div>
            <Row label="高亮字段">
              <select
                value={global.highlightField}
                onChange={(e) => updateGlobal({ highlightField: e.target.value as HighlightField })}
              >
                {HIGHLIGHT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Row>
            <div className="flex items-center gap-3 mt-2 text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="legend-dot" style={{ background: "#fb7299" }} />排序字段
              </span>
              <span className="flex items-center gap-1.5">
                <span className="legend-dot" style={{ background: "#00aeec" }} />固定高亮
              </span>
            </div>
          </Section>
        </Sections>
      );

    case "data":
      return tab === "刷新与增长" ? (
        <Sections>
          <Section title="增长数据" open>
            <Row label="名片上显示的增长">
              <select value={global.growthPeriod} onChange={(e) => updateGlobal({ growthPeriod: e.target.value as GlobalSettings["growthPeriod"] })}>
                <option value="day">日增长</option>
                <option value="week">周增长</option>
                <option value="month">月增长</option>
              </select>
            </Row>
            <Row label="显示增长变化">
              <Switch on={global.fields.growthDay} onToggle={(v) => { updateField("growthDay", v); updateField("growthWeek", v); updateField("growthMonth", v); }} />
            </Row>
            <div className="text-[11px] mt-1" style={{ color: "var(--text-3)" }}>
              增长数据来自本程序自己记录的历史，历史不足时会留空。
            </div>
          </Section>
          <Section title="数据更新" open>
            <div className="text-[12px] leading-relaxed" style={{ color: "var(--text-2)" }}>
              正在查看的 UP 主更新最勤：资料约 15 分钟一次，播放 / 点赞 / 投币约 5 分钟一次，
              在线人数约 1 分钟一次。<br />
              其它已订阅的 UP 主会在后台依次更新。<br />
              窗口收进托盘后会自动放慢更新，并暂停更新在线人数。
            </div>
          </Section>
        </Sections>
      ) : (
        <Sections>
          <Section title="本机缓存" open>
            <div className="text-[12px] mb-2" style={{ color: "var(--text-2)" }}>
              头像、Banner、头像框和装扮图都会保存在本机，重新打开程序时立刻就能看到。
            </div>
            <div className="flex flex-col gap-1">
              {(subs ?? []).map((s) => (
                <Row key={s.mid} label={s.remark || s.name || `UID ${s.mid}`}>
                  <ConfirmButton
                    label="清除这个 UP 的缓存"
                    confirmLabel="确认清除"
                    tone="danger"
                    size="sm"
                    title="删除本机保存的头像、Banner、头像框和装扮图"
                    onConfirm={async () => {
                      const { invoke } = await import("@tauri-apps/api/core");
                      await invoke("clear_user_cache", { mid: String(s.mid) });
                      // Drop the resolved paths too, so the next mount
                      // re-downloads instead of pointing at a deleted file.
                      invalidateUserAssets(s.mid);
                    }}
                  />
                </Row>
              ))}
              {(subs ?? []).length === 0 && <div className="text-[12px]" style={{ color: "var(--text-3)" }}>还没有订阅</div>}
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
        <AboutSection />
      );
  }
}

/* ------------------------------------------------------------------ *
 * 单个 UP 的覆盖设置
 * ------------------------------------------------------------------ */

function PerUserBody({ mid, category }: { mid: number; category: Category }) {
  const global = useSettingsStore((s) => s.global);
  const perUser = useSettingsStore((s) => s.perUser[mid]);
  const setPerUser = useSettingsStore((s) => s.setPerUser);
  const clearPerUser = useSettingsStore((s) => s.clearPerUser);
  const updateGlobal = useSettingsStore((s) => s.updateGlobal);
  const qc = useQueryClient();
  const setRefreshing = useUIStore((s) => s.setRefreshing);
  const [done, setDone] = useState(false);

  const overrides = (perUser?.fields ?? {}) as Partial<FieldVisibility>;
  const overriddenKeys = Object.keys(overrides) as (keyof FieldVisibility)[];

  const effective = { ...global.fields, ...overrides };

  const applyField = (k: keyof FieldVisibility, v: boolean) => {
    setPerUser(mid, { ...perUser, fields: { ...overrides, [k]: v } });
  };
  const releaseField = (k: keyof FieldVisibility) => {
    const next = { ...overrides };
    delete next[k];
    setPerUser(mid, { ...perUser, fields: next });
  };

  /**
   * Re-fetch everything for this UP. It never clears a cache first: the current
   * snapshot stays on screen and the progress line reports the manual refresh.
   */
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
    setDone(true);
  };

  const InheritNote = ({ children }: { children: React.ReactNode }) => (
    <div className="text-[11px] mb-2" style={{ color: "var(--text-3)" }}>{children}</div>
  );

  const OverrideList = () =>
    overriddenKeys.length === 0 ? (
      <InheritNote>这个 UP 主目前完全跟随全局设置。</InheritNote>
    ) : (
      <div className="mt-3">
        <div className="text-[11px] mb-1.5" style={{ color: "var(--text-3)" }}>
          已单独设置的字段（点击 × 可恢复跟随全局）
        </div>
        <div className="flex flex-wrap gap-1.5">
          {overriddenKeys.map((k) => (
            <button key={k} className="override-chip" onClick={() => releaseField(k)} title="恢复跟随全局">
              {FIELD_LABELS[k]}<XIcon size={10} />
            </button>
          ))}
        </div>
      </div>
    );

  if (category === "card") {
    return (
      <Sections>
        <Section title="这个 UP 的名片显示项" open>
          <InheritNote>没有单独设置的项目会跟随全局默认值。</InheritNote>
          {/* 单个 UP 的预览显示这个 UP 的真实数据，因为它说明的正是“它会变成什么样”。 */}
          <PreviewCard mid={mid} fields={effective} onToggle={applyField} neutral={false} />
          <OverrideList />
          <button
            className="btn text-xs mt-3"
            onClick={() => clearPerUser(mid)}
          >
            恢复跟随全局
          </button>
        </Section>
      </Sections>
    );
  }

  if (category === "video") {
    return (
      <Sections>
        <Section title="这个 UP 的投稿字段" open>
          <InheritNote>字段顺序和“固定到最右”属于全局设置，这里只覆盖显示哪些字段。</InheritNote>
          <VideoPreview
            fields={effective}
            onToggle={applyField}
            order={global.videoFieldOrder}
            onOrder={(next: VideoFieldKey[]) => updateGlobal({ videoFieldOrder: next })}
            pinnedRight={global.videoPinnedRight}
            onPinnedRight={(k) => updateGlobal({ videoPinnedRight: k })}
          />
          <OverrideList />
          <button className="btn text-xs mt-3" onClick={() => clearPerUser(mid)}>
            恢复跟随全局
          </button>
        </Section>
      </Sections>
    );
  }

  if (category === "data") {
    const inherited = perUser?.videoLimit ?? global.videoLimit;
    const overriddenLimit = perUser?.videoLimit != null;
    return (
      <Sections>
        <Section title="投稿条数" open>
          <Row label="显示最近几条投稿（5–100）">
            <input
              type="number" min={5} max={100} className="w-24"
              value={inherited}
              onChange={(e) => {
                const n = Math.round(Number(e.target.value));
                if (Number.isFinite(n)) setPerUser(mid, { ...perUser, videoLimit: Math.min(100, Math.max(5, n)) });
              }}
            />
          </Row>
          <div className="flex items-center justify-between">
            <span className="text-[11px]" style={{ color: "var(--text-3)" }}>
              {overriddenLimit ? "已单独设置" : `跟随全局（${global.videoLimit} 条）`}
            </span>
            {overriddenLimit && (
              <button
                className="btn text-[11px] px-2 py-0.5"
                onClick={() => setPerUser(mid, { ...perUser, videoLimit: undefined })}
              >
                恢复跟随全局
              </button>
            )}
          </div>
        </Section>

        <Section title="刷新" open>
          <div className="text-[12px] leading-relaxed mb-2" style={{ color: "var(--text-2)" }}>
            立即重新获取这个 UP 主的资料、统计数据、粉丝牌、装扮和最近投稿。当前显示的数据会保留到新数据返回。
          </div>
          <div className="flex items-center gap-2">
            <ConfirmButton
              key={`refresh-${mid}-${category}`}
              label="刷新这个 UP 的全部数据"
              confirmLabel="确认刷新"
              tone="accent"
              title="重新获取资料、统计、粉丝牌、装扮和最近投稿"
              onConfirm={refreshAll}
            />
            {done && <span className="text-[11px]" style={{ color: "#22a06b" }}>已开始刷新</span>}
          </div>
        </Section>
      </Sections>
    );
  }

  return null;
}

/* ------------------------------------------------------------------ *
 * 关于
 * ------------------------------------------------------------------ */

function AboutSection() {
  const [version, setVersion] = useState("");
  useEffect(() => {
    void import("@tauri-apps/api/app")
      .then(({ getVersion }) => getVersion())
      .then(setVersion)
      .catch(() => setVersion(""));
  }, []);

  return (
    <Sections>
      <Section title="关于" open>
        <div className="flex flex-col gap-1.5 text-[12.5px]" style={{ color: "var(--text-2)" }}>
          <div className="text-[14px] font-semibold" style={{ color: "var(--text)" }}>
            {APP_DISPLAY_NAME}
          </div>
          <div>版本 {version || "—"}</div>
          <div className="flex items-center gap-2">
            <span className="w-16 flex-none" style={{ color: "var(--text-3)" }}>作者</span>
            <button className="link-btn" onClick={() => void openUrl(AUTHOR_BILIBILI_URL)}>{APP_AUTHOR}</button>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-16 flex-none" style={{ color: "var(--text-3)" }}>Bilibili</span>
            <button className="link-btn" onClick={() => void openUrl(AUTHOR_BILIBILI_URL)}>{APP_AUTHOR}</button>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-16 flex-none" style={{ color: "var(--text-3)" }}>GitHub</span>
            <button className="link-btn" onClick={() => void openUrl(GITHUB_OWNER_URL)}>
              {GITHUB_OWNER} <ExternalLink size={11} />
            </button>
          </div>
          {/* Only rendered once a repository actually exists — never a dead link. */}
          {HAS_REPO && (
            <div className="flex items-center gap-2">
              <span className="w-16 flex-none" style={{ color: "var(--text-3)" }}>项目仓库</span>
              <button className="link-btn" onClick={() => void openUrl(GITHUB_REPO_URL)}>
                项目仓库 <ExternalLink size={11} />
              </button>
            </div>
          )}
          {LICENSE_NAME && (
            <div className="flex items-center gap-2">
              <span className="w-16 flex-none" style={{ color: "var(--text-3)" }}>许可证</span>
              <span>{LICENSE_NAME}</span>
            </div>
          )}
        </div>
      </Section>
    </Sections>
  );
}

/* ------------------------------------------------------------------ *
 * 订阅管理（全局设置）
 *
 * 这里管理的是订阅本身：添加 / 删除 / 排序 / 备注。它复用主界面同一套
 * service（`useAddSubscriptionFlow` / `useRemoveSubscriptions` /
 * `useSaveSubscriptionOrder`），没有第二套实现；删除也用应用自己的形变二次
 * 确认，绝不弹浏览器对话框。
 * ------------------------------------------------------------------ */

function SubscriptionManager({ subs }: { subs: Subscription[] }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { add, busy } = useAddSubscriptionFlow();
  const removeSubs = useRemoveSubscriptions();
  const saveOrder = useSaveSubscriptionOrder();
  const videoLimit = useSettingsStore((s) => s.global.videoLimit);

  const submit = async () => {
    if (!input.trim() || busy) return;
    setError(null);
    try {
      await add(input, videoLimit);
      setInput("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "添加失败，请检查网络或输入");
    }
  };

  const move = (index: number, delta: number) => {
    const next = index + delta;
    if (next < 0 || next >= subs.length) return;
    const order = subs.map((s) => s.mid);
    const [moved] = order.splice(index, 1);
    order.splice(next, 0, moved);
    saveOrder.mutate(order);
  };

  return (
    <Sections>
      <Section title="添加订阅" open>
        <div className="flex items-center gap-2">
          <input
            className="flex-1 min-w-0 text-[12px]"
            placeholder="B 站主页链接或 UID"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
          />
          <button className="btn text-xs flex-none" disabled={busy || !input.trim()} onClick={() => void submit()}>
            <Plus size={13} /> {busy ? "添加中…" : "添加"}
          </button>
        </div>
        {error && <div className="text-[11px] mt-1.5" style={{ color: "#e5484d" }}>{error}</div>}
      </Section>

      <Section title="已订阅的 UP 主" open>
        <div className="text-[11px] mb-2" style={{ color: "var(--text-3)" }}>
          备注会立即显示在侧栏和名片上，不需要保存。
        </div>
        <div className="flex flex-col gap-1">
          {subs.map((s, i) => (
            <SubRow
              key={s.mid}
              sub={s}
              index={i}
              total={subs.length}
              onMove={move}
              onRemove={() => removeSubs.mutate([s.mid])}
            />
          ))}
          {subs.length === 0 && <div className="text-[12px]" style={{ color: "var(--text-3)" }}>还没有订阅</div>}
        </div>
      </Section>
    </Sections>
  );
}

function SubRow({
  sub,
  index,
  total,
  onMove,
  onRemove,
}: {
  sub: Subscription;
  index: number;
  total: number;
  onMove: (index: number, delta: number) => void;
  onRemove: () => void;
}) {
  const editor = useRemarkEditor(sub.mid);
  const [value, setValue] = useState(sub.remark ?? "");
  useEffect(() => setValue(sub.remark ?? ""), [sub.remark]);

  return (
    <div className="flex items-center gap-2 py-0.5">
      <div className="flex flex-none flex-col">
        <button
          className="order-btn"
          title="上移"
          disabled={index === 0}
          style={index === 0 ? { opacity: 0.3 } : undefined}
          onClick={() => onMove(index, -1)}
        >
          <ChevronDown size={11} style={{ transform: "rotate(180deg)" }} />
        </button>
        <button
          className="order-btn"
          title="下移"
          disabled={index === total - 1}
          style={index === total - 1 ? { opacity: 0.3 } : undefined}
          onClick={() => onMove(index, 1)}
        >
          <ChevronDown size={11} />
        </button>
      </div>

      <span className="w-28 shrink-0 truncate text-[12px]" style={{ color: "var(--text)" }} title={sub.name}>
        {sub.name || `UID ${sub.mid}`}
      </span>

      <input
        className="flex-1 min-w-0 text-[12px]"
        placeholder="备注名（留空则显示原用户名）"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          editor.set(e.target.value);
        }}
        onBlur={editor.flush}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />

      <ConfirmButton
        label="删除"
        confirmLabel="确认删除"
        tone="danger"
        size="sm"
        className="flex-none"
        title="取消订阅这个 UP 主"
        onConfirm={onRemove}
      />
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
