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

let k = 0;
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const sess = (u) => bearer(signSession(u, env));
const makeMember = async (project, fields = {}) => {
  k += 1;
  const u = await User.create({ orgId: ORG, email: `rv${k}@x.io`, name: `Rev ${k}`, role: "member", passwordHash: await hashPassword("password-12345"), ...fields });
  if (project) await Membership.create({ orgId: ORG, userId: u._id, projectId: project._id });
  return u;
};
const makeTool = async (project) => {
  const { token, hash } = newProjectToken();
  const row = await Token.create({ orgId: ORG, projectId: project._id, label: "t", hash });
  return { token, row };
};
const items = [
  { id: "removed-prop:searchable", kind: "removed-prop", name: "searchable" },
  { id: "added-prop:size", kind: "added-prop", name: "size" },
];
const pub = (over = {}) => ({ component: "Select", sourceHash: "h1", items, ...over });
const url = (p, slug = "select", tail = "") => `/api/v1/projects/${p.key}/reviews/${slug}${tail}`;
const put = (p, t, b = pub(), slug = "select") => request(app).put(url(p, slug)).set(bearer(t)).send(b);

test("publish with token then reviewer reads it", async () => {
  const p = await makeProject();
  const { token } = await makeTool(p);
  const rev = await makeMember(p);
  const res = await put(p, token);
  assert.equal(res.status, 201);
  assert.equal(res.headers["cache-control"], "no-store");
  const get = await request(app).get(url(p)).set(sess(rev));
  assert.equal(get.status, 200);
  assert.equal(get.body.component, "Select");
  assert.equal(get.body.version, 1);
  for (const f of ["_id", "__v", "projectId", "orgId"]) assert.equal(f in get.body, false);
  const list = await request(app).get(`/api/v1/projects/${p.key}/reviews`).set(sess(rev));
  assert.equal(list.body.reviews.length, 1);
  assert.equal(list.body.reviews[0].unanswered, 1);
  assert.equal(list.body.counts.pending, 1);
});

test("token of project A cannot publish to B (403)", async () => {
  const a = await makeProject(), b = await makeProject();
  const { token } = await makeTool(a);
  const res = await put(b, token);
  assert.equal(res.status, 403);
  assert.equal(res.body.error, "No access to this project.");
  const rev = await makeMember(null);
  assert.equal((await request(app).get(url(b)).set(sess(await makeAdmin()))).status, 404);
  void rev;
});

test("revoked token is 401", async () => {
  const p = await makeProject();
  const { token, row } = await makeTool(p);
  row.revokedAt = new Date(); await row.save();
  assert.equal((await put(p, token)).status, 401);
});

test("member without membership is 403", async () => {
  const p = await makeProject();
  const stranger = await makeMember(null);
  const res = await request(app).get(`/api/v1/projects/${p.key}/reviews`).set(sess(stranger));
  assert.equal(res.status, 403);
  assert.equal(res.body.error, "No access to this project.");
});

test("PUT slug must match the component", async () => {
  const p = await makeProject();
  const { token } = await makeTool(p);
  const res = await put(p, token, pub(), "other");
  assert.equal(res.status, 400);
  assert.equal(res.body.error, "component must be set and its slug must equal the URL.");
});

test("reviewer cannot publish or apply, tool cannot decide", async () => {
  const p = await makeProject();
  const { token } = await makeTool(p);
  const rev = await makeMember(p);
  await put(p, token);
  const pu = await request(app).put(url(p)).set(sess(rev)).send(pub());
  assert.equal(pu.status, 403);
  assert.equal(pu.body.error, "Only the project token can publish a review.");
  const ap = await request(app).post(url(p, "select", "/applied")).set(sess(rev));
  assert.equal(ap.status, 403);
  assert.match(ap.body.error, /^Only the project token can/);
  const de = await request(app).post(url(p, "select", "/decision")).set(bearer(token)).send({ version: 1, answers: {} });
  assert.equal(de.status, 403);
});

test("decision records by from the session, ignores body.reviewer", async () => {
  const p = await makeProject();
  const { token } = await makeTool(p);
  const rev = await makeMember(p, { name: "Dina" });
  await put(p, token);
  const res = await request(app).post(url(p, "select", "/decision")).set(sess(rev))
    .send({ version: 1, reviewer: "Mallory", answers: { "removed-prop:searchable": "follow-figma" } });
  assert.equal(res.status, 200);
  assert.equal(res.body.status, "answered");
  assert.equal(res.body.version, 2);
  const last = res.body.audit.at(-1);
  assert.equal(last.by, "Dina");
  assert.equal(last.action, "decided");
});

test("decision edge cases: unknown slug 404, keep-deprecated needs date, applied refuses", async () => {
  const p = await makeProject();
  const { token } = await makeTool(p);
  const rev = await makeMember(p);
  const dec = (slug, b) => request(app).post(url(p, slug, "/decision")).set(sess(rev)).send(b);
  assert.equal((await dec("nope", { version: 1, answers: {} })).status, 404);
  await put(p, token);
  const kd = await dec("select", { version: 1, answers: { "removed-prop:searchable": "keep-deprecated" } });
  assert.equal(kd.status, 400);
  assert.match(kd.body.error, /migrate-by/);
  assert.equal((await dec("select", { version: 1, answers: { "removed-prop:searchable": "keep" } })).status, 200);
  const ap = await request(app).post(url(p, "select", "/applied")).set(bearer(token));
  assert.equal(ap.status, 200);
  assert.equal(ap.body.status, "applied");
  const after = await dec("select", { version: ap.body.version, answers: { "removed-prop:searchable": "follow-figma" } });
  assert.equal(after.status, 409);
  assert.equal(after.body.error, "This review was already applied.");
});

test("concurrent decisions: one 409", async () => {
  const p = await makeProject();
  const { token } = await makeTool(p);
  const dina = signSession(await makeMember(p), env), rudi = signSession(await makeMember(p), env);
  await put(p, token);
  const send = (t) => request(app).post(url(p, "select", "/decision")).set("Authorization", `Bearer ${t}`)
    .send({ version: 1, answers: { "removed-prop:searchable": "follow-figma" } });
  const rs = await Promise.all([send(dina), send(rudi)]);
  assert.deepEqual(rs.map((r) => r.status).sort(), [200, 409]);
  const lose = rs.find((r) => r.status === 409);
  assert.equal(lose.body.error, "Someone else changed this review. Reload and check before saving.");
  assert.equal(lose.body.current.version, 2);
});

test("history lists published and decided, newest first", async () => {
  const p = await makeProject();
  const { token } = await makeTool(p);
  const rev = await makeMember(p, { name: "Dina" });
  await put(p, token);
  await new Promise((r) => setTimeout(r, 5));
  await request(app).post(url(p, "select", "/decision")).set(sess(rev)).send({ version: 1, answers: { "removed-prop:searchable": "keep" } });
  const res = await request(app).get(`/api/v1/projects/${p.key}/history`).set(sess(rev));
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.map((e) => e.action), ["decided", "published"]);
  assert.equal(res.body[0].by, "Dina");
  assert.equal(res.body[0].component, "Select");
  assert.deepEqual(res.body[0].changes, { "removed-prop:searchable": "keep" });
  assert.equal(res.body[1].by, "tool");
});

test("applied needs an answered review and applies once", async () => {
  const p = await makeProject();
  const { token } = await makeTool(p);
  const rev = await makeMember(p);
  const apply = () => request(app).post(url(p, "select", "/applied")).set(bearer(token));
  await put(p, token);
  const early = await apply();
  assert.equal(early.status, 409);
  assert.equal(early.body.error, "The reviewers have not answered every removal yet.");
  await request(app).post(url(p, "select", "/decision")).set(sess(rev)).send({ version: 1, answers: { "removed-prop:searchable": "keep" } });
  assert.equal((await apply()).status, 200);
  const again = await apply();
  assert.equal(again.status, 409);
  assert.equal(again.body.error, "This review was already applied.");
});

test("PUT validates items: no 500 for malformed entries", async () => {
  const p = await makeProject();
  const { token } = await makeTool(p);
  for (const bad of [[1], [{ id: "a" }], [null], "x"]) {
    const res = await put(p, token, pub({ items: bad }));
    assert.equal(res.status, 400);
    assert.equal(res.body.error, "items must be an array of { id, kind, ... }.");
  }
});

test("long reviewer name is truncated, not rejected", async () => {
  const p = await makeProject();
  const { token } = await makeTool(p);
  const rev = await makeMember(p, { name: "N".repeat(120) });
  await put(p, token);
  const res = await request(app).post(url(p, "select", "/decision")).set(sess(rev)).send({ version: 1, answers: { "removed-prop:searchable": "keep" } });
  assert.equal(res.status, 200);
  assert.equal(res.body.audit.at(-1).by.length, 80);
});

// A same-hash republish keeps `version`; the audit length in the write filter must still stop lost updates.
// Racing is not deterministic, so assert the invariant over many rounds: every success left exactly one audit entry.
test("racing writes never lose an audit entry (same-hash republish vs decision, and two republishes)", async () => {
  const p = await makeProject();
  const { token } = await makeTool(p);
  const rev = await makeMember(p);
  let conflicts = 0;
  for (let i = 0; i < 12; i++) {
    const slug = `race-${i}`;
    const body = pub({ component: slug });
    await put(p, token, body, slug);
    const first = i % 2 === 0
      ? [put(p, token, body, slug), request(app).post(url(p, slug, "/decision")).set(sess(rev)).send({ version: 1, answers: { "removed-prop:searchable": "keep" } })]
      : [put(p, token, body, slug), put(p, token, body, slug)];
    const rs = await Promise.all(first);
    const ok = rs.filter((r) => r.status < 300).length;
    conflicts += rs.filter((r) => r.status === 409).length;
    assert.ok(rs.every((r) => r.status < 300 || r.status === 409), JSON.stringify(rs.map((r) => r.status)));
    const doc = (await request(app).get(url(p, slug)).set(sess(rev))).body;
    assert.equal(doc.audit.length, 1 + ok, `round ${i}: ${rs.map((r) => r.status)}`);
  }
  void conflicts;
});
