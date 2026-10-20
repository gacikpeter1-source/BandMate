// Makes someone the BandMate operator: can open every band's desk and create bands.
// Usage: node scripts/create-platform-admin.mjs <email> [--password pw]
import { ensureUser, init, parseArgs } from "./lib.mjs";

const { pos, flags } = parseArgs(process.argv.slice(2));
const [email] = pos;
if (!email) {
  console.error("Usage: node scripts/create-platform-admin.mjs <email> [--password pw]");
  process.exit(1);
}
if (typeof flags.password === "string" && flags.password.length < 8) {
  console.error("Use a password of at least 8 characters.");
  process.exit(1);
}
const { auth, db } = init();
const { user, created, randomPassword } = await ensureUser(auth, email.toLowerCase(), typeof flags.password === "string" ? flags.password : undefined, "BandMate admin");
await db.doc(`platformAdmins/${user.uid}`).set({ email: email.toLowerCase(), createdAt: Date.now() }, { merge: true });
console.log(`${email} is now a BandMate admin (${created ? "new login" : "existing login"}, uid ${user.uid}).`);
if (randomPassword) console.log("They set a password with 'Forgot password?' on /platform/login.");
process.exit(0);
