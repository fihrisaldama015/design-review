import bcrypt from "bcryptjs";
import { connect, disconnect } from "../src/db.mjs";
import { User, ensureIndexes } from "../src/models.mjs";

const { MONGO_URL, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD } = process.env;
const ORG_ID = process.env.ORG_ID || "blue-silo";

for (const [name, value] of Object.entries({ MONGO_URL, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD })) {
  if (!value) {
    console.error(`Set ${name} before running the seed.`);
    process.exit(1);
  }
}

await connect(MONGO_URL);
await ensureIndexes();
const email = SEED_ADMIN_EMAIL.trim().toLowerCase();
if (await User.exists({ orgId: ORG_ID, email })) {
  console.log(`Admin ${email} exists, unchanged`);
} else {
  await User.create({
    orgId: ORG_ID,
    email,
    name: "Admin",
    role: "admin",
    passwordHash: bcrypt.hashSync(SEED_ADMIN_PASSWORD, 10),
    mustChangePassword: true,
  });
  console.log(`Admin ${email} created`);
}
await disconnect();
