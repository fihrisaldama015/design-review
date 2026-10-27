/** "just now", "5 minutes ago", "2 days ago". Empty text for a missing or invalid time. */
export function timeAgo(iso, now = new Date()) {
  const t = new Date(iso).getTime();
  if (!iso || Number.isNaN(t)) return "";
  const s = Math.max(0, Math.round((now.getTime() - t) / 1000));
  if (s < 60) return "just now";
  const units = [["minute", 60], ["hour", 3600], ["day", 86400], ["month", 2592000], ["year", 31536000]];
  let best = units[0];
  for (const u of units) if (s >= u[1]) best = u;
  const n = Math.floor(s / best[1]);
  return `${n} ${best[0]}${n === 1 ? "" : "s"} ago`;
}

/** Local date as YYYY-MM-DD. */
export const localDay = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
