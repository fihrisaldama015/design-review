import { test } from "node:test";
import assert from "node:assert/strict";
import { eventKind } from "../src/eventLabels.mjs";
import { connectSnippets, setupChecklist, TOKEN_PLACEHOLDER } from "../../web/src/app/setup.js";

test("eventKind classifies every audit action and unknown text as other", () => {
  assert.equal(eventKind("published"), "published");
  assert.equal(eventKind("published (new cycle)"), "published");
  assert.equal(eventKind("Figma changed: earlier answers dropped"), "reopened");
  assert.equal(eventKind("republished (same Figma state, answers kept)"), "synced");
  assert.equal(eventKind("decided"), "decided");
  assert.equal(eventKind("applied"), "applied");
  assert.equal(eventKind("something else"), "other");
  assert.equal(eventKind(undefined), "other");
});

test("connectSnippets fills in the real address and project key, and never a real token", () => {
  const s = connectSnippets({ origin: "https://design-review-jet.vercel.app/", project: "mvp" });
  assert.equal(s.serviceUrl, "https://design-review-jet.vercel.app");
  assert.equal(s.apiUrl, "https://design-review-jet.vercel.app/api/v1");
  assert.deepEqual(JSON.parse(s.apiJson), { url: "https://design-review-jet.vercel.app/api/v1", project: "mvp", token: TOKEN_PLACEHOLDER });
  assert.equal(s.toolEnv, `REVIEW_API_URL=https://design-review-jet.vercel.app/api/v1\nREVIEW_PROJECT=mvp\nREVIEW_API_KEY=${TOKEN_PLACEHOLDER}`);
  assert.equal(s.pageEnv, "PUBLIC_REVIEW_SERVICE_URL=https://design-review-jet.vercel.app\nPUBLIC_REVIEW_PROJECT=mvp");
  assert.equal(s.checkCommand, "node scripts/figma/reviewState.mjs");
  assert.equal(s.checkCurl, `curl -s -H "Authorization: Bearer ${TOKEN_PLACEHOLDER}" https://design-review-jet.vercel.app/api/v1/projects/mvp/reviews`);
  assert.ok(TOKEN_PLACEHOLDER.startsWith("drp_") && !/drp_[A-Za-z0-9]{20}/.test(s.apiJson));
});

test("connectSnippets uses a placeholder when the project is not known yet", () => {
  const s = connectSnippets({ origin: "http://localhost:9300" });
  const j = JSON.parse(s.apiJson);
  assert.equal(j.project, "<project key>");
  assert.equal("reviewPage" in j, false); // the environment variables have no such value, so the file does not either
  assert.equal(connectSnippets().apiUrl, "/api/v1");
});

test("setupChecklist marks each step done from the project, tokens, members and reviews", () => {
  const empty = setupChecklist({ allowedOrigins: [], reviewUrl: "" }, { tokens: [], members: [], reviews: 0 });
  assert.deepEqual(empty.items.map((i) => [i.id, i.done]), [["token", false], ["origin", false], ["reviewUrl", false], ["member", false], ["review", false]]);
  assert.equal(empty.done, 0);
  assert.equal(empty.total, 5);
  assert.equal(empty.complete, false);

  const full = setupChecklist({ allowedOrigins: ["http://localhost:5002"], reviewUrl: "http://localhost:5002/review" }, { tokens: [{ revokedAt: null }], members: [{ id: "u1" }], reviews: 2 });
  assert.equal(full.done, 5);
  assert.equal(full.complete, true);
  assert.deepEqual(full.items.map((i) => i.tab), ["tokens", "settings", "settings", "members", "tokens"]);
});

test("setupChecklist ignores revoked tokens and survives missing data", () => {
  const c = setupChecklist(undefined, { tokens: [{ revokedAt: "2026-11-01" }] });
  assert.equal(c.items.find((i) => i.id === "token").done, false);
  assert.equal(setupChecklist(null, undefined).done, 0);
});
