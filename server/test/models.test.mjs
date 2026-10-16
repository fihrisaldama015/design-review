import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { startDb } from "./helpers.mjs";
import { connect } from "../src/db.mjs";
import { Review, User, ensureIndexes } from "../src/models.mjs";

let db;
before(async () => {
  db = await startDb();
  await connect(db.uri);
  await ensureIndexes();
});
after(async () => { await db.stop(); });

const dup = async (p) => { try { await p; } catch (e) { return e.code; } return null; };

test("same projectId and slug is rejected", async () => {
  const projectId = new mongoose.Types.ObjectId();
  await Review.create({ orgId: "o", projectId, slug: "button" });
  assert.equal(await dup(Review.create({ orgId: "o", projectId, slug: "button" })), 11000);
});

test("same orgId and email is rejected, other org accepted", async () => {
  const u = (orgId) => ({ orgId, email: "a@x.io", name: "A", role: "member", passwordHash: "h" });
  await User.create(u("o1"));
  assert.equal(await dup(User.create(u("o1"))), 11000);
  await User.create(u("o2"));
});
