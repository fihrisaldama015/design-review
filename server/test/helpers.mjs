import { MongoMemoryServer } from "mongodb-memory-server";
import bcrypt from "bcryptjs";
import { Project, User } from "../src/models.mjs";
import { disconnect } from "../src/db.mjs";

export const ORG = process.env.ORG_ID || "blue-silo";
let n = 0;

export async function startDb() {
  const mongod = await MongoMemoryServer.create();
  return {
    uri: mongod.getUri(),
    stop: async () => { await disconnect(); await mongod.stop(); },
  };
}

export async function makeAdmin(fields = {}) {
  n += 1;
  return User.create({
    orgId: ORG,
    email: `admin${n}@x.io`,
    name: `Admin ${n}`,
    role: "admin",
    passwordHash: bcrypt.hashSync("password-12345", 10),
    mustChangePassword: false,
    ...fields,
  });
}

export async function makeProject(fields = {}) {
  n += 1;
  return Project.create({
    orgId: ORG,
    key: `project-${n}`,
    name: `Project ${n}`,
    allowedOrigins: [],
    ...fields,
  });
}
