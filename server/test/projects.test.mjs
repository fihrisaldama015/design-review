import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { startDb, makeAdmin, makeProject, ORG } from "./helpers.mjs";
import { connect } from "../src/db.mjs";
import { ensureIndexes, User, Membership, Token } from "../src/models.mjs";
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
