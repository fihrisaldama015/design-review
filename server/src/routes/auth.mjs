import { Router } from "express";
import bcrypt from "bcryptjs";
import { HttpError, checkPassword, hashPassword, signSession, userView } from "../auth.mjs";
import { User } from "../models.mjs";

// Compared against when the email is unknown, so both failures take similar time.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

/** Public: POST /auth/login. */
export function loginRouter(env) {
  const r = Router();
  r.post("/auth/login", wrap(async (req, res) => {
    const { email, password } = req.body || {};
    const user = typeof email === "string" && typeof password === "string"
      ? await User.findOne({ orgId: env.ORG_ID || "blue-silo", email: email.trim().toLowerCase() })
      : null;
    const ok = await checkPassword(typeof password === "string" ? password : "", user ? user.passwordHash : DUMMY_HASH);
    if (!user || !ok) {
      throw new HttpError(401, "Wrong email or password.");
    }
    res.json({ token: signSession(user, env), user: userView(user) });
  }));
  return r;
}

/** Behind authenticate: POST /auth/password, GET /me. */
export function sessionRouter() {
  const r = Router();
  r.post("/auth/password", wrap(async (req, res) => {
    if (req.auth.kind !== "user") throw new HttpError(403, "Log in as a user to change a password.");
    const { current, next } = req.body || {};
    if (typeof next !== "string" || next.length < 10) {
      throw new HttpError(400, "The new password must be at least 10 characters.");
    }
    const user = req.auth.user;
    if (typeof current !== "string" || !(await checkPassword(current, user.passwordHash))) {
      throw new HttpError(401, "Wrong current password.");
    }
    user.passwordHash = await hashPassword(next);
    user.mustChangePassword = false;
    await user.save();
    res.status(204).end();
  }));
  r.get("/me", (req, res) => {
    if (req.auth.kind !== "user") throw new HttpError(403, "Log in as a user to see this.");
    res.json(userView(req.auth.user));
  });
  return r;
}
