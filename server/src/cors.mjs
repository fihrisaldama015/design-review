import { Project } from "./models.mjs";

const TTL_MS = 60_000;
let cache = null; // { key, at, origins }

export function clearOriginCache() { cache = null; }

/** Set of allowed browser origins: env.WEB_ORIGIN plus every project's allowedOrigins in the org. Cached 60 s. */
export async function allowedOrigins(env) {
  const orgId = env.ORG_ID || "blue-silo";
  const key = `${orgId}|${env.WEB_ORIGIN || ""}`;
  if (cache && cache.key === key && Date.now() - cache.at < TTL_MS) return cache.origins;
  const rows = await Project.find({ orgId }, { allowedOrigins: 1 }).lean();
  const origins = new Set(rows.flatMap((p) => p.allowedOrigins || []));
  if (env.WEB_ORIGIN) origins.add(env.WEB_ORIGIN);
  cache = { key, at: Date.now(), origins };
  return origins;
}

/** Express middleware. Mount before authenticate: preflight carries no Authorization. */
export function corsMiddleware(env) {
  return async (req, res, next) => {
    try {
      const origin = req.get("origin");
      if (origin && (await allowedOrigins(env)).has(origin)) {
        res.set("Access-Control-Allow-Origin", origin);
        res.vary("Origin");
        if (req.method === "OPTIONS") {
          res.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE");
          res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
        }
      } else if (origin) {
        res.vary("Origin");
      }
      if (req.method === "OPTIONS") return res.status(204).end();
      next();
    } catch (e) {
      next(e);
    }
  };
}
