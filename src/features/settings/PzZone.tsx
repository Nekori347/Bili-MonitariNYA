import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * One clickable element inside a settings preview.
 *
 * Hovering outlines the element and names it; clicking flips that element's own
 * switch. Two things are deliberate:
 *
 * 1. The tooltip is PORTALLED to `document.body`. An in-flow label would be
 *    clipped by the card's rounded `overflow: hidden` and by the dashed outline
 *    box the zone itself draws, which is exactly the bug this replaces.
 * 2. The box is a flex container with a fixed height and both axes centred, so
 *    every preview button's text lands on the same optical centre regardless of
 *    what element it wraps.
 *
 * Direction is computed, never assumed: a row-shaped zone flips below its
 * element when the window's top edge would swallow the tooltip, and a block
 * zone (Banner, which spans the whole hero) always opens downward.
 */
export function PzZone({
  on,
  label,
  hint,
  onToggle,
  children,
  style,
  className = "",
  /** Block zones cover their element instead of sitting in a row (Banner). */
  block = false,
}: {
  on: boolean;
  label: string;
  hint: string;
  onToggle: () => void;
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  block?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; below: boolean } | null>(null);

  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const below = block || r.top < 44;
    const half = 96; // keeps a long hint from hanging off either edge
    setTip({
      x: Math.min(Math.max(r.left + r.width / 2, half), Math.max(half, window.innerWidth - half)),
      y: below ? r.bottom + 6 : r.top - 6,
      below,
    });
  };

  return (
    <span
      ref={ref}
      className={`pz${block ? "" : " pv-btn"}${on ? "" : " off"}${className ? " " + className : ""}`}
      style={style}
      onMouseEnter={show}
      onMouseLeave={() => setTip(null)}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      {children}
      {tip &&
        createPortal(
          <span
            className="pz-tip"
            style={{
              left: tip.x,
              top: tip.y,
              transform: tip.below ? "translateX(-50%)" : "translate(-50%, -100%)",
            }}
          >
            <span className="pz-tip-title">{on ? "✓" : "✕"} {label}</span>
            <span className="pz-tip-hint">{hint}</span>
          </span>,
          document.body,
        )}
    </span>
  );
}
