import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../store/authStore";
import { generateQrSession, pollQrSession, type QrSession } from "../../services/auth/passport";
import { openUrl } from "@tauri-apps/plugin-opener";
import { spaceUrl } from "../../services/bilibili/endpoints";
import { Avatar } from "../subscriptions/Avatar";

const POLL_MS = 2000;

type Phase = "idle" | "loading" | "waiting" | "scanned" | "expired" | "failed";

/**
 * Bilibili account section: QR sign-in, bound primary account, sign-out.
 * The cookie is encrypted at rest by Windows DPAPI (see src-tauri/src/secret.rs).
 */
export function AccountSection() {
  const status = useAuthStore((s) => s.status);
  const account = useAuthStore((s) => s.account);
  const signIn = useAuthStore((s) => s.signIn);
  const signOut = useAuthStore((s) => s.signOut);
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [qr, setQr] = useState<QrSession | null>(null);
  const [error, setError] = useState<string | null>(null);
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
      const session = await generateQrSession();
      setQr(session);
      setPhase("waiting");
    } catch (e) {
      setPhase("failed");
      setError(e instanceof Error ? e.message : "二维码获取失败");
    }
  }, []);

  // Poll loop: one tick at a time so the 900ms request pacing is respected.
  useEffect(() => {
    if (!open || !qr || phase === "expired" || phase === "failed") return;
    let cancelled = false;

    const tick = async () => {
      const res = await pollQrSession(qr.key);
      if (cancelled) return;
      if (res.state === "success" && res.cookie) {
        const acc = await signIn(res.cookie);
        if (cancelled) return;
        if (acc) {
          setPhase("idle");
          setOpen(false);
          setQr(null);
          // Login unlocks 获赞 / 总播放 / 粉丝牌 — refetch everything.
          void qc.invalidateQueries({ queryKey: ["stats"] });
          void qc.invalidateQueries({ queryKey: ["profile"] });
          return;
        }
        setPhase("failed");
        setError("登录校验失败，请重新扫码");
        return;
      }
      if (res.state === "expired") {
        setPhase("expired");
        return;
      }
      if (res.state === "error") {
        setPhase("failed");
        setError(res.message ?? "登录失败");
        return;
      }
      setPhase(res.state === "scanned" ? "scanned" : "waiting");
      timer.current = window.setTimeout(() => void tick(), POLL_MS);
    };

    timer.current = window.setTimeout(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      stop();
    };
  }, [open, qr, phase, signIn, qc]);

  useEffect(() => {
    if (open && !qr) void refresh();
    if (!open) {
      stop();
      setQr(null);
      setPhase("idle");
      setError(null);
    }
  }, [open, qr, refresh]);

  const handleSignOut = async () => {
    await signOut();
    void qc.invalidateQueries({ queryKey: ["stats"] });
    void qc.invalidateQueries({ queryKey: ["profile"] });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs leading-relaxed" style={{ color: "var(--text-2)" }}>
        登录后可获取「获赞 / 总播放 / 粉丝牌」等需要登录的增强数据，并把该账号绑定为主账号（显示投稿入口）。
        <br />
        扫码登录不会上传任何信息，凭据使用 Windows DPAPI 加密保存在本机。
      </div>

      {status === "loggedIn" && account ? (
        <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}>
          <Avatar mid={account.mid} face={account.face} name={account.name} size={36} />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium truncate" style={{ color: "var(--text)" }}>{account.name}</div>
            <button className="text-[11px] cursor-pointer hover:underline" style={{ color: "var(--text-3)" }}
              onClick={() => void openUrl(spaceUrl(account.mid))}>
              UID {account.mid} · 主账号已绑定
            </button>
          </div>
          <button className="btn text-xs" onClick={() => void handleSignOut()}>退出登录</button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button className="btn btn-primary text-xs" onClick={() => setOpen((v) => !v)} disabled={status === "loading"}>
            {open ? "收起二维码" : "扫码登录 B 站账号"}
          </button>
          <span className="text-[11px]" style={{ color: "var(--text-3)" }}>
            {status === "loading" ? "正在读取本地凭据…" : "当前为匿名模式"}
          </span>
        </div>
      )}

      {open && status !== "loggedIn" && (
        <div className="flex items-center gap-4 p-3 rounded-lg" style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}>
          <div className="flex-none rounded-lg p-2" style={{ background: "#fff" }}>
            {qr ? (
              <QRCodeSVG value={qr.url} size={132} level="M" marginSize={0} />
            ) : (
              <div className="flex items-center justify-center" style={{ width: 132, height: 132, color: "#999", fontSize: 12 }}>
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
            <div className="mt-2 text-[11px]" style={{ color: "var(--text-3)" }}>
              二维码 2 分钟内有效
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
