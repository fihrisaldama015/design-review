import mongoose from "mongoose";

const { Schema, Types } = mongoose;
const org = { type: String, required: true };
const opts = { timestamps: true, versionKey: false };

const projectSchema = new Schema({
  orgId: org,
  key: { type: String, required: true },
  name: { type: String, required: true },
  figmaFileKey: String,
  storybookUrl: String,
  reviewUrl: String,
  allowedOrigins: { type: [String], default: [] },
  hasPreviewBuilds: { type: Boolean, default: false },
}, opts);
projectSchema.index({ orgId: 1, key: 1 }, { unique: true });

const tokenSchema = new Schema({
  orgId: org,
  projectId: { type: Types.ObjectId, required: true },
  label: String,
  hash: { type: String, required: true, unique: true },
  lastUsedAt: Date,
  revokedAt: Date,
}, opts);

const userSchema = new Schema({
  orgId: org,
  email: { type: String, required: true, lowercase: true, trim: true },
  name: String,
  role: { type: String, enum: ["admin", "member"], required: true },
  passwordHash: { type: String, required: true },
  mustChangePassword: { type: Boolean, default: false },
}, opts);
userSchema.index({ orgId: 1, email: 1 }, { unique: true });

const membershipSchema = new Schema({
  orgId: org,
  userId: { type: Types.ObjectId, required: true },
  projectId: { type: Types.ObjectId, required: true },
}, opts);
membershipSchema.index({ userId: 1, projectId: 1 }, { unique: true });

const reviewSchema = new Schema({
  orgId: org,
  projectId: { type: Types.ObjectId, required: true },
  slug: { type: String, required: true },
  component: String,
  jsxName: String,
  storyId: String,
  figmaNode: String,
  figmaPage: String,
  code: String,
  readAt: String,
  sourceHash: String,
  status: String,
  version: { type: Number, default: 1 },
  items: { type: Schema.Types.Mixed, strict: false },
  answers: { type: Schema.Types.Mixed, strict: false },
  audit: { type: Schema.Types.Mixed, strict: false },
  usage: { type: Schema.Types.Mixed, strict: false },
  usageHistory: { type: Schema.Types.Mixed, strict: false },
  migrateBy: { type: Schema.Types.Mixed, strict: false },
}, { ...opts, strict: false, minimize: false }); // minimize: false keeps empty answers {} (reviewLogic reads doc.answers[id])
reviewSchema.index({ projectId: 1, slug: 1 }, { unique: true });

export const Project = mongoose.model("Project", projectSchema, "projects");
export const Token = mongoose.model("Token", tokenSchema, "tokens");
export const User = mongoose.model("User", userSchema, "users");
export const Membership = mongoose.model("Membership", membershipSchema, "memberships");
export const Review = mongoose.model("Review", reviewSchema, "reviews");

export async function ensureIndexes() {
  for (const m of [Project, Token, User, Membership, Review]) await m.createIndexes();
}
