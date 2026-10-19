// Security rules tests. Run with: npm run test:rules
import { test, before, after, beforeEach } from "node:test";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, getDocs, collection, query, where, deleteDoc } from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";

let env;
const ids = { admin: "u-admin", mate: "u-mate", pending: "u-pend", off: "u-off" };

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-bandmate",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
    storage: { rules: readFileSync("storage.rules", "utf8"), host: "127.0.0.1", port: 9199 },
  });
});
after(async () => env && (await env.cleanup()));

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "users", ids.admin), { email: "admin@admin.com", displayName: "Admin", role: "admin" });
    await setDoc(doc(db, "users", ids.mate), { email: "mate@band.com", displayName: "Mate", role: "bandmate" });
    await setDoc(doc(db, "users", ids.pending), { email: "new@band.com", displayName: "New", role: "pending" });
    await setDoc(doc(db, "users", ids.off), { email: "off@band.com", displayName: "Off", role: "disabled" });
    await setDoc(doc(db, "items", "hat"), { name: "Hat", variant: "", price: 20, visible: true, soldOut: false });
    await setDoc(doc(db, "items", "secret"), { name: "Prototype", variant: "", price: 99, visible: false, soldOut: false });
    await setDoc(doc(db, "stock", "hat"), { qty: 50 });
    await setDoc(doc(db, "settings", "public"), { bandName: "Band" });
    await setDoc(doc(db, "settings", "band"), { gig: "Košice" });
    await setDoc(doc(db, "sales", "s1"), { total: 20, undone: false, lines: [] });
  });
});

const as = (who, email) => env.authenticatedContext(who, email ? { email } : {}).firestore();
const fan = () => env.unauthenticatedContext().firestore();

test("fan reads visible items, settings; never stock, sales, hidden items", async () => {
  const db = fan();
  await assertSucceeds(getDoc(doc(db, "items", "hat")));
  await assertSucceeds(getDocs(query(collection(db, "items"), where("visible", "==", true))));
  await assertSucceeds(getDoc(doc(db, "settings", "public")));
  await assertFails(getDoc(doc(db, "items", "secret")));
  await assertFails(getDocs(collection(db, "items")));
  await assertFails(getDoc(doc(db, "stock", "hat")));
  await assertFails(getDocs(collection(db, "sales")));
  await assertFails(getDoc(doc(db, "settings", "band")));
  await assertFails(setDoc(doc(db, "items", "x"), { name: "X", visible: true }));
});

test("sign-up creates only a pending profile", async () => {
  const db = as("u-new2", "fresh@band.com");
  await assertFails(setDoc(doc(db, "users", "u-new2"), { email: "fresh@band.com", displayName: "F", role: "bandmate", createdAt: 1 }));
  await assertFails(setDoc(doc(db, "users", "u-new2"), { email: "other@band.com", displayName: "F", role: "pending", createdAt: 1 }));
  await assertFails(setDoc(doc(db, "users", "someone-else"), { email: "fresh@band.com", displayName: "F", role: "pending", createdAt: 1 }));
  await assertSucceeds(setDoc(doc(db, "users", "u-new2"), { email: "fresh@band.com", displayName: "F", role: "pending", createdAt: 1 }));
});

test("pending and disabled users cannot touch band data", async () => {
  for (const who of [ids.pending, ids.off]) {
    const db = as(who);
    await assertFails(getDoc(doc(db, "stock", "hat")));
    await assertFails(getDocs(collection(db, "sales")));
    await assertFails(setDoc(doc(db, "items", "x"), { name: "X", visible: true }));
    await assertFails(updateDoc(doc(db, "users", who), { role: "bandmate" }));
    await assertSucceeds(updateDoc(doc(db, "users", who), { displayName: "Renamed" }));
  }
});

test("band mate runs the desk but cannot manage people", async () => {
  const db = as(ids.mate);
  await assertSucceeds(getDoc(doc(db, "stock", "hat")));
  await assertSucceeds(setDoc(doc(db, "stock", "hat"), { qty: 60 }));
  await assertSucceeds(setDoc(doc(db, "items", "cup"), { name: "Cup", variant: "", price: 12, visible: true, soldOut: false }));
  await assertSucceeds(getDocs(collection(db, "items")));
  await assertSucceeds(setDoc(doc(db, "settings", "public"), { bandName: "New name" }));
  await assertSucceeds(setDoc(doc(db, "sales", "s2"), { total: 25, undone: false, lines: [] }));
  await assertSucceeds(updateDoc(doc(db, "sales", "s1"), { undone: true }));
  await assertFails(updateDoc(doc(db, "sales", "s1"), { total: 0 }));
  await assertFails(deleteDoc(doc(db, "sales", "s1")));
  await assertFails(updateDoc(doc(db, "users", ids.pending), { role: "bandmate" }));
  await assertFails(updateDoc(doc(db, "users", ids.mate), { role: "admin" }));
});

test("admin approves people but cannot change own role", async () => {
  const db = as(ids.admin);
  await assertSucceeds(updateDoc(doc(db, "users", ids.pending), { role: "bandmate" }));
  await assertSucceeds(updateDoc(doc(db, "users", ids.mate), { role: "disabled" }));
  await assertFails(updateDoc(doc(db, "users", ids.admin), { role: "bandmate" }));
  await assertSucceeds(deleteDoc(doc(db, "sales", "s1")));
});

test("storage: only band staff upload images; everyone reads", async () => {
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const up = (ctx, path, type = "image/png") => uploadBytes(ref(ctx.storage(), path), png, { contentType: type });
  await assertFails(up(env.unauthenticatedContext(), "public/qr/a.png"));
  await assertFails(up(env.authenticatedContext(ids.pending), "public/qr/a.png"));
  await assertSucceeds(up(env.authenticatedContext(ids.mate), "public/qr/a.png"));
  await assertSucceeds(up(env.authenticatedContext(ids.admin), "public/logo/l.png"));
  await assertFails(up(env.authenticatedContext(ids.mate), "public/qr/a.html", "text/html"));
  await assertFails(up(env.authenticatedContext(ids.mate), "private/x.png"));
});
