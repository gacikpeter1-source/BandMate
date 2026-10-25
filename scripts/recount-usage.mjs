// Recomputes a band's running totals (bands/{bandId}/settings/usage) from what is really there:
// items, picture bytes in Storage, and members + open invitations. Needed once for bands created before
// plans existed; afterwards the app keeps the totals up to date itself (and corrects items/members on its own).
//
// Usage:
//   node scripts/recount-usage.mjs <bandId> [--bucket my-project.firebasestorage.app]
//   node scripts/recount-usage.mjs --all [--bucket ...]
// Without --bucket the pictures are not counted (bytes is left as it was).
import { getStorage } from "firebase-admin/storage";
import { init, parseArgs } from "./lib.mjs";

const { pos, flags } = parseArgs(process.argv.slice(2));
if (!pos[0] && !flags.all) {
  console.error("Usage: node scripts/recount-usage.mjs <bandId>|--all [--bucket name]");
  process.exit(1);
}
const { db } = init();
const bucket = typeof flags.bucket === "string" ? getStorage().bucket(flags.bucket) : null;
const ids = flags.all ? (await db.collection("bands").get()).docs.map((d) => d.id) : [pos[0]];

for (const id of ids) {
  const count = async (sub) => (await db.collection(`bands/${id}/${sub}`).count().get()).data().count;
  const items = await count("items");
  const members = (await count("members")) + (await count("invites"));
  const band = (await db.doc(`bands/${id}`).get()).data() || {};
  const usage = { items, members, limitBytes: ((band.plan === "paid" ? 150 : 50) + (band.extraPacks || 0) * 150) * 1024 * 1024 };
  if (bucket) {
    const [files] = await bucket.getFiles({ prefix: `bands/${id}/` });
    usage.bytes = files.reduce((n, f) => n + Number(f.metadata.size || 0), 0);
  }
  await db.doc(`bands/${id}/settings/usage`).set(usage, { merge: true });
  console.log(`${id}: ${JSON.stringify(usage)}${bucket ? "" : " (pictures not counted)"}`);
}
process.exit(0);
