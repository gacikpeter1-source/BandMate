// Creates (or resets) the admin account and gives it the "admin" role.
// Runs on your computer with a service-account key, never in the browser,
// so the admin password is not shipped inside the app.
//
// Usage:
//   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
//     node scripts/create-admin.mjs <email> <password> [--sample]
//
//   --sample  also adds the example stock list (hat, T-shirts, cup) and a bundle.
//
// Against the local emulators instead of the real project:
//   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
//     GCLOUD_PROJECT=demo-bandmate node scripts/create-admin.mjs admin@admin.com 'secret' --sample

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const [email, password, ...flags] = process.argv.slice(2);
if (!email || !password) {
  console.error("Usage: node scripts/create-admin.mjs <email> <password> [--sample]");
  process.exit(1);
}
if (password.length < 8) {
  console.error("Use a password of at least 8 characters.");
  process.exit(1);
}

const emulated = !!process.env.FIRESTORE_EMULATOR_HOST;
initializeApp(emulated ? { projectId: process.env.GCLOUD_PROJECT || "demo-bandmate" } : { credential: applicationDefault() });
const auth = getAuth();
const db = getFirestore();

let user;
try {
  user = await auth.getUserByEmail(email);
  await auth.updateUser(user.uid, { password, emailVerified: true });
  console.log(`Updated password for existing user ${email}`);
} catch (e) {
  if (e.code !== "auth/user-not-found") throw e;
  user = await auth.createUser({ email, password, displayName: "Admin", emailVerified: true });
  console.log(`Created user ${email}`);
}

await db.doc(`users/${user.uid}`).set(
  { email: email.toLowerCase(), displayName: "Admin", role: "admin", createdAt: Date.now() },
  { merge: true }
);
console.log(`Role "admin" set for ${email} (uid ${user.uid})`);

const pub = db.doc("settings/public");
if (!(await pub.get()).exists) {
  await pub.set({
    bandName: "Your Band",
    tagline: "Official merch",
    currency: "€",
    preset: "stage",
    theme: { primary: "#FF5A1F", bg: "#121311", surface: "#1D201C", text: "#F1F2EE" },
    logoUrl: null,
    logoPath: null,
    logoOpacity: 0.12,
    logoInHeader: true,
    topBar: { enabled: false, email: "", links: [] },
  });
  await db.doc("settings/band").set({ gig: "" });
  console.log("Created default band settings");
}

if (flags.includes("--sample")) {
  const items = [
    ["hat-white", "White hat", "", 20, 50],
    ["tshirt-s", "T-shirt", "S", 25, 12],
    ["tshirt-l", "T-shirt", "L", 25, 48],
    ["tshirt-xxl", "T-shirt", "XXL", 25, 0],
    ["cup", "Cup", "", 12, 3],
  ];
  const batch = db.batch();
  items.forEach(([id, name, variant, price, qty], i) => {
    batch.set(db.doc(`items/${id}`), { name, variant, price, qrUrl: null, qrPath: null, visible: true, soldOut: qty <= 0, order: i + 1 });
    batch.set(db.doc(`stock/${id}`), { qty });
  });
  batch.set(db.doc("bundles/shirt-hat"), {
    name: "Shirt + Hat",
    price: 40,
    parts: [{ name: "T-shirt", qty: 1 }, { name: "White hat", qty: 1 }],
    qrUrl: null,
    qrPath: null,
    visible: true,
    order: 1,
  });
  await batch.commit();
  console.log("Added sample stock and a bundle");
}

console.log("\nDone. Sign in at /login, then change the password under Settings → Your account.");
process.exit(0);
