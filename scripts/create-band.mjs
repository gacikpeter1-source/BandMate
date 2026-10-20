// Starts a new band ("tenant"): the band record, its default settings, the address(es) that open it,
// and its first admin. No password is ever printed.
//
// Usage:
//   node scripts/create-band.mjs <bandId> "<Band name>" <adminEmail> [--domain host]... [--password pw] [--sample]
//
//   bandId     short, lowercase, letters/digits/dashes, never changes (e.g. saw-dust-and-mold).
//              The store is reachable at /b/<bandId> on the BandMate address.
//   --domain   an address that should open this band, e.g. bandname.yourapp.com or merch.theband.com
//              (repeat for several). Adding it in Vercel and Firebase Auth is a separate step.
//   --password only for a brand-new login; otherwise a random one is set and the person uses
//              "Forgot password?" on the band's login page.
//   --sample   also adds the example stock list (hat, T-shirts, cup) and a bundle.
import { DEFAULT_PUBLIC_SETTINGS, SAMPLE_ITEMS, ensureUser, init, list, parseArgs, validBandId } from "./lib.mjs";

const { pos, flags } = parseArgs(process.argv.slice(2));
const [bandId, name, email] = pos;
if (!bandId || !name || !email) {
  console.error('Usage: node scripts/create-band.mjs <bandId> "<Band name>" <adminEmail> [--domain host]... [--password pw] [--sample]');
  process.exit(1);
}
if (!validBandId(bandId)) {
  console.error("bandId must be 3-40 characters: lowercase letters, digits and single dashes (e.g. my-band).");
  process.exit(1);
}
if (typeof flags.password === "string" && flags.password.length < 8) {
  console.error("Use a password of at least 8 characters.");
  process.exit(1);
}

const { auth, db } = init();
const bandRef = db.doc(`bands/${bandId}`);
if ((await bandRef.get()).exists) {
  console.error(`Band "${bandId}" already exists. Pick another id.`);
  process.exit(1);
}
const domains = list(flags.domain).map((d) => d.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, ""));
for (const d of domains) {
  const ex = await db.doc(`domains/${d}`).get();
  if (ex.exists && ex.data().bandId !== bandId) {
    console.error(`${d} already opens band "${ex.data().bandId}".`);
    process.exit(1);
  }
}

const { user, created, randomPassword } = await ensureUser(auth, email.toLowerCase(), typeof flags.password === "string" ? flags.password : undefined, "Admin");
const batch = db.batch();
batch.set(bandRef, { name, status: "active", createdAt: Date.now() });
batch.set(db.doc(`bands/${bandId}/settings/public`), DEFAULT_PUBLIC_SETTINGS(name));
batch.set(db.doc(`bands/${bandId}/settings/band`), { gig: "" });
batch.set(db.doc(`bands/${bandId}/members/${user.uid}`), { email: email.toLowerCase(), displayName: user.displayName || "Admin", role: "admin", createdAt: Date.now() });
for (const d of domains) batch.set(db.doc(`domains/${d}`), { bandId });
if (flags.sample) {
  SAMPLE_ITEMS.forEach(([id, n, variant, price, qty], i) => {
    batch.set(db.doc(`bands/${bandId}/items/${id}`), { name: n, variant, price, qrUrl: null, qrPath: null, visible: true, soldOut: qty <= 0, order: i + 1 });
    batch.set(db.doc(`bands/${bandId}/stock/${id}`), { qty });
  });
  batch.set(db.doc(`bands/${bandId}/bundles/shirt-hat`), {
    name: "Shirt + Hat", price: 40, parts: [{ name: "T-shirt", qty: 1 }, { name: "White hat", qty: 1 }], qrUrl: null, qrPath: null, visible: true, order: 1,
  });
}
await batch.commit();

console.log(`Band "${name}" created: /b/${bandId}`);
for (const d of domains) console.log(`  address: ${d}  (add it to Vercel and Firebase Auth authorized domains)`);
console.log(`Admin: ${email} (${created ? "new login" : "existing login"}, uid ${user.uid})`);
if (randomPassword) console.log("  They set their own password with 'Forgot password?' on the band's login page.");
process.exit(0);
