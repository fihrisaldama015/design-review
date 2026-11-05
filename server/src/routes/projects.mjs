import crypto from "node:crypto";
import { Router } from "express";
import mongoose from "mongoose";
import { HttpError, hashPassword, newProjectToken, userView } from "../auth.mjs";
import { clearOriginCache } from "../cors.mjs";
import { Project, Token, User, Membership, Review } from "../models.mjs";

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
export const KEY_RE = /^[a-z0-9-]{2,40}$/;
// No 0/O/1/l/I look-alikes.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const generatePassword = (len = 14) =>
  Array.from({ length: len }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join("");

const projectView = (p) => ({
  id: String(p._id), key: p.key, name: p.name, figmaFileKey: p.figmaFileKey, storybookUrl: p.storybookUrl,
  reviewUrl: p.reviewUrl, allowedOrigins: p.allowedOrigins, hasPreviewBuilds: !!p.hasPreviewBuilds,
});

function requireAdmin(req) {
  if (!(req.auth.kind === "user" && req.auth.user.role === "admin")) {
    throw new HttpError(403, "Only an admin can do this.");
  }
}
export const orgOf = (req, env) => (req.auth.kind === "tool" ? req.auth.orgId : req.auth.user.orgId || env.ORG_ID || "blue-silo");

/** Org-scoped project lookup by key; 404 when the key is malformed or unknown. */
export async function loadProject(req, env, key) {
  const project = KEY_RE.test(key) ? await Project.findOne({ orgId: orgOf(req, env), key }) : null;
  if (!project) throw new HttpError(404, "No such project.");
  return project;
}

function isOrigin(o) {
  if (typeof o !== "string") return false;
  try { return new URL(o).origin === o; } catch { return false; }
}

const optString = (v, name) => {
  if (v === undefined) return undefined;
  if (v === null) return ""; // null clears the field
  if (typeof v !== "string") throw new HttpError(400, `${name} must be a string.`);
  return v;
};

const httpUrl = (v, name) => {
  const s = optString(v, name);
  if (!s) return s; // undefined (unchanged) or "" (cleared)
  let ok = false;
  try { ok = ["http:", "https:"].includes(new URL(s).protocol); } catch { /* not a URL */ }
  if (!ok) throw new HttpError(400, `${name} must be an http(s) URL.`);
  return s;
};

function readFields(b, { partial }) {
  const out = {};
  const name = b.name;
  if (name !== undefined || !partial) {
    if (typeof name !== "string" || !name.trim()) throw new HttpError(400, "name is required.");
    out.name = name.trim();
  }
  for (const f of ["figmaFileKey", "storybookUrl", "reviewUrl"]) {
    const v = f === "figmaFileKey" ? optString(b[f], f) : httpUrl(b[f], f);
    if (v !== undefined) out[f] = v;
  }
  if (b.allowedOrigins !== undefined || !partial) {
    const o = b.allowedOrigins ?? [];
    if (!Array.isArray(o) || !o.every(isOrigin)) {
      throw new HttpError(400, "allowedOrigins must be a list of origins such as https://app.example.com (no path).");
    }
    out.allowedOrigins = o;
  }
  if (b.hasPreviewBuilds !== undefined || !partial) {
    const h = b.hasPreviewBuilds ?? false;
    if (typeof h !== "boolean") throw new HttpError(400, "hasPreviewBuilds must be true or false.");
    out.hasPreviewBuilds = h;
  }
  return out;
}

/** Admin routes: projects, tokens, members. Mount behind authenticate. */
export function projectsRouter(env) {
  const r = Router();

  // Users only; project-scoped routes below are admin only.
  r.use("/projects", (req, res, next) => {
    try {
      if (req.auth.kind !== "user") throw new HttpError(403, "Only an admin can do this.");
      next();
    } catch (e) { next(e); }
  });

  r.param("project", (req, res, next, key) => {
    (async () => {
      requireAdmin(req);
      req.project = await loadProject(req, env, key);
    })().then(() => next(), next);
  });

  r.get("/projects", wrap(async (req, res) => {
    const filter = { orgId: orgOf(req, env) };
    if (req.auth.user.role !== "admin") {
      filter._id = { $in: (req.auth.projectIds || []).map((id) => new mongoose.Types.ObjectId(id)) };
    }
    const rows = await Project.find(filter).sort({ key: 1 });
    // One aggregate for every listed project: counts of reviews per status.
    const grouped = await Review.aggregate([
      { $match: { projectId: { $in: rows.map((p) => p._id) } } },
      { $group: { _id: { projectId: "$projectId", status: "$status" }, n: { $sum: 1 } } },
    ]);
    const counts = new Map(rows.map((p) => [String(p._id), { pending: 0, answered: 0, applied: 0 }]));
    for (const g of grouped) {
      const c = counts.get(String(g._id.projectId));
      if (c && g._id.status in c) c[g._id.status] = g.n;
    }
    res.json(rows.map((p) => ({ ...projectView(p), counts: counts.get(String(p._id)) })));
  }));

  r.post("/projects", wrap(async (req, res) => {
    requireAdmin(req);
    const b = req.body || {};
    if (typeof b.key !== "string" || !KEY_RE.test(b.key)) {
      throw new HttpError(400, "key must be 2 to 40 characters: lowercase letters, digits and dashes.");
    }
    const fields = readFields(b, { partial: false });
    const orgId = orgOf(req, env);
    if (await Project.exists({ orgId, key: b.key })) throw new HttpError(409, "A project with this key already exists.");
    let project;
    try {
      project = await Project.create({ orgId, key: b.key, ...fields });
    } catch (e) {
      if (e.code === 11000) throw new HttpError(409, "A project with this key already exists.");
      throw e;
    }
    clearOriginCache(); // a new origin works at once, not after the 60 s cache
    res.status(201).json(projectView(project));
  }));

  r.patch("/projects/:project", wrap(async (req, res) => {
    const fields = readFields(req.body || {}, { partial: true });
    req.project.set(fields);
    await req.project.save();
    clearOriginCache();
    res.json(projectView(req.project));
  }));

  // Deleting a project is the one thing here that cannot be undone, so the caller must send the project's own key as `confirm`
  // (the dashboard asks the person to type it). The project goes last: if a step fails, the project still exists and the delete can be repeated.
  // Accounts are not deleted: a user belongs to the organisation, a project only lists who may open it.
  r.delete("/projects/:project", wrap(async (req, res) => {
    const confirm = (req.body || {}).confirm;
    if (confirm !== req.project.key) throw new HttpError(400, `To delete this project send its key "${req.project.key}" as confirm.`);
    const projectId = req.project._id;
    const deleted = {
      reviews: (await Review.deleteMany({ projectId })).deletedCount,
      tokens: (await Token.deleteMany({ projectId })).deletedCount,
      members: (await Membership.deleteMany({ projectId })).deletedCount,
    };
    await Project.deleteOne({ _id: projectId });
    clearOriginCache(); // its origins stop working at once
    res.json({ deleted });
  }));

  // The setup checklist needs only counts: one answer (four counts in parallel) instead of three lists.
  r.get("/projects/:project/overview", wrap(async (req, res) => {
    const base = { projectId: req.project._id, orgId: req.project.orgId };
    const [activeTokens, usedTokens, members, reviews] = await Promise.all([
      Token.countDocuments({ ...base, revokedAt: null }),
      Token.countDocuments({ ...base, revokedAt: null, lastUsedAt: { $ne: null } }),
      Membership.countDocuments({ projectId: req.project._id }),
      Review.countDocuments({ projectId: req.project._id }),
    ]);
    res.json({ activeTokens, usedTokens, members, reviews });
  }));

  r.get("/projects/:project/tokens", wrap(async (req, res) => {
    const rows = await Token.find({ projectId: req.project._id, orgId: req.project.orgId }).sort({ createdAt: 1 });
    res.json(rows.map((t) => ({
      id: String(t._id), label: t.label, createdAt: t.createdAt, lastUsedAt: t.lastUsedAt ?? null, revokedAt: t.revokedAt ?? null,
    })));
  }));

  r.post("/projects/:project/tokens", wrap(async (req, res) => {
    const label = (req.body || {}).label;
    if (typeof label !== "string" || !label.trim()) throw new HttpError(400, "label is required.");
    const { token, hash } = newProjectToken();
    const row = await Token.create({ orgId: req.project.orgId, projectId: req.project._id, label: label.trim(), hash });
    res.status(201).json({ id: String(row._id), label: row.label, token });
  }));

  r.delete("/projects/:project/tokens/:id", wrap(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(404, "No such token.");
    const row = await Token.findOne({ _id: req.params.id, projectId: req.project._id });
    if (!row) throw new HttpError(404, "No such token.");
    if (!row.revokedAt) { row.revokedAt = new Date(); await row.save(); }
    res.status(204).end();
  }));

  r.get("/projects/:project/members", wrap(async (req, res) => {
    const rows = await Membership.find({ projectId: req.project._id }, { userId: 1 }).lean();
    const users = await User.find({ _id: { $in: rows.map((m) => m.userId) }, orgId: req.project.orgId }).sort({ email: 1 });
    res.json(users.map((u) => ({ id: String(u._id), email: u.email, name: u.name })));
  }));

  r.post("/projects/:project/members", wrap(async (req, res) => {
    const { email, name } = req.body || {};
    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+$/.test(email.trim())) throw new HttpError(400, "A valid email is required.");
    if (typeof name !== "string" || !name.trim()) throw new HttpError(400, "name is required.");
    const orgId = req.project.orgId;
    const normalized = email.trim().toLowerCase();
    let user = await User.findOne({ orgId, email: normalized });
    let tempPassword;
    if (!user) {
      tempPassword = generatePassword();
      try {
        user = await User.create({
          orgId, email: normalized, name: name.trim(), role: "member",
          passwordHash: await hashPassword(tempPassword), mustChangePassword: true,
        });
      } catch (e) {
        if (e.code !== 11000) throw e;
        user = await User.findOne({ orgId, email: normalized }); // lost a race: use theirs, no password
        tempPassword = undefined;
      }
    }
    await Membership.updateOne(
      { userId: user._id, projectId: req.project._id },
      { $setOnInsert: { orgId, userId: user._id, projectId: req.project._id } },
      { upsert: true },
    );
    const view = userView(user);
    res.status(201).json({ user: { id: view.id, email: view.email, name: view.name, role: view.role }, ...(tempPassword ? { tempPassword } : {}) });
  }));

  // A member who never saw the temporary password (or lost it) gets a new one, shown once. The account must change it at the
  // next log in, and a session that is already open is locked until then. Only members of this project, never an admin account.
  r.post("/projects/:project/members/:userId/reset-password", wrap(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.userId)) throw new HttpError(404, "No such member.");
    const isMember = await Membership.exists({ userId: req.params.userId, projectId: req.project._id });
    const user = isMember ? await User.findOne({ _id: req.params.userId, orgId: req.project.orgId }) : null;
    if (!user) throw new HttpError(404, "No such member.");
    if (user.role === "admin") throw new HttpError(403, "An admin account is not reset here.");
    const tempPassword = generatePassword();
    user.passwordHash = await hashPassword(tempPassword);
    user.mustChangePassword = true;
    await user.save();
    const view = userView(user);
    res.json({ user: { id: view.id, email: view.email, name: view.name, role: view.role }, tempPassword });
  }));

  r.delete("/projects/:project/members/:userId", wrap(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.userId)) throw new HttpError(404, "No such member.");
    await Membership.deleteOne({ userId: req.params.userId, projectId: req.project._id });
    res.status(204).end();
  }));

  return r;
}
