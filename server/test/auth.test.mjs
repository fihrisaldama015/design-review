import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { startDb, makeAdmin, ORG } from "./helpers.mjs";
import { connect } from "../src/db.mjs";
import { ensureIndexes, User } from "../src/models.mjs";
import { createApp } from "../src/app.mjs";

const env = { SESSION_SECRET: "test-secret", MONGO_URL: "mongodb://unused", ORG_ID: ORG };
let db, app;
before(async () => {
  db = await startDb();
  await connect(db.uri);
  await ensureIndexes();
  app = createApp({ env });
});
after(async () => { await db.stop(); });

const login = (email, password = "password-12345") =>
  request(app).post("/api/v1/auth/login").send({ email, password });

test("login returns a token", async () => {
  const u = await makeAdmin();
  const res = await login(u.email);
  assert.equal(res.status, 200);
  assert.ok(res.body.token);
  assert.deepEqual(res.body.user, {
    id: String(u._id), email: u.email, name: u.name, role: "admin", mustChangePassword: false,
  });
  const me = await request(app).get("/api/v1/me").set("Authorization", `Bearer ${res.body.token}`);
  assert.equal(me.status, 200);
  assert.equal(me.body.email, u.email);
});

test("login is case-insensitive on the email", async () => {
  const u = await makeAdmin({ email: "  Mixed.Case@X.io " });
  assert.equal(u.email, "mixed.case@x.io");
  const res = await login("MIXED.case@x.IO");
  assert.equal(res.status, 200);
});

test("wrong password is 401", async () => {
  const u = await makeAdmin();
  const res = await login(u.email, "nope");
  assert.equal(res.status, 401);
  assert.equal(res.body.error, "Wrong email or password.");
  const unknown = await login("nobody@x.io");
  assert.equal(unknown.status, 401);
  assert.equal(unknown.body.error, "Wrong email or password.");
});

test("mustChangePassword blocks /projects with 403", async () => {
  const u = await makeAdmin({ mustChangePassword: true });
  const { body } = await login(u.email);
  const res = await request(app).get("/api/v1/projects").set("Authorization", `Bearer ${body.token}`);
  assert.equal(res.status, 403);
  assert.equal(res.body.error, "Change your password first.");
  const me = await request(app).get("/api/v1/me").set("Authorization", `Bearer ${body.token}`);
  assert.equal(me.status, 200);
});

test("password change clears mustChangePassword", async () => {
  const u = await makeAdmin({ mustChangePassword: true });
  const { body } = await login(u.email);
  const auth = ["Authorization", `Bearer ${body.token}`];
  const short = await request(app).post("/api/v1/auth/password").set(...auth)
    .send({ current: "password-12345", next: "short" });
  assert.equal(short.status, 400);
  const wrong = await request(app).post("/api/v1/auth/password").set(...auth)
    .send({ current: "bad", next: "a-new-password-1" });
  assert.equal(wrong.status, 400);
  assert.equal(wrong.body.error, "Wrong current password.");
  const ok = await request(app).post("/api/v1/auth/password").set(...auth)
    .send({ current: "password-12345", next: "a-new-password-1" });
  assert.equal(ok.status, 204);
  const fresh = await User.findById(u._id);
  assert.equal(fresh.mustChangePassword, false);
  assert.ok(await bcrypt.compare("a-new-password-1", fresh.passwordHash));
  const again = await login(u.email, "a-new-password-1");
  assert.equal(again.status, 200);
  assert.equal(again.body.user.mustChangePassword, false);
});

test("expired session is 401", async () => {
  const u = await makeAdmin();
  const token = jwt.sign({ sub: String(u._id), org: ORG }, env.SESSION_SECRET, { expiresIn: -1 });
  const res = await request(app).get("/api/v1/me").set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 401);
  assert.equal(res.body.error, "Your session expired. Log in again.");
});

test("missing bearer is 401 and unknown route is 404", async () => {
  const res = await request(app).get("/api/v1/me");
  assert.equal(res.status, 401);
  assert.equal(res.body.error, "Log in first.");
  const u = await makeAdmin();
  const { body } = await login(u.email);
  const nf = await request(app).get("/api/v1/nothing").set("Authorization", `Bearer ${body.token}`);
  assert.equal(nf.status, 404);
  assert.equal(nf.body.error, "No such route.");
});

test("no SESSION_SECRET is 503", async () => {
  const bare = createApp({ env: { MONGO_URL: "mongodb://unused" } });
  const res = await request(bare).post("/api/v1/auth/login").send({ email: "a@x.io", password: "x" });
  assert.equal(res.status, 503);
  assert.match(res.body.error, /not configured/);
  const none = await request(createApp({ env: {} })).get("/api/v1/me");
  assert.equal(none.status, 503);
});

// ---- review fixes ----
import { mock } from "node:test";
import mongoose from "mongoose";
import { Token, Membership } from "../src/models.mjs";
import { newProjectToken, canUseProject } from "../src/auth.mjs";
import { makeProject } from "./helpers.mjs";

const bearer = (t) => ["Authorization", `Bearer ${t}`];

test("valid project token authenticates and updates lastUsedAt", async () => {
  const project = await makeProject();
  const { token, hash } = newProjectToken();
  const doc = await Token.create({ orgId: ORG, projectId: project._id, hash });
  const probe = createApp({ env });
  // reach authenticate through the real app: an authenticated unknown route is 404, not 401
  const res = await request(probe).get("/api/v1/nothing").set(...bearer(token));
  assert.equal(res.status, 404);
  const after = await Token.findById(doc._id);
  assert.ok(after.lastUsedAt);
  const me = await request(probe).get("/api/v1/me").set(...bearer(token));
  assert.equal(me.status, 403);
});

test("revoked token is 401", async () => {
  const project = await makeProject();
  const { token, hash } = newProjectToken();
  await Token.create({ orgId: ORG, projectId: project._id, hash, revokedAt: new Date() });
  const res = await request(app).get("/api/v1/nothing").set(...bearer(token));
  assert.equal(res.status, 401);
  assert.equal(res.body.error, "Unknown or revoked project token.");
  const unknown = await request(app).get("/api/v1/nothing").set(...bearer("drp_unknown"));
  assert.equal(unknown.status, 401);
});

test("deleted user's JWT is 401", async () => {
  const u = await makeAdmin();
  const { body } = await login(u.email);
  await User.deleteOne({ _id: u._id });
  const res = await request(app).get("/api/v1/me").set(...bearer(body.token));
  assert.equal(res.status, 401);
});

test("alg none and foreign-secret tokens are 401", async () => {
  const u = await makeAdmin();
  const claims = { sub: String(u._id), org: ORG };
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const none = `${b64({ alg: "none", typ: "JWT" })}.${b64(claims)}.`;
  const other = jwt.sign(claims, "another-secret", { algorithm: "HS256", expiresIn: "1h" });
  for (const t of [none, other]) {
    const res = await request(app).get("/api/v1/me").set(...bearer(t));
    assert.equal(res.status, 401);
  }
});

test("valid JWT with a non-ObjectId sub is 401", async () => {
  const token = jwt.sign({ sub: "not-an-id", org: ORG }, env.SESSION_SECRET, { algorithm: "HS256", expiresIn: "1h" });
  const res = await request(app).get("/api/v1/me").set(...bearer(token));
  assert.equal(res.status, 401);
});

test("invalid JSON is 400 and oversized body is 400", async () => {
  const bad = await request(app).post("/api/v1/auth/login")
    .set("Content-Type", "application/json").send("{not json");
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error, "Body is not valid JSON.");
  const big = await request(app).post("/api/v1/auth/login")
    .set("Content-Type", "application/json").send(JSON.stringify({ email: "x".repeat(1024 * 1024 + 10) }));
  assert.equal(big.status, 400);
  assert.equal(big.body.error, "Body is too large (1mb max).");
});

test("a Mongo network error is 502", async () => {
  const stub = mock.method(User, "findOne", () => {
    const e = new Error("connection lost");
    e.name = "MongoNetworkError";
    throw e;
  });
  try {
    const res = await login("a@x.io");
    assert.equal(res.status, 502);
    assert.equal(res.body.error, "The store failed: connection lost");
  } finally {
    stub.mock.restore();
  }
});

test("canUseProject: tool, admin, member, non-member", async () => {
  const [pa, pb] = [await makeProject(), await makeProject()];
  const tool = { kind: "tool", projectId: String(pa._id), orgId: ORG };
  assert.equal(canUseProject(tool, pa), true);
  assert.equal(canUseProject(tool, pb), false);
  const admin = await makeAdmin();
  assert.equal(canUseProject({ kind: "user", user: admin }, pb), true);
  const member = await User.create({ orgId: ORG, email: "m@x.io", role: "member", passwordHash: "h" });
  await Membership.create({ orgId: ORG, userId: member._id, projectId: pa._id });
  // go through authenticate so projectIds is preloaded
  const token = jwt.sign({ sub: String(member._id), org: ORG }, env.SESSION_SECRET, { algorithm: "HS256", expiresIn: "1h" });
  const { authenticate } = await import("../src/auth.mjs");
  const req = { get: () => `Bearer ${token}`, path: "/x" };
  await new Promise((resolve, reject) => authenticate(env)(req, {}, (e) => (e ? reject(e) : resolve())));
  assert.deepEqual(req.auth.projectIds, [String(pa._id)]);
  assert.equal(canUseProject(req.auth, pa), true);
  assert.equal(canUseProject(req.auth, pb), false);
});

test("tool auth carries orgId", async () => {
  const project = await makeProject();
  const { token, hash } = newProjectToken();
  await Token.create({ orgId: ORG, projectId: project._id, hash });
  const { authenticate } = await import("../src/auth.mjs");
  const req = { get: () => `Bearer ${token}`, path: "/x" };
  await new Promise((resolve, reject) => authenticate(env)(req, {}, (e) => (e ? reject(e) : resolve())));
  assert.equal(req.auth.orgId, ORG);
  assert.equal(req.auth.projectId, String(project._id));
});

test("a bearer that is neither drp_ nor JWT-shaped is a project token problem, not an expired session", async () => {
  for (const t of ["old-api-key-123", "a.b", "a.b.c.d"]) {
    const res = await request(app).get("/api/v1/me").set(...bearer(t));
    assert.equal(res.status, 401, t);
    assert.equal(res.body.error, "Unknown or revoked project token.", t);
  }
});

test("a well-formed but invalid JWT keeps the session expired text", async () => {
  const other = jwt.sign({ sub: "x", org: ORG }, "another-secret", { algorithm: "HS256", expiresIn: "1h" });
  const res = await request(app).get("/api/v1/me").set(...bearer(other));
  assert.equal(res.status, 401);
  assert.equal(res.body.error, "Your session expired. Log in again.");
});

test("a DB failure is a 502 that still carries the CORS headers of the request", async () => {
  const web = createApp({ env: { ...env, WEB_ORIGIN: "https://web.example" } });
  const u = await makeAdmin();
  const { body } = await login(u.email);
  const m = mock.method(User, "findOne", () => { throw Object.assign(new Error("server selection timed out"), { name: "MongoServerSelectionError" }); });
  try {
    const res = await request(web).get("/api/v1/me").set(...bearer(body.token)).set("Origin", "https://web.example");
    assert.equal(res.status, 502);
    assert.match(res.body.error, /The store failed: server selection timed out/);
    assert.equal(res.headers["access-control-allow-origin"], "https://web.example");
  } finally { m.mock.restore(); }
});
