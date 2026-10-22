// Shared by the operator scripts. They use the Admin SDK (bypasses security rules), so they run on
// your computer with a service-account key, never in the browser.
//   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json node scripts/<script>.mjs ...
// Against the local emulators instead of the real project:
//   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-bandmate node scripts/...
import { randomBytes } from "node:crypto";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export function init() {
  const emulated = !!process.env.FIRESTORE_EMULATOR_HOST;
  initializeApp(emulated ? { projectId: process.env.GCLOUD_PROJECT || "demo-bandmate" } : { credential: applicationDefault() });
  return { auth: getAuth(), db: getFirestore() };
}

/** Splits `--flag value` / `--flag` arguments from plain ones. Repeated flags collect into arrays. */
export function parseArgs(argv) {
  const pos = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) {
      pos.push(a);
      continue;
    }
    const k = a.slice(2);
    const next = argv[i + 1];
    const v = next && !next.startsWith("--") ? (i++, next) : true;
    flags[k] = k in flags ? [].concat(flags[k], v) : v;
  }
  return { pos, flags };
}
export const list = (v) => (v === undefined || v === true ? [] : [].concat(v));

// Keep in sync with RESERVED_BAND_IDS in src/lib/host.ts (these belong to BandMate itself).
export const RESERVED_BAND_IDS = ["www", "app", "admin", "api", "mail", "platform", "static", "assets", "cdn", "help", "support", "status", "docs", "blog", "login", "b"];
export const validBandId = (id) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id) && id.length >= 3 && id.length <= 40 && !RESERVED_BAND_IDS.includes(id);

/** Finds the login for this email or creates a verified one. A new account gets a random password
 *  (or the one given with --password); the person sets their own with "Forgot password?". */
export async function ensureUser(auth, email, password, displayName) {
  try {
    const u = await auth.getUserByEmail(email);
    if (!u.emailVerified) await auth.updateUser(u.uid, { emailVerified: true });
    if (password) await auth.updateUser(u.uid, { password });
    return { user: u, created: false };
  } catch (e) {
    if (e.code !== "auth/user-not-found") throw e;
    const user = await auth.createUser({
      email,
      password: password || randomBytes(24).toString("base64url"),
      displayName: displayName || email.split("@")[0],
      emailVerified: true,
    });
    return { user, created: true, randomPassword: !password };
  }
}

export const DEFAULT_PUBLIC_SETTINGS = (bandName) => ({
  bandName,
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

export const SAMPLE_ITEMS = [
  ["hat-white", "White hat", "", 20, 50],
  ["tshirt-s", "T-shirt", "S", 25, 12],
  ["tshirt-l", "T-shirt", "L", 25, 48],
  ["tshirt-xxl", "T-shirt", "XXL", 25, 0],
  ["cup", "Cup", "", 12, 3],
];
