import express from "express";
import { HttpError, authenticate } from "./auth.mjs";
import { loginRouter, sessionRouter } from "./routes/auth.mjs";

/** Builds the Express app. Does not connect to Mongo; the caller does that. */
export function createApp({ env }) {
  const app = express();
  const api = express.Router();

  api.use(express.json({ limit: "1mb" }));

  api.use((req, res, next) => {
    const missing = ["SESSION_SECRET", "MONGO_URL"].filter((k) => !env[k]);
    if (missing.length) {
      return next(new HttpError(503, `The review service is not configured (set ${missing.join(", ")}).`));
    }
    next();
  });

  // Public routes: no authentication.
  api.use(loginRouter(env));

  // Everything below needs a session or a project token.
  api.use(authenticate(env));
  api.use(sessionRouter());

  // MOUNT NEW ROUTERS HERE (Tasks 4-6), e.g. api.use(projectsRouter(env));

  api.use((req, res, next) => next(new HttpError(404, "No such route.")));

  app.use("/api/v1", api);
  app.use((req, res, next) => next(new HttpError(404, "No such route.")));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.status) return res.status(err.status).json({ error: err.message });
    if (err.type === "entity.parse.failed") return res.status(400).json({ error: "The request body is not valid JSON." });
    if (err.type === "entity.too.large") return res.status(400).json({ error: "The request body is too large." });
    if (err.name?.startsWith("Mongo") || err.name?.startsWith("Mongoose")) {
      return res.status(502).json({ error: `The store failed: ${err.message}` });
    }
    console.error(err);
    res.status(500).json({ error: "Something went wrong." });
  });

  return app;
}
