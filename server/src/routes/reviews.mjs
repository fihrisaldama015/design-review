import { Router } from "express";
import { HttpError, canUseProject } from "../auth.mjs";
import { Review } from "../models.mjs";
import { decide, markApplied, publish, slug as slugOf, summary } from "../reviewLogic.mjs";
import { loadProject } from "./projects.mjs";

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
const CONFLICT = "Someone else changed this review. Reload and check before saving.";
const HISTORY_MAX = 200;

/** Drops Mongo internals and scoping fields so the document matches the API contract. */
const clean = (row) => {
  if (!row) return null;
  const { _id, __v, projectId, orgId, ...doc } = row.toObject ? row.toObject() : row; // eslint-disable-line no-unused-vars
  return doc;
};

/** Project-scoped review routes for users and project tokens. Mount behind authenticate. */
export function reviewsRouter(env) {
  const r = Router();

  r.param("project", (req, res, next, key) => {
    (async () => {
      req.project = await loadProject(req, env, key);
      if (!canUseProject(req.auth, req.project)) throw new HttpError(403, "No access to this project.");
    })().then(() => next(), next);
  });

  const find = async (req, slug) => clean(await Review.findOne({ projectId: req.project._id, slug }).lean());
  const mustExist = async (req) => {
    const doc = await find(req, req.params.slug);
    if (!doc) throw new HttpError(404, "No such review.");
    return doc;
  };
  const onlyTool = (req, what) => {
    if (req.auth.kind !== "tool") throw new HttpError(403, `Only the project token can ${what}.`);
  };

  /** Writes `next` over `prev` (null = new) with the version lock; sends the response either way. */
  async function save(req, res, prev, next, status) {
    const slug = req.params.slug;
    const scope = { projectId: req.project._id, orgId: req.project.orgId, slug };
    const conflict = async () => res.status(409).json({ error: CONFLICT, current: await find(req, slug) });
    if (!prev) {
      try {
        await new Review({ ...next, ...scope }).save({ timestamps: false });
      } catch (e) {
        if (e.code === 11000) return conflict();
        throw e;
      }
      return res.status(status).json(clean(await Review.findOne({ projectId: scope.projectId, slug }).lean()));
    }
    const row = await Review.findOneAndUpdate(
      // every write appends exactly one audit entry, so the length also guards same-version republishes
      { projectId: scope.projectId, slug, version: prev.version, audit: { $size: prev.audit.length } },
      { $set: { ...next, ...scope } },
      { new: true, timestamps: false, lean: true },
    );
    if (!row) return conflict();
    res.status(status).json(clean(row));
  }

  const reply = (res, result) => {
    if (result.ok) return false;
    res.status(result.status).json({ error: result.error, ...(result.current ? { current: result.current } : {}) });
    return true;
  };

  r.get("/projects/:project/reviews", wrap(async (req, res) => {
    const rows = await Review.find(
      { projectId: req.project._id },
      { component: 1, jsxName: 1, status: 1, items: 1, answers: 1, migrateBy: 1, audit: 1, usage: 1, figmaNode: 1, readAt: 1, updatedAt: 1, version: 1 },
    ).lean();
    const reviews = rows.map((x) => summary(clean(x))).sort((a, b) => a.slug.localeCompare(b.slug));
    const counts = { pending: 0, answered: 0, applied: 0 };
    for (const s of reviews) counts[s.status] = (counts[s.status] || 0) + 1;
    res.json({ reviews, counts });
  }));

  r.get("/projects/:project/reviews/:slug", wrap(async (req, res) => {
    res.json(await mustExist(req));
  }));

  r.put("/projects/:project/reviews/:slug", wrap(async (req, res) => {
    onlyTool(req, "publish a review");
    const body = req.body || {};
    if (typeof body.component !== "string" || !body.component || slugOf(body.component) !== req.params.slug) {
      throw new HttpError(400, "component must be set and its slug must equal the URL.");
    }
    const okItems = Array.isArray(body.items) && body.items.every((i) => i && typeof i === "object" && typeof i.id === "string" && typeof i.kind === "string");
    if (body.items !== undefined && !okItems) throw new HttpError(400, "items must be an array of { id, kind, ... }.");
    const prev = await find(req, req.params.slug);
    const result = publish(prev, body, new Date().toISOString());
    if (reply(res, result)) return;
    await save(req, res, prev, result.doc, result.status);
  }));

  r.post("/projects/:project/reviews/:slug/decision", wrap(async (req, res) => {
    if (req.auth.kind !== "user") throw new HttpError(403, "Only a reviewer can decide.");
    const prev = await mustExist(req);
    const { answers, migrateBy, version, note } = req.body || {};
    const by = String(req.auth.user.name || req.auth.user.email).slice(0, 80);
    const result = decide(prev, { answers, migrateBy, version, by, note }, new Date().toISOString());
    if (reply(res, result)) return;
    if (result.doc === prev) return res.status(200).json(prev); // nothing changed, nothing to write
    await save(req, res, prev, result.doc, 200);
  }));

  r.post("/projects/:project/reviews/:slug/applied", wrap(async (req, res) => {
    onlyTool(req, "mark a review applied");
    const prev = await mustExist(req);
    if (prev.status === "applied") return res.status(409).json({ error: "This review was already applied.", current: prev });
    if (prev.status === "pending") return res.status(409).json({ error: "The reviewers have not answered every removal yet.", current: prev });
    const result = markApplied(prev, new Date().toISOString());
    await save(req, res, prev, result.doc, 200);
  }));

  r.get("/projects/:project/history", wrap(async (req, res) => {
    const rows = await Review.find({ projectId: req.project._id }, { component: 1, slug: 1, audit: 1 }).lean();
    const entries = [];
    for (const row of rows) {
      for (const a of row.audit || []) {
        entries.push({ component: row.component, slug: row.slug, at: a.at, by: a.by, action: a.action, changes: a.changes, migrateBy: a.migrateBy, note: a.note });
      }
    }
    entries.reverse(); // stable sort below then puts later-inserted entries first on equal times
    entries.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
    res.json(entries.slice(0, HISTORY_MAX));
  }));

  return r;
}
