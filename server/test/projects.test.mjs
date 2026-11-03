import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { startDb, makeAdmin, makeProject, ORG } from "./helpers.mjs";
import { connect } from "../src/db.mjs";
import { ensureIndexes, User, Membership, Token, Review, Project } from "../src/models.mjs";
import { createApp } from "../src/app.mjs";
import { signSession, hashPassword, newProjectToken } from "../src/auth.mjs";

const env = { SESSION_SECRET: "test-secret", MONGO_URL: "mongodb://unused", ORG_ID: ORG };
let db, app;
before(async () => {
  db = await startDb();
  await connect(db.uri);
  await ensureIndexes();
  app = createApp({ env });
});
after(async () => { await db.stop(); });

const as = (user) => ({ Authorization: `Bearer ${signSession(user, env)}` });
let k = 0;
const makeMember = async () => {
  k += 1;
  return User.create({ orgId: ORG, email: `m${k}@x.io`, name: `M${k}`, role: "member", passwordHash: await hashPassword("password-12345") });
};
const body = (over = {}) => ({ key: `proj-${++k}`, name: "P", allowedOrigins: ["https://a.example.com"], hasPreviewBuilds: false, ...over });

test("admin creates a project", async () => {
  const admin = await makeAdmin();
  const b = body();
  const res = await request(app).post("/api/v1/projects").set(as(admin)).send(b);
  assert.equal(res.status, 201);
  assert.equal(res.body.key, b.key);
  assert.deepEqual(res.body.allowedOrigins, b.allowedOrigins);
  const patch = await request(app).patch(`/api/v1/projects/${b.key}`).set(as(admin)).send({ name: "Renamed" });
  assert.equal(patch.status, 200);
  assert.equal(patch.body.name, "Renamed");
  assert.equal(patch.body.key, b.key);
});

test("member cannot create a project (403)", async () => {
  const m = await makeMember();
  const res = await request(app).post("/api/v1/projects").set(as(m)).send(body());
  assert.equal(res.status, 403);
  assert.equal(res.body.error, "Only an admin can do this.");
});

test("tool token gets 403", async () => {
  const admin = await makeAdmin();
  const p = await makeProject();
  const { token, hash } = newProjectToken();
  await Token.create({ orgId: ORG, projectId: p._id, label: "t", hash });
  const res = await request(app).get("/api/v1/projects").set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 403);
  void admin;
});

test("duplicate project key is 409", async () => {
  const admin = await makeAdmin();
  const b = body();
  await request(app).post("/api/v1/projects").set(as(admin)).send(b);
  const res = await request(app).post("/api/v1/projects").set(as(admin)).send(b);
  assert.equal(res.status, 409);
});

test("invalid key is 400", async () => {
  const admin = await makeAdmin();
  const res = await request(app).post("/api/v1/projects").set(as(admin)).send(body({ key: "Bad Key" }));
  assert.equal(res.status, 400);
});

test("allowedOrigins with a path is 400", async () => {
  const admin = await makeAdmin();
  const res = await request(app).post("/api/v1/projects").set(as(admin))
    .send(body({ allowedOrigins: ["https://a.example.com/path"] }));
  assert.equal(res.status, 400);
});

test("a member sees only their projects", async () => {
  const admin = await makeAdmin();
  const m = await makeMember();
  const mine = await makeProject();
  const other = await makeProject();
  await Membership.create({ orgId: ORG, userId: m._id, projectId: mine._id });
  const res = await request(app).get("/api/v1/projects").set(as(m));
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.map((p) => p.key), [mine.key]);
  const all = await request(app).get("/api/v1/projects").set(as(admin));
  const keys = all.body.map((p) => p.key);
  assert.ok(keys.includes(mine.key) && keys.includes(other.key));
});

test("a project in another org is 404", async () => {
  const admin = await makeAdmin();
  const foreign = await makeProject({ orgId: "other-org" });
  const res = await request(app).patch(`/api/v1/projects/${foreign.key}`).set(as(admin)).send({ name: "x" });
  assert.equal(res.status, 404);
  const t = await request(app).get(`/api/v1/projects/${foreign.key}/tokens`).set(as(admin));
  assert.equal(t.status, 404);
});

test("token is returned once and listed without hash", async () => {
  const admin = await makeAdmin();
  const p = await makeProject();
  const created = await request(app).post(`/api/v1/projects/${p.key}/tokens`).set(as(admin)).send({ label: "ci" });
  assert.equal(created.status, 201);
  assert.match(created.body.token, /^drp_/);
  assert.equal(created.body.label, "ci");
  const list = await request(app).get(`/api/v1/projects/${p.key}/tokens`).set(as(admin));
  assert.equal(list.status, 200);
  assert.equal(list.body.length, 1);
  assert.equal(list.body[0].id, created.body.id);
  assert.equal(list.body[0].revokedAt, null);
  const text = JSON.stringify(list.body);
  assert.ok(!text.includes("hash") && !text.includes(created.body.token));
});

test("DELETE token sets revokedAt", async () => {
  const admin = await makeAdmin();
  const p = await makeProject();
  const created = await request(app).post(`/api/v1/projects/${p.key}/tokens`).set(as(admin)).send({ label: "x" });
  const del = await request(app).delete(`/api/v1/projects/${p.key}/tokens/${created.body.id}`).set(as(admin));
  assert.equal(del.status, 204);
  const list = await request(app).get(`/api/v1/projects/${p.key}/tokens`).set(as(admin));
  assert.ok(list.body[0].revokedAt);
});

test("adding a member twice keeps one membership and no new tempPassword", async () => {
  const admin = await makeAdmin();
  const p = await makeProject();
  const first = await request(app).post(`/api/v1/projects/${p.key}/members`).set(as(admin))
    .send({ email: " New.Person@X.io ", name: "New" });
  assert.equal(first.status, 201);
  assert.equal(first.body.user.email, "new.person@x.io");
  assert.match(first.body.tempPassword, /^[^0O1lI]{14}$/);
  assert.ok(!JSON.stringify(first.body).includes("passwordHash"));
  const u = await User.findOne({ orgId: ORG, email: "new.person@x.io" });
  assert.equal(u.mustChangePassword, true);
  assert.equal(u.role, "member");
  const second = await request(app).post(`/api/v1/projects/${p.key}/members`).set(as(admin))
    .send({ email: "new.person@x.io", name: "New" });
  assert.equal(second.status, 201);
  assert.equal(second.body.tempPassword, undefined);
  assert.equal(await Membership.countDocuments({ userId: u._id, projectId: p._id }), 1);
  const list = await request(app).get(`/api/v1/projects/${p.key}/members`).set(as(admin));
  assert.deepEqual(list.body, [{ id: String(u._id), email: "new.person@x.io", name: "New" }]);
  const del = await request(app).delete(`/api/v1/projects/${p.key}/members/${u._id}`).set(as(admin));
  assert.equal(del.status, 204);
  assert.equal(await Membership.countDocuments({ userId: u._id }), 0);
});

test("reviewUrl and storybookUrl must be http(s) URLs; null or empty clears them", async () => {
  const admin = await makeAdmin();
  for (const field of ["reviewUrl", "storybookUrl"]) {
    const bad = await request(app).post("/api/v1/projects").set(as(admin)).send(body({ [field]: "javascript:alert(1)" }));
    assert.equal(bad.status, 400);
    assert.equal(bad.body.error, `${field} must be an http(s) URL.`);
  }
  const created = await request(app).post("/api/v1/projects").set(as(admin))
    .send(body({ reviewUrl: "https://app.example.com/review", storybookUrl: "http://localhost:6006" }));
  assert.equal(created.status, 201);
  for (const field of ["reviewUrl", "storybookUrl"]) {
    const bad = await request(app).patch(`/api/v1/projects/${created.body.key}`).set(as(admin)).send({ [field]: "javascript:alert(1)" });
    assert.equal(bad.status, 400);
    assert.equal(bad.body.error, `${field} must be an http(s) URL.`);
  }
  const cleared = await request(app).patch(`/api/v1/projects/${created.body.key}`).set(as(admin)).send({ reviewUrl: null, storybookUrl: "" });
  assert.equal(cleared.status, 200);
  assert.ok(!cleared.body.reviewUrl);
  assert.ok(!cleared.body.storybookUrl);
});

test("an origin added by create or PATCH works at once (origin cache cleared)", async () => {
  const { allowedOrigins } = await import("../src/cors.mjs");
  const admin = await makeAdmin();
  const e = { ...env, MONGO_URL: "mongodb://unused" };
  await allowedOrigins(e); // fills the cache
  const b = body({ allowedOrigins: ["https://fresh-one.example.com"] });
  await request(app).post("/api/v1/projects").set(as(admin)).send(b).expect(201);
  assert.ok((await allowedOrigins(e)).has("https://fresh-one.example.com"));
  await request(app).patch(`/api/v1/projects/${b.key}`).set(as(admin)).send({ allowedOrigins: ["https://fresh-two.example.com"] }).expect(200);
  assert.ok((await allowedOrigins(e)).has("https://fresh-two.example.com"));
});

const mkReview = (p, slug, status) => Review.create({ orgId: ORG, projectId: p._id, slug, component: slug, status });

test("project list carries counts per project and 0 when there are no reviews", async () => {
  const admin = await makeAdmin();
  const busy = await makeProject();
  const empty = await makeProject();
  await mkReview(busy, "a", "pending");
  await mkReview(busy, "b", "pending");
  await mkReview(busy, "c", "answered");
  await mkReview(busy, "d", "applied");
  const res = await request(app).get("/api/v1/projects").set(as(admin));
  const by = Object.fromEntries(res.body.map((p) => [p.key, p.counts]));
  assert.deepEqual(by[busy.key], { pending: 2, answered: 1, applied: 1 });
  assert.deepEqual(by[empty.key], { pending: 0, answered: 0, applied: 0 });
});

test("a member only gets counts for the projects they belong to", async () => {
  const m = await makeMember();
  const mine = await makeProject();
  const other = await makeProject();
  await Membership.create({ orgId: ORG, userId: m._id, projectId: mine._id });
  await mkReview(mine, "a", "pending");
  await mkReview(other, "a", "pending");
  const res = await request(app).get("/api/v1/projects").set(as(m));
  assert.deepEqual(res.body.map((p) => p.key), [mine.key]);
  assert.deepEqual(res.body[0].counts, { pending: 1, answered: 0, applied: 0 });
});

test("create and patch responses have no counts", async () => {
  const admin = await makeAdmin();
  const b = body();
  const created = await request(app).post("/api/v1/projects").set(as(admin)).send(b);
  assert.equal("counts" in created.body, false);
  const patched = await request(app).patch(`/api/v1/projects/${b.key}`).set(as(admin)).send({ name: "N" });
  assert.equal("counts" in patched.body, false);
});

test("overview counts active and used tokens, members and reviews in one answer", async () => {
  const admin = await makeAdmin();
  const p = await makeProject();
  const empty = await request(app).get(`/api/v1/projects/${p.key}/overview`).set(as(admin));
  assert.equal(empty.status, 200);
  assert.deepEqual(empty.body, { activeTokens: 0, usedTokens: 0, members: 0, reviews: 0 });

  const a = await request(app).post(`/api/v1/projects/${p.key}/tokens`).set(as(admin)).send({ label: "a" });
  const b = await request(app).post(`/api/v1/projects/${p.key}/tokens`).set(as(admin)).send({ label: "b" });
  const c = await request(app).post(`/api/v1/projects/${p.key}/tokens`).set(as(admin)).send({ label: "c" });
  await Token.updateOne({ _id: a.body.id }, { lastUsedAt: new Date() });
  await Token.updateOne({ _id: b.body.id }, { lastUsedAt: new Date() });
  await request(app).delete(`/api/v1/projects/${p.key}/tokens/${b.body.id}`).set(as(admin)); // revoked: neither active nor used
  const m = await makeMember();
  await Membership.create({ orgId: ORG, userId: m._id, projectId: p._id });
  await mkReview(p, "button", "pending");
  await mkReview(p, "select", "applied");

  const res = await request(app).get(`/api/v1/projects/${p.key}/overview`).set(as(admin));
  assert.deepEqual(res.body, { activeTokens: 2, usedTokens: 1, members: 1, reviews: 2 });
  assert.ok(c.body.id);
});

test("overview does not count another project's rows, and is admin only", async () => {
  const admin = await makeAdmin();
  const mine = await makeProject();
  const other = await makeProject();
  await request(app).post(`/api/v1/projects/${other.key}/tokens`).set(as(admin)).send({ label: "x" });
  await mkReview(other, "alert", "pending");
  const res = await request(app).get(`/api/v1/projects/${mine.key}/overview`).set(as(admin));
  assert.deepEqual(res.body, { activeTokens: 0, usedTokens: 0, members: 0, reviews: 0 });

  const member = await makeMember();
  await Membership.create({ orgId: ORG, userId: member._id, projectId: mine._id });
  assert.equal((await request(app).get(`/api/v1/projects/${mine.key}/overview`).set(as(member))).status, 403);
  assert.equal((await request(app).get(`/api/v1/projects/${mine.key}/overview`)).status, 401);
  const foreign = await makeProject({ orgId: "other-org" });
  assert.equal((await request(app).get(`/api/v1/projects/${foreign.key}/overview`).set(as(admin))).status, 404);
});

test("reset-password gives a member a new temporary password: the old one stops working and the account must change it", async () => {
  const admin = await makeAdmin();
  const p = (await request(app).post("/api/v1/projects").set(as(admin)).send(body())).body;
  const added = await request(app).post(`/api/v1/projects/${p.key}/members`).set(as(admin)).send({ email: "lost@x.io", name: "Lost" });
  const first = added.body.tempPassword;
  const id = added.body.user.id;
  const oldSession = { Authorization: `Bearer ${signSession(await User.findById(id), env)}` };
  const reset = await request(app).post(`/api/v1/projects/${p.key}/members/${id}/reset-password`).set(as(admin));
  assert.equal(reset.status, 200);
  assert.equal(reset.body.user.email, "lost@x.io");
  assert.ok(reset.body.tempPassword && reset.body.tempPassword !== first);
  assert.equal(reset.body.user.passwordHash, undefined);
  const oldLogin = await request(app).post("/api/v1/auth/login").send({ email: "lost@x.io", password: first });
  assert.equal(oldLogin.status, 401);
  const newLogin = await request(app).post("/api/v1/auth/login").send({ email: "lost@x.io", password: reset.body.tempPassword });
  assert.equal(newLogin.status, 200);
  assert.equal(newLogin.body.user.mustChangePassword, true);
  const locked = await request(app).get(`/api/v1/projects/${p.key}/reviews`).set(oldSession);
  assert.equal(locked.status, 403);
});

test("reset-password refuses a non-member, an admin account, a bad id and a reviewer asking for it", async () => {
  const admin = await makeAdmin();
  const other = await makeAdmin();
  const p = (await request(app).post("/api/v1/projects").set(as(admin)).send(body())).body;
  const outsider = await makeMember();
  const url = (id) => `/api/v1/projects/${p.key}/members/${id}/reset-password`;
  assert.equal((await request(app).post(url(outsider._id)).set(as(admin))).status, 404);
  assert.equal((await request(app).post(url("nope")).set(as(admin))).status, 404);
  await Membership.create({ orgId: ORG, userId: other._id, projectId: (await Project.findOne({ key: p.key }))._id });
  assert.equal((await request(app).post(url(other._id)).set(as(admin))).status, 403);
  const member = await makeMember();
  await request(app).post(`/api/v1/projects/${p.key}/members`).set(as(admin)).send({ email: member.email, name: member.name });
  assert.equal((await request(app).post(url(member._id)).set(as(member))).status, 403);
  const before = await User.findById(member._id);
  assert.equal(before.mustChangePassword, false);
});
