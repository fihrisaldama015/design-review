import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { Token, User, Membership } from "./models.mjs";

const TOKEN_PREFIX = "drp_";
const PUBLIC_WHILE_LOCKED = new Set(["/auth/password", "/me"]);

export const hashPassword = (p) => bcrypt.hash(p, 10);
export const checkPassword = (p, hash) => bcrypt.compare(p, hash);

export function signSession(user, env) {
  return jwt.sign({ sub: String(user._id), org: user.orgId }, env.SESSION_SECRET, { algorithm: "HS256", expiresIn: "8h" });
}

export const hashToken = (t) => crypto.createHash("sha256").update(t).digest("hex");

export function newProjectToken() {
  const token = TOKEN_PREFIX + crypto.randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export const userView = (u) => ({
  id: String(u._id), email: u.email, name: u.name, role: u.role, mustChangePassword: !!u.mustChangePassword,
});

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/** Express middleware: sets req.auth to { kind: "tool", projectId } or { kind: "user", user }. */
export function authenticate(env) {
  return async (req, res, next) => {
    try {
      const m = /^Bearer\s+(\S+)$/i.exec(req.get("authorization") || "");
      if (!m) throw new HttpError(401, "Log in first.");
      const bearer = m[1];
      if (bearer.startsWith(TOKEN_PREFIX)) {
        const tok = await Token.findOneAndUpdate(
          { hash: hashToken(bearer), revokedAt: null },
          { lastUsedAt: new Date() },
        );
        if (!tok) throw new HttpError(401, "Unknown or revoked project token.");
        req.auth = { kind: "tool", projectId: String(tok.projectId), orgId: tok.orgId };
        return next();
      }
      let claims;
      try {
        claims = jwt.verify(bearer, env.SESSION_SECRET, { algorithms: ["HS256"] });
      } catch {
        throw new HttpError(401, "Your session expired. Log in again.");
      }
      if (!mongoose.isValidObjectId(claims.sub)) throw new HttpError(401, "Your session expired. Log in again.");
      const user = await User.findOne({ _id: claims.sub, orgId: claims.org });
      if (!user) throw new HttpError(401, "Your session expired. Log in again.");
      req.auth = { kind: "user", user };
      if (user.role !== "admin") {
        const rows = await Membership.find({ userId: user._id }, { projectId: 1 }).lean();
        req.auth.projectIds = rows.map((m) => String(m.projectId));
      }
      if (user.mustChangePassword && !PUBLIC_WHILE_LOCKED.has(req.path)) {
        throw new HttpError(403, "Change your password first.");
      }
      next();
    } catch (e) {
      next(e);
    }
  };
}

export function canUseProject(auth, project) {
  const id = String(project._id);
  if (auth.kind === "tool") return String(auth.projectId) === id;
  if (auth.user.role === "admin") return true;
  return (auth.projectIds || []).includes(id);
}
