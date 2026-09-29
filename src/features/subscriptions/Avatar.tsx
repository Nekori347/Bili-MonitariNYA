import { useEffect, useState } from "react";
import { useCachedAsset } from "../../utils/useCachedAsset";

/** Round UP avatar with a first-letter fallback while the image loads or fails. */
export function Avatar({ mid, face, name, size = 24 }: { mid: number; face?: string; name: string; size?: number }) {
  const src = useCachedAsset(face, `users/${mid}/avatar`);
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src, mid]);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        className="rounded-full object-cover flex-none"
        style={{ width: size, height: size, background: "var(--surface-2)" }}
        draggable={false}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span
      className="flex-none rounded-full flex items-center justify-center font-medium"
      style={{ width: size, height: size, background: "var(--accent-soft)", color: "var(--accent)", fontSize: size * 0.42 }}
    >
      {(name || "?").slice(0, 1)}
    </span>
  );
}
