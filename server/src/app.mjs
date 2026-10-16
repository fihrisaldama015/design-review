import express from "express";
import { HttpError, authenticate } from "./auth.mjs";
import { loginRouter, sessionRouter } from "./routes/auth.mjs";
import { reviewsRouter } from "./routes/reviews.mjs";
import { projectsRouter } from "./routes/projects.mjs";

/** Builds the Express app. Does not connect to Mongo; the caller does that. */
export function createApp({ env }) {
  const app = express();
  const api = express.Router();

  api.use((req, res, next) => { res.set("Cache-Control", "no-store"); next(); });

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

  // Reviews first: members and tools must reach them; projectsRouter's admin guard covers all /projects/*.
  api.use(reviewsRouter(env));
  api.use(projectsRouter(env));
  // MOUNT NEW ROUTERS HERE (Task 6), e.g. api.use(otherRouter(env));

  api.use((req, res, next) => next(new HttpError(404, "No such route.")));

  app.use("/api/v1", api);
  app.use((req, res, next) => next(new HttpError(404, "No such route.")));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    // body-parser errors carry err.status (400/413), so check err.type first.
    if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Body is not valid JSON." });
    if (err.type === "entity.too.large") return res.status(400).json({ error: "Body is too large (1mb max)." });
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err.name === "ValidationError" || err.name === "CastError") {
      return res.status(400).json({ error: `Invalid data: ${err.message}` });
    }
    if (err.name?.startsWith("Mongo")) { // Mongo*, Mongoose* (network, driver, server selection)
      return res.status(502).json({ error: `The store failed: ${err.message}` });
    }
    console.error(err);
    res.status(500).json({ error: "Something went wrong." });
  });

  return app;
}
