// Switches a band between the Free and Paid plan and sets its extra picture-space packs.
// (The same thing the operator console at /platform does; handy for scripts and the first setup.)
//
// Usage:
//   node scripts/set-plan.mjs <bandId> free|paid [--packs n]
import { init, parseArgs } from "./lib.mjs";

const { pos, flags } = parseArgs(process.argv.slice(2));
const [bandId, plan] = pos;
if (!bandId || !["free", "paid"].includes(plan)) {
  console.error("Usage: node scripts/set-plan.mjs <bandId> free|paid [--packs n]");
  process.exit(1);
}
const { db } = init();
const ref = db.doc(`bands/${bandId}`);
const snap = await ref.get();
if (!snap.exists) {
  console.error(`No band "${bandId}".`);
  process.exit(1);
}
const packs = flags.packs === undefined ? snap.data().extraPacks || 0 : Math.max(0, Math.floor(Number(flags.packs) || 0));
await ref.update({ plan, extraPacks: packs });
// storage.rules reads the picture allowance from settings/usage (it may only read two documents per upload)
await db.doc(`bands/${bandId}/settings/usage`).set({ limitBytes: ((plan === "paid" ? 150 : 50) + packs * 150) * 1024 * 1024 }, { merge: true });
console.log(`${bandId}: plan ${plan}, ${packs} extra space pack(s)`);
process.exit(0);
