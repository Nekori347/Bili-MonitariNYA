import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Two-step action button. The first click morphs the *same* button in place
 * into its confirmation state — no dialog, no second button, no browser
 * confirm. Clicking anywhere else, pressing Esc or leaving the page cancels.
 */
export function ConfirmButton({
  label,
  confirmLabel,
  tone = "danger",
  onConfirm,
  className = "",
  title,
  disabled,
  size = "md",
}: {
  label: ReactNode;
  confirmLabel: string;
  /** `danger` is the destructive red language; `accent` is the B站 pink one. */
  tone?: "danger" | "accent";
  onConfirm: () => void | Promise<void>;
  className?: string;
  title?: string;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  const cancel = useCallback(() => setConfirming(false), []);

  useEffect(() => {
    if (!confirming) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) cancel();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancel();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [confirming, cancel]);

  const click = async () => {
    if (busy) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <button
      ref={ref}
      className={`btn morph-btn ${tone}${size === "sm" ? " sm" : ""}${confirming ? " confirming" : ""} ${className}`}
      disabled={disabled || busy}
      title={confirming ? "点击确认 · 点击空白或按 Esc 取消" : title}
      onClick={() => void click()}
    >
      <span key={confirming ? "c" : "i"} className="morph-label">
        {confirming ? confirmLabel : label}
      </span>
    </button>
  );
}
