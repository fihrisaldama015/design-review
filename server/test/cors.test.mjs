import { test, before, after, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { startDb, makeProject, ORG } from "./helpers.mjs";
import { connect } from "../src/db.mjs";
import { ensureIndexes } from "../src/models.mjs";
import { createApp } from "../src/app.mjs";
import { clearOriginCache } from "../src/cors.mjs";
import { restoreUrl, corsFallback } from "../../api/index.mjs";

const env = { SESSION_SECRET: "test-secret", MONGO_URL: "mongodb://unused", ORG_ID: ORG, WEB_ORIGIN: "https://web.example" };
let db, app;
before(async () => {
  db = await startDb();
  await connect(db.uri);
  await ensureIndexes();
  app = createApp({ env });
});
after(async () => { await db.stop(); });
beforeEach(() => clearOriginCache());

const preflight = (origin) =>
  request(app).options("/api/v1/me").set("Origin", origin).set("Access-Control-Request-Method", "GET");

test("preflight from a project origin is allowed", async () => {
  await makeProject({ allowedOrigins: ["https://app.example"] });
  const res = await preflight("https://app.example");
  assert.equal(res.status, 204);
  assert.equal(res.headers["access-control-allow-origin"], "https://app.example");
  assert.match(res.headers.vary, /Origin/);
  assert.equal(res.headers["access-control-allow-methods"], "GET,POST,PUT,PATCH,DELETE");
  assert.equal(res.headers["access-control-allow-headers"], "Authorization, Content-Type");
  assert.equal(res.headers["access-control-allow-credentials"], undefined);
});

test("preflight from an unknown origin has no Access-Control-Allow-Origin", async () => {
  const res = await preflight("https://evil.example");
  assert.equal(res.status, 204);
  assert.equal(res.headers["access-control-allow-origin"], undefined);
  assert.equal(res.headers["access-control-allow-methods"], undefined);
});

test("request without Origin passes", async () => {
  const res = await request(app).get("/api/v1/me");
  assert.equal(res.status, 401);
  assert.deepEqual(res.body, { error: "Log in first." });
  assert.equal(res.headers["access-control-allow-origin"], undefined);
});

test("preflight from WEB_ORIGIN is allowed", async () => {
  const res = await preflight("https://web.example");
  assert.equal(res.status, 204);
  assert.equal(res.headers["access-control-allow-origin"], "https://web.example");
});

test("a normal request from an allowed origin carries the CORS header", async () => {
  const res = await request(app).get("/api/v1/me").set("Origin", "https://web.example");
  assert.equal(res.status, 401);
  assert.equal(res.headers["access-control-allow-origin"], "https://web.example");
});

test("an origin added later is allowed after the cache is cleared", async () => {
  const origin = "https://later.example";
  assert.equal((await preflight(origin)).headers["access-control-allow-origin"], undefined);
  await makeProject({ allowedOrigins: [origin] });
  assert.equal((await preflight(origin)).headers["access-control-allow-origin"], undefined, "still cached");
  clearOriginCache();
  assert.equal((await preflight(origin)).headers["access-control-allow-origin"], origin);
});

test("an origin added later is allowed after the cache expires", async () => {
  const origin = "https://expiry.example";
  assert.equal((await preflight(origin)).headers["access-control-allow-origin"], undefined);
  await makeProject({ allowedOrigins: [origin] });
  const real = Date.now();
  const spy = mock.method(Date, "now", () => real + 61_000);
  try {
    assert.equal((await preflight(origin)).headers["access-control-allow-origin"], origin);
  } finally {
    spy.mock.restore();
  }
});

test("Origin: null gets no CORS headers", async () => {
  const res = await preflight("null");
  assert.equal(res.status, 204);
  assert.equal(res.headers["access-control-allow-origin"], undefined);
});

test("preflight to a nonexistent route is 204 without CORS headers for an unlisted origin", async () => {
  const res = await request(app).options("/api/v1/nope/at/all").set("Origin", "https://evil.example")
    .set("Access-Control-Request-Method", "GET");
  assert.equal(res.status, 204);
  assert.equal(res.headers["access-control-allow-origin"], undefined);
});

test("restoreUrl rebuilds the API path and keeps other query params", () => {
  assert.equal(restoreUrl("/api/index?path=me"), "/api/v1/me");
  assert.equal(restoreUrl("/api/index?path=projects/abc/reviews&slug=x&n=2"), "/api/v1/projects/abc/reviews?slug=x&n=2");
  assert.equal(restoreUrl("/api/index"), "/api/v1/");
  assert.equal(restoreUrl("/api/index?path=&a=1"), "/api/v1/?a=1");
});

test("restoreUrl does not double-decode or reshape the path", () => {
  assert.equal(restoreUrl("/api/index?path=a%2Fb"), "/api/v1/a/b", "an encoded slash is a separator after decoding");
  assert.equal(restoreUrl("/api/index?path=a%2Bb"), "/api/v1/a%2Bb");
  assert.equal(restoreUrl("/api/index?path=a%20b"), "/api/v1/a%20b");
  assert.equal(restoreUrl("/api/index?path=a+b"), "/api/v1/a%20b");
  assert.equal(restoreUrl("/api/index?path=a%3Fb%23c"), "/api/v1/a%3Fb%23c");
  assert.equal(restoreUrl("/api/index?path=x%3Fy/z&q=1"), "/api/v1/x%3Fy/z?q=1");
});

test("restoreUrl rejects dot segments (null, the handler answers 404)", () => {
  assert.equal(restoreUrl("/api/index?path=../x"), null);
  assert.equal(restoreUrl("/api/index?path=a/%2e%2e/b"), null);
  assert.equal(restoreUrl("/api/index?path=./a"), null);
});

test("restoreUrl passes an already-real /api/v1 url through unchanged, query included", () => {
  assert.equal(restoreUrl("/api/v1/me"), "/api/v1/me");
  assert.equal(restoreUrl("/api/v1/projects/p/reviews?x=1&y=a%20b"), "/api/v1/projects/p/reviews?x=1&y=a%20b");
  assert.equal(restoreUrl("/api/v1"), "/api/v1");
  // with a path parameter it is the rewrite shape and is rebuilt as before
  assert.equal(restoreUrl("/api/v1/x?path=me"), "/api/v1/me");
});

test("corsFallback allows only WEB_ORIGIN when the app never ran", () => {
  const set = {};
  const res = { setHeader: (k, v) => { set[k] = v; } };
  corsFallback({ headers: { origin: "https://evil.example" } }, res, { WEB_ORIGIN: "https://web.example" });
  assert.deepEqual(set, {});
  corsFallback({ headers: { origin: "https://web.example" } }, res, { WEB_ORIGIN: "https://web.example" });
  assert.equal(set["Access-Control-Allow-Origin"], "https://web.example");
});
