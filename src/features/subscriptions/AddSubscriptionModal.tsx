import { useState } from "react";
import { BilibiliAdapter } from "../../services/bilibili/adapter";
import { BiliError } from "../../services/bilibili/types";
import { useAddSubscription, useSubscriptions } from "../../queries/subscriptions";
import { useSettingsStore } from "../../store/settingsStore";
import { useUIStore } from "../../store/uiStore";

export function AddSubscriptionModal() {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setAddOpen = useUIStore((s) => s.setAddOpen);
  const setSelectedMid = useUIStore((s) => s.setSelectedMid);
  const { data: subs } = useSubscriptions();
  const addSub = useAddSubscription();
  const globalLimit = useSettingsStore((s) => s.global.videoLimit);

  const submit = async () => {
    if (!input.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { mid } = BilibiliAdapter.resolveUser(input);
      if (subs?.some((s) => s.mid === mid)) {
        setError("该 UP 主已在订阅列表中");
        return;
      }
      const profile = await BilibiliAdapter.getUserProfile(mid);
      await addSub.mutateAsync({ mid, name: profile.name || `UID ${mid}`, videoLimit: globalLimit });
      setSelectedMid(mid);
      setAddOpen(false);
    } catch (e) {
      if (e instanceof BiliError) {
        setError(e.type === "not_found" ? "未找到该 UP 主" : `获取资料失败：${e.message}`);
      } else {
        setError("添加失败，请检查网络或输入");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.35)" }}
      onClick={() => setAddOpen(false)}
    >
      <div className="card p-5 w-[420px] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold mb-1" style={{ color: "var(--text)" }}>
          添加订阅
        </h2>
        <p className="text-xs mb-4" style={{ color: "var(--text-2)" }}>
          输入 B 站主页链接或 UID
        </p>
        <input
          autoFocus
          className="w-full mb-2"
          placeholder="https://space.bilibili.com/123456 或 123456"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void submit()}
        />
        {error && (
          <div className="text-xs mb-2" style={{ color: "#e5484d" }}>
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2 mt-3">
          <button className="btn" onClick={() => setAddOpen(false)} disabled={busy}>
            取消
          </button>
          <button className="btn btn-primary" onClick={() => void submit()} disabled={busy}>
            {busy ? "添加中…" : "添加"}
          </button>
        </div>
      </div>
    </div>
  );
}
