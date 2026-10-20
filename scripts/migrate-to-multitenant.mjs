// One-off: moves the old single-band data (root collections items, stock, bundles, sales, users,
// settings) into bands/<bandId>/... . Copies only; the old data stays until you run --delete-legacy.
//
// Usage:
//   node scripts/migrate-to-multitenant.mjs <bandId> [--platform-email you@x.com] [--domain host]...   (dry run)
//   node scripts/migrate-to-multitenant.mjs <bandId> ... --apply                                       (copy)
//   node scripts/migrate-to-multitenant.mjs <bandId> --delete-legacy                                   (after checking the new site)
import { init, list, parseArgs, validBandId } from "./lib.mjs";

const { pos, flags } = parseArgs(process.argv.slice(2));
const [bandId] = pos;
if (!bandId || !validBandId(bandId)) {
  console.error("Usage: node scripts/migrate-to-multitenant.mjs <bandId> [--platform-email e] [--domain host]... [--apply | --delete-legacy]");
  process.exit(1);
}
const { auth, db } = init();
const apply = !!flags.apply;
const SUBS = ["items", "stock", "bundles", "sales"];

async function commitAll(ops) {
  for (let i = 0; i < ops.length; i += 400) {
    const b = db.batch();
    ops.slice(i, i + 400).forEach((fn) => fn(b));
    await b.commit();
  }
}

if (flags["delete-legacy"]) {
  if (!(await db.doc(`bands/${bandId}`).get()).exists) {
    console.error(`bands/${bandId} does not exist yet. Migrate first.`);
    process.exit(1);
  }
  const ops = [];
  for (const c of [...SUBS, "users"]) (await db.collection(c).get()).docs.forEach((d) => ops.push((b) => b.delete(d.ref)));
  for (const id of ["public", "band"]) ops.push((b) => b.delete(db.doc(`settings/${id}`)));
  await commitAll(ops);
  console.log(`Deleted ${ops.length} legacy documents.`);
  process.exit(0);
}

if ((await db.doc(`bands/${bandId}`).get()).exists) {
  console.error(`bands/${bandId} already exists. Nothing copied.`);
  process.exit(1);
}
const settings = (await db.doc("settings/public").get()).data() || {};
const name = settings.bandName || bandId;
const ops = [];
const say = [];
ops.push((b) => b.set(db.doc(`bands/${bandId}`), { name, status: "active", createdAt: Date.now() }));
say.push(`band record: "${name}" (/b/${bandId})`);
if (Object.keys(settings).length) ops.push((b) => b.set(db.doc(`bands/${bandId}/settings/public`), settings));
const gig = (await db.doc("settings/band").get()).data();
if (gig) ops.push((b) => b.set(db.doc(`bands/${bandId}/settings/band`), gig));
for (const c of SUBS) {
  const snap = await db.collection(c).get();
  snap.docs.forEach((d) => ops.push((b) => b.set(db.doc(`bands/${bandId}/${c}/${d.id}`), d.data())));
  say.push(`${c}: ${snap.size}`);
}
const users = await db.collection("users").get();
users.docs.forEach((d) => ops.push((b) => b.set(db.doc(`bands/${bandId}/members/${d.id}`), d.data())));
say.push(`members (from users): ${users.size} -> ${users.docs.map((d) => `${d.data().email} [${d.data().role}]`).join(", ")}`);
for (const host of list(flags.domain)) {
  ops.push((b) => b.set(db.doc(`domains/${host.toLowerCase()}`), { bandId }));
  say.push(`address: ${host}`);
}
if (typeof flags["platform-email"] === "string") {
  const u = await auth.getUserByEmail(flags["platform-email"].toLowerCase());
  ops.push((b) => b.set(db.doc(`platformAdmins/${u.uid}`), { email: u.email, createdAt: Date.now() }, { merge: true }));
  say.push(`BandMate admin: ${u.email}`);
}
console.log((apply ? "Copying:\n  " : "DRY RUN, nothing written. Would copy:\n  ") + say.join("\n  "));
if (apply) {
  await commitAll(ops);
  console.log("Done. The old documents are still in place. Check the new site, then run with --delete-legacy.");
} else {
  console.log("\nAdd --apply to do it.");
}
process.exit(0);
