// Vercel function for the API. vercel.json rewrites /api/v1/:path* to /api/index?path=:path*;
// restoreUrl puts the original path back before the Express app sees the request.
import { connect } from "../server/src/db.mjs";
import { ensureIndexes } from "../server/src/models.mjs";
import { createApp } from "../server/src/app.mjs";

/**
 * "/api/index?path=a/b&x=1" -> "/api/v1/a/b?x=1". Each decoded segment is re-encoded, so %2F, %3F, %23
 * and spaces stay inside their segment. Returns null for "." / ".." segments (the handler answers 404).
 */
export function restoreUrl(reqUrl) {
  const url = new URL(reqUrl, "http://localhost");
  // Already the real path (a rewrite that did not run, or a direct call): pass it through, query string and all.
  if ((url.pathname === "/api/v1" || url.pathname.startsWith("/api/v1/")) && !url.searchParams.has("path")) return reqUrl;
  const path = url.searchParams.get("path") ?? "";
  url.searchParams.delete("path");
  const segments = path.split("/");
  if (segments.some((x) => x === "." || x === "..")) return null;
  const rest = url.searchParams.toString();
  return `/api/v1/${segments.map(encodeURIComponent).join("/")}${rest ? `?${rest}` : ""}`;
}

/** The app (and its CORS middleware) never ran: allow WEB_ORIGIN so the browser shows the real message. */
export function corsFallback(req, res, env) {
  const origin = req.headers?.origin;
  if (origin && env.WEB_ORIGIN && origin === env.WEB_ORIGIN) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
}

let app = null;
let ready = null;

export default async function handler(req, res) {
  if (!ready) {
    ready = (async () => {
      if (process.env.MONGO_URL) {
        await connect(process.env.MONGO_URL);
        await ensureIndexes();
      }
      app = createApp({ env: process.env });
    })();
    ready.catch(() => { ready = null; });
  }
  try {
    await ready;
  } catch (e) {
    corsFallback(req, res, process.env);
    return res.status(502).json({ error: `The store failed: ${e.message}` });
  }
  const url = restoreUrl(req.url);
  if (!url) return res.status(404).json({ error: "No such route." });
  req.url = url;
  return app(req, res);
}
