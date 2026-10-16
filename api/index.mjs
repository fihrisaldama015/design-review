// Vercel function for the API. vercel.json rewrites /api/v1/:path* to /api/index?path=:path*;
// restoreUrl puts the original path back before the Express app sees the request.
import { connect } from "../server/src/db.mjs";
import { ensureIndexes } from "../server/src/models.mjs";
import { createApp } from "../server/src/app.mjs";

/** "/api/index?path=a/b&x=1" -> "/api/v1/a/b?x=1" */
export function restoreUrl(reqUrl) {
  const url = new URL(reqUrl, "http://localhost");
  const path = url.searchParams.get("path") ?? "";
  url.searchParams.delete("path");
  const rest = url.searchParams.toString();
  return `/api/v1/${path}${rest ? `?${rest}` : ""}`;
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
    return res.status(502).json({ error: `The store failed: ${e.message}` });
  }
  req.url = restoreUrl(req.url);
  return app(req, res);
}
