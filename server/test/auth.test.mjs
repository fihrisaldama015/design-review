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
  assert.equal(wrong.status, 401);
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
