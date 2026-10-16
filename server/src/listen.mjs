import { connect } from "./db.mjs";
import { ensureIndexes } from "./models.mjs";
import { createApp } from "./app.mjs";

const port = Number(process.env.PORT) || 9300;
await connect(process.env.MONGO_URL);
await ensureIndexes();
createApp({ env: process.env }).listen(port, () => {
  console.log(`design-review-be on http://localhost:${port}/api/v1`);
});
