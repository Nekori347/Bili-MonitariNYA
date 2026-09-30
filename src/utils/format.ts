/** Format a number using Chinese 万/亿 units, e.g. 12345 -> "1.2万". */
export function formatCount(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  const v = Number(n);
  if (v >= 100_000_000) return trim(v / 100_000_000) + "亿";
  if (v >= 10_000) return trim(v / 10_000) + "万";
  return String(v);
}

function trim(x: number): string {
  const s = x.toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

/** Signed growth display, e.g. +1.3万 / -200 / 0. */
export function formatDelta(delta: number): string {
  const sign = delta > 0 ? "+" : delta < 0 ? "-" : "";
  const abs = Math.abs(delta);
  return `${sign}${formatCount(abs)}`;
}

/** Spaced variant for prose, e.g. "16 小时" / "25 分钟" / "3 天". */
export function formatAgoSpaced(ts: number): string {
  return formatAgo(ts).replace(/^(\d+)(\D+)$/, "$1 $2");
}

export function formatDate(ts: number): string {
  const d = new Date(ts * 1000);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "刚刚";
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < 30 * day) return `${Math.floor(diff / day)} 天前`;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** Compact "time since last post": 12分钟 / 10小时 / 5天 / 2个月. */
export function formatAgo(ts: number): string {
  const diff = Date.now() - ts * 1000;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m}分钟`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小时`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}天`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}个月`;
  return `${Math.floor(mo / 12)}年`;
}
