import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useQueryClient } from "@tanstack/react-query";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useAuthStore, type BiliAccount } from "../../store/authStore";
import { useSettingsStore } from "../../store/settingsStore";
import { useSubscriptions } from "../../queries/subscriptions";
import { generateQrSession, pollQrSession, type QrSession } from "../../services/auth/passport";
import { spaceUrl } from "../../services/bilibili/endpoints";
import { Avatar } from "../subscriptions/Avatar";

const POLL_MS = 2000;

type Phase = "loading" | "waiting" | "scanned" | "expired" | "failed";

/**
 * Bilibili account section: QR sign-in, primary-account binding, sign-out.
 * The cookie is encrypted at rest by Windows DPAPI (see src-tauri/src/secret.rs).
 */
export function AccountSection() {
  const status = useAuthStore((s) => s.status);
  const account = useAuthStore((s) => s.account);
  const signIn = useAuthStore((s) => s.signIn);
  const signOut = useAuthStore((s) => s.signOut);
  const primaryMid = useSettingsStore((s) => s.global.primaryAccountMid);
  const updateGlobal = useSettingsStore((s) => s.updateGlobal);
  const { data: subs } = useSubscriptions();
  const qc = useQueryClient();

  const [qrOpen, setQrOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("loading");
  const [qr, setQr] = useState<QrSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingAccount, setPendingAccount] = useState<BiliAccount | null>(null);
  const timer = useRef<number | null>(null);

  const stop = () => {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const refresh = useCallback(async () => {
    stop();
    setError(null);
    setPhase("loading");
    try {
      setQr(await generateQrSession());
      setPhase("waiting");
    } catch (e) {
      setPhase("failed");
      setError(e instanceof Error ? e.message : "二维码获取失败");
    }
  }, []);

  // Poll loop: one tick at a time so the shared request pacing is respected.
  useEffect(() => {
    if (!qrOpen || !qr || phase === "expired" || phase === "failed") return;
    let cancelled = false;

    const tick = async () => {
      const res = await pollQrSession(qr.key);
      if (cancelled) return;

      if (res.state === "success" && res.cookie) {
        const acc = await signIn(res.cookie);
        if (cancelled) return;
        if (!acc) {
          setPhase("failed");
          setError("登录校验失败，请重新扫码");
          return;
        }
        setQrOpen(false);
        setQr(null);
        setPhase("loading");
        void qc.invalidateQueries({ queryKey: ["stats"] });
        void qc.invalidateQueries({ queryKey: ["profile"] });
        // Ask before replacing an explicitly chosen primary account.
        if (primaryMid != null && primaryMid !== acc.mid) setPendingAccount(acc);
        else if (primaryMid == null) updateGlobal({ primaryAccountMid: acc.mid });
        return;
      }

      if (res.state === "expired") return setPhase("expired");
      if (res.state === "error") {
        setError(res.message ?? "登录失败");
        return setPhase("failed");
      }
      setPhase(res.state === "scanned" ? "scanned" : "waiting");
      timer.current = window.setTimeout(() => void tick(), POLL_MS);
    };

    timer.current = window.setTimeout(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      stop();
    };
  }, [qrOpen, qr, phase, signIn, qc, primaryMid, updateGlobal]);

  // Open => fetch a fresh QR. Closing => fully reset, no polling left behind.
  useEffect(() => {
    if (qrOpen) void refresh();
    else {
      stop();
      setQr(null);
      setPhase("loading");
      setError(null);
    }
  }, [qrOpen, refresh]);

  const handleSignOut = async () => {
    await signOut();
    void qc.invalidateQueries({ queryKey: ["stats"] });
    void qc.invalidateQueries({ queryKey: ["profile"] });
  };

  const bindPrimary = (value: number | null) => updateGlobal({ primaryAccountMid: value });

  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs leading-relaxed" style={{ color: "var(--text-2)" }}>
        登录后可获取「获赞 / 总播放 / 粉丝牌」等需要登录的增强数据。扫码登录不上传任何信息，凭据使用 Windows DPAPI 加密保存在本机。
      </div>

      {/* ---- primary account (available logged in or not) ---- */}
      <div className="flex items-center justify-between py-1">
        <span className="text-[13px]" style={{ color: "var(--text-2)" }}>主账号（显示「投稿」入口）</span>
        <select
          value={primaryMid ?? 0}
          onChange={(e) => {
            const n = Number(e.target.value);
            bindPrimary(n > 0 ? n : null);
          }}
        >
          <option value={0}>不设置</option>
          {(subs ?? []).map((s) => (
            <option key={s.mid} value={s.mid}>
              {s.remark || s.name || `UID ${s.mid}`}
            </option>
          ))}
          {primaryMid != null && !(subs ?? []).some((s) => s.mid === primaryMid) && (
            <option value={primaryMid}>UID {primaryMid}（未订阅）</option>
          )}
        </select>
      </div>

      {/* ---- sign-in / account ---- */}
      {status === "loggedIn" && account ? (
        <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}>
          <Avatar mid={account.mid} face={account.face} name={account.name} size={36} />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium truncate" style={{ color: "var(--text)" }}>{account.name}</div>
            <button className="text-[11px] cursor-pointer hover:underline" style={{ color: "var(--text-3)" }}
              onClick={() => void openUrl(spaceUrl(account.mid))}>
              UID {account.mid}
            </button>
          </div>
          <button className="btn text-xs" onClick={() => void handleSignOut()}>退出登录</button>
        </div>
      ) : (
        <div className="relative">
          <div className="flex items-center gap-3">
            <button className="btn btn-primary text-xs" onClick={() => setQrOpen((v) => !v)} disabled={status === "loading"}>
              {qrOpen ? "收起二维码" : "扫码登录 B 站账号"}
            </button>
            <span className="text-[11px]" style={{ color: "var(--text-3)" }}>
              {status === "loading" ? "正在读取本地凭据…" : "当前为匿名模式"}
            </span>
          </div>

          {/* Popover opens UPWARD so the settings page never scrolls. */}
          {qrOpen && (
            <div className="qr-pop">
              <div className="flex-none rounded-lg p-2" style={{ background: "#fff" }}>
                {qr ? (
                  <QRCodeSVG value={qr.url} size={124} level="M" marginSize={0} />
                ) : (
                  <div className="flex items-center justify-center" style={{ width: 124, height: 124, color: "#999", fontSize: 12 }}>
                    加载中…
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0 text-[12px] leading-relaxed" style={{ color: "var(--text-2)" }}>
                {phase === "waiting" && <div>请使用「哔哩哔哩」手机客户端扫描二维码</div>}
                {phase === "scanned" && <div style={{ color: "var(--accent)" }}>已扫描，请在手机上确认登录</div>}
                {phase === "expired" && <div>二维码已过期</div>}
                {phase === "failed" && <div style={{ color: "#e5484d" }}>{error ?? "登录失败"}</div>}
                {(phase === "expired" || phase === "failed") && (
                  <button className="btn text-xs mt-2" onClick={() => void refresh()}>重新获取二维码</button>
                )}
                <div className="mt-2 text-[11px]" style={{ color: "var(--text-3)" }}>二维码 2 分钟内有效</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---- bind confirmation when the login account differs ---- */}
      {pendingAccount && (
        <div className="p-3 rounded-lg flex items-center gap-3" style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-ring)" }}>
          <div className="flex-1 text-[12px]" style={{ color: "var(--text)" }}>
            登录账号 <b>{pendingAccount.name}</b>（UID {pendingAccount.mid}）与当前主账号不同，是否切换？
          </div>
          <button className="btn text-xs" onClick={() => setPendingAccount(null)}>保持现有</button>
          <button
            className="btn btn-primary text-xs"
            onClick={() => {
              bindPrimary(pendingAccount.mid);
              setPendingAccount(null);
            }}
          >
            切换
          </button>
        </div>
      )}
    </div>
  );
}
