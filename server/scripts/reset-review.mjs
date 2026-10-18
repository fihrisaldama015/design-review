// Deletes the review documents of one project (for repeating a demo). Dry run unless --yes is given.
// Usage: node --env-file=server/.env server/scripts/reset-review.mjs <project key> [slug] [--yes]
//   slug defaults to every review of the project. Publishing again (reviewSync) creates a fresh pending review.
import { connect, disconnect } from "../src/db.mjs";
import { Project, Review } from "../src/models.mjs";

const args = process.argv.slice(2);
const yes = args.includes("--yes");
const [key, slug] = args.filter((a) => !a.startsWith("--"));
const { MONGO_URL } = process.env;
const ORG_ID = process.env.ORG_ID || "blue-silo";

if (!MONGO_URL || !key) {
  console.error("Usage: node --env-file=server/.env server/scripts/reset-review.mjs <project key> [slug] [--yes]");
  process.exit(1);
}

await connect(MONGO_URL);
try {
  const project = await Project.findOne({ orgId: ORG_ID, key });
  if (!project) { console.error(`No project "${key}" in org ${ORG_ID}.`); process.exitCode = 1; }
  else {
    const filter = { projectId: project._id, ...(slug ? { slug } : {}) };
    const docs = await Review.find(filter, { slug: 1, status: 1, version: 1 }).lean();
    if (!docs.length) console.log("No reviews to delete.");
    for (const d of docs) console.log(`${yes ? "deleting" : "would delete"}: ${d.slug} (status ${d.status}, version ${d.version})`);
    if (yes && docs.length) console.log(`deleted ${(await Review.deleteMany(filter)).deletedCount} review(s)`);
    else if (docs.length) console.log("Dry run. Add --yes to delete.");
  }
} finally { await disconnect(); }
