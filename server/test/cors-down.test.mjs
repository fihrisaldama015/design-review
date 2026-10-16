import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../src/app.mjs";
import { clearOriginCache } from "../src/cors.mjs";

// Mongoose is never connected in this file: the DB is "down".
const env = { SESSION_SECRET: "s", MONGO_URL: "mongodb://127.0.0.1:1", WEB_ORIGIN: "https://web.example" };
const app = createApp({ env });

test("DB down: unknown origin gets the app's own response, promptly, without ACAO", async () => {
  clearOriginCache();
  const t = Date.now();
  const res = await request(app).get("/api/v1/me").set("Origin", "https://evil.example");
  assert.ok(Date.now() - t < 2000, "no buffering delay");
  assert.equal(res.status, 401);
  assert.equal(res.headers["access-control-allow-origin"], undefined);
});

test("DB down: WEB_ORIGIN is still allowed and preflight is 204", async () => {
  clearOriginCache();
  const res = await request(app).options("/api/v1/me").set("Origin", "https://web.example");
  assert.equal(res.status, 204);
  assert.equal(res.headers["access-control-allow-origin"], "https://web.example");
});

test("MONGO_URL unset: the 503 not-configured gate is reachable, no DB lookup", async () => {
  clearOriginCache();
  const bare = createApp({ env: { WEB_ORIGIN: "https://web.example" } });
  const t = Date.now();
  const res = await request(bare).get("/api/v1/me").set("Origin", "https://evil.example");
  assert.ok(Date.now() - t < 2000);
  assert.equal(res.status, 503);
  assert.equal(res.headers["access-control-allow-origin"], undefined);
});
