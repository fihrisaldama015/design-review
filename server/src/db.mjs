import mongoose from "mongoose";

let pending = null;

export function connect(uri) {
  if (!pending) {
    pending = mongoose.connect(uri, { dbName: "design_review" }).then((m) => m.connection);
    pending.catch(() => { pending = null; });
  }
  return pending;
}

export async function disconnect() {
  pending = null;
  await mongoose.disconnect();
}
