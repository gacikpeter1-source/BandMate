// Security rules tests. Run with: npm run test:rules
// Two active bands (a = Paid plan, b = Free plan), one paused band (c), and people with different roles in each.
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, getDocs, collection, collectionGroup, query, where, deleteDoc, writeBatch, increment } from "firebase/firestore";
import { ref, uploadBytes, listAll } from "firebase/storage";

let env;
const ids = {
  platform: "u-platform",
  adminA: "u-admin-a", mateA: "u-mate-a", pendA: "u-pend-a", offA: "u-off-a",
  adminB: "u-admin-b", mateB: "u-mate-b",
  both: "u-both", // band mate in A, only pending in B
  stranger: "u-stranger", // verified account with no membership anywhere
};

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
    await setDoc(doc(db, "platformAdmins", ids.platform), { email: "ops@bandmate.app" });
    await setDoc(doc(db, "domains", "merch.band-a.com"), { bandId: "a" });
    for (const [b, status] of [["a", "active"], ["b", "active"], ["c", "paused"]]) {
      await setDoc(doc(db, "bands", b), { name: `Band ${b}`, status, ...(b === "a" ? { plan: "paid" } : {}) });
      await setDoc(doc(db, "bands", b, "settings", "usage"), { items: 2, bytes: 0, members: b === "a" ? 3 : 1 });
      await setDoc(doc(db, "bands", b, "items", "hat"), { name: "Hat", variant: "", price: 20, visible: true, soldOut: false });
      await setDoc(doc(db, "bands", b, "items", "secret"), { name: "Prototype", variant: "", price: 99, visible: false, soldOut: false });
      await setDoc(doc(db, "bands", b, "stock", "hat"), { qty: 50 });
      await setDoc(doc(db, "bands", b, "settings", "public"), { bandName: `Band ${b}` });
      await setDoc(doc(db, "bands", b, "settings", "band"), { gig: "Košice" });
      await setDoc(doc(db, "bands", b, "sales", "s1"), { total: 20, undone: false, lines: [] });
    }
    const member = (b, uid, role) => setDoc(doc(db, "bands", b, "members", uid), { email: `${uid}@x.com`, displayName: uid, role });
    await member("a", ids.adminA, "admin");
    await member("a", ids.mateA, "bandmate");
    await member("a", ids.pendA, "pending");
    await member("a", ids.offA, "disabled");
    await member("a", ids.both, "bandmate");
    await member("b", ids.adminB, "admin");
    await member("b", ids.mateB, "bandmate");
    await member("b", ids.both, "pending");
  });
});

const claims = (email, verified = true) => ({ ...(email ? { email } : {}), email_verified: verified });
const as = (who, email, verified = true) => env.authenticatedContext(who, claims(email, verified)).firestore();
const authed = (who, verified = true) => env.authenticatedContext(who, claims(undefined, verified));
const fan = () => env.unauthenticatedContext().firestore();
const usageOf = (db, b) => doc(db, "bands", b, "settings", "usage");
const addItem = (db, b, id) => {
  const w = writeBatch(db);
  w.set(doc(db, "bands", b, "items", id), { name: "Thing", variant: "", price: 12, visible: true, soldOut: false });
  w.set(usageOf(db, b), { items: increment(1) }, { merge: true });
  return w.commit();
};
const setUsage = (b, data) => env.withSecurityRulesDisabled((ctx) => setDoc(usageOf(ctx.firestore(), b), data));
const setBand = (b, data) => env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), "bands", b), data));
const item = (b, id = "x") => doc(as(ids.mateA), "bands", b, "items", id);

test("fan reads one active band's visible items and settings; never stock, sales, hidden items", async () => {
  const db = fan();
  await assertSucceeds(getDoc(doc(db, "bands", "a", "items", "hat")));
  await assertSucceeds(getDocs(query(collection(db, "bands", "a", "items"), where("visible", "==", true))));
  await assertSucceeds(getDoc(doc(db, "bands", "a", "settings", "public")));
  await assertSucceeds(getDoc(doc(db, "bands", "a")));
  await assertFails(getDoc(doc(db, "bands", "a", "items", "secret")));
  await assertFails(getDocs(collection(db, "bands", "a", "items")));
  await assertFails(getDoc(doc(db, "bands", "a", "stock", "hat")));
  await assertFails(getDocs(collection(db, "bands", "a", "sales")));
  await assertFails(getDoc(doc(db, "bands", "a", "settings", "band")));
  await assertFails(setDoc(doc(db, "bands", "a", "items", "x"), { name: "X", visible: true }));
  await assertFails(getDocs(collection(db, "bands"))); // the list of bands is not public
  await assertFails(getDocs(collection(db, "domains")));
});

test("a paused band shows nothing to fans and lets its own staff do nothing", async () => {
  await assertFails(getDoc(doc(fan(), "bands", "c", "items", "hat")));
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "bands", "c", "members", ids.mateA), { email: "m@x.com", displayName: "M", role: "bandmate" });
  });
  await assertFails(getDoc(doc(as(ids.mateA), "bands", "c", "stock", "hat")));
  await assertFails(setDoc(doc(as(ids.mateA), "bands", "c", "items", "x"), { name: "X", visible: true }));
  await assertSucceeds(getDoc(doc(as(ids.platform), "bands", "c", "stock", "hat"))); // operator still can
});

test("nobody joins a band on their own: only by accepting an invitation sent to their verified email", async () => {
  const db = as("u-new", "fresh@band.com");
  const m = (b) => doc(db, "bands", b, "members", "u-new");
  const mem = (over = {}) => ({ email: "fresh@band.com", displayName: "F", role: "bandmate", createdAt: 1, ...over });
  await assertFails(setDoc(m("a"), mem())); // no invitation
  await assertFails(setDoc(m("a"), mem({ role: "pending" }))); // the old self sign-up is gone
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "bands", "a", "invites", "fresh@band.com"), { email: "fresh@band.com", role: "bandmate", invitedBy: ids.adminA, createdAt: 1 }));
  await assertFails(setDoc(m("b"), mem())); // invited into A, not B
  await assertFails(setDoc(m("a"), mem({ role: "admin" }))); // only the invited role
  await assertFails(setDoc(m("a"), mem({ email: "other@band.com" })));
  await assertFails(setDoc(doc(db, "bands", "a", "members", "someone-else"), mem()));
  await assertFails(setDoc(doc(as("u-new", "fresh@band.com", false), "bands", "a", "members", "u-new"), mem())); // unverified
  const other = as("u-other", "other@band.com");
  await assertFails(getDoc(doc(other, "bands", "a", "invites", "fresh@band.com"))); // nobody else can read it
  await assertSucceeds(getDoc(doc(other, "bands", "a", "invites", "other@band.com"))); // looking up your own (empty) slot is fine
  await assertFails(getDoc(doc(db, "bands", "a", "invites", "other@band.com"))); // but never someone else's
  await assertSucceeds(getDoc(doc(db, "bands", "a", "invites", "fresh@band.com")));
  const w = writeBatch(db); // accepting = create the membership and use up the invitation
  w.set(m("a"), mem());
  w.delete(doc(db, "bands", "a", "invites", "fresh@band.com"));
  await assertSucceeds(w.commit());
  await assertSucceeds(getDoc(doc(db, "bands", "a", "stock", "hat"))); // now a band mate of A
  await assertFails(getDoc(doc(db, "bands", "b", "stock", "hat"))); // and only of A
});

test("an unverified email gets no membership and no access, whatever the role", async () => {
  const fresh = as("u-new3", "fresh3@band.com", false);
  await assertFails(setDoc(doc(fresh, "bands", "a", "members", "u-new3"), { email: "fresh3@band.com", displayName: "F", role: "pending", createdAt: 1 }));
  for (const who of [ids.adminA, ids.mateA, ids.pendA, ids.platform]) {
    const db = as(who, undefined, false);
    await assertFails(getDoc(doc(db, "bands", "a", "members", who)));
    await assertFails(getDoc(doc(db, "bands", "a", "stock", "hat")));
    await assertFails(getDocs(collection(db, "bands", "a", "sales")));
    await assertFails(setDoc(doc(db, "bands", "a", "items", "x"), { name: "X", visible: true }));
    await assertFails(updateDoc(doc(db, "bands", "a", "members", who), { displayName: "Renamed" }));
  }
  await assertSucceeds(getDoc(doc(as(ids.mateA, undefined, false), "bands", "a", "items", "hat"))); // public catalogue stays public
});

test("pending and disabled members cannot touch band data", async () => {
  for (const who of [ids.pendA, ids.offA]) {
    const db = as(who);
    await assertFails(getDoc(doc(db, "bands", "a", "stock", "hat")));
    await assertFails(getDocs(collection(db, "bands", "a", "sales")));
    await assertFails(setDoc(doc(db, "bands", "a", "items", "x"), { name: "X", visible: true }));
    await assertFails(updateDoc(doc(db, "bands", "a", "members", who), { role: "bandmate" }));
    await assertSucceeds(updateDoc(doc(db, "bands", "a", "members", who), { displayName: "Renamed" }));
  }
});

test("band mate runs their own desk but cannot manage people", async () => {
  const db = as(ids.mateA);
  const p = (...x) => doc(db, "bands", "a", ...x);
  await assertSucceeds(getDoc(p("stock", "hat")));
  await assertSucceeds(setDoc(p("stock", "hat"), { qty: 60 }));
  await assertSucceeds(addItem(db, "a", "cup")); // items are created together with the usage counter
  await assertSucceeds(updateDoc(p("items", "cup"), { price: 13 }));
  await assertSucceeds(getDocs(collection(db, "bands", "a", "items")));
  await assertSucceeds(setDoc(p("settings", "public"), { bandName: "New name" }));
  await assertSucceeds(setDoc(p("sales", "s2"), { total: 25, undone: false, lines: [] }));
  await assertSucceeds(updateDoc(p("sales", "s1"), { undone: true }));
  await assertFails(updateDoc(p("sales", "s1"), { total: 0 }));
  await assertFails(deleteDoc(p("sales", "s1")));
  await assertFails(updateDoc(p("members", ids.pendA), { role: "bandmate" }));
  await assertFails(updateDoc(p("members", ids.mateA), { role: "admin" }));
  await assertFails(setDoc(doc(db, "bands", "a"), { name: "Hijacked", status: "active" })); // cannot edit the band record
});

test("band admin approves people in their band but cannot change own role", async () => {
  const db = as(ids.adminA);
  const m = (u) => doc(db, "bands", "a", "members", u);
  await assertSucceeds(updateDoc(m(ids.pendA), { role: "bandmate" }));
  await assertSucceeds(updateDoc(m(ids.mateA), { role: "disabled" }));
  await assertFails(updateDoc(m(ids.adminA), { role: "bandmate" }));
  await assertSucceeds(deleteDoc(doc(db, "bands", "a", "sales", "s1")));
});

test("a band can never reach another band, even with a role there", async () => {
  for (const who of [ids.adminA, ids.mateA]) {
    const db = as(who);
    await assertFails(getDoc(doc(db, "bands", "b", "stock", "hat")));
    await assertFails(getDocs(collection(db, "bands", "b", "sales")));
    await assertFails(getDoc(doc(db, "bands", "b", "settings", "band")));
    await assertFails(getDocs(collection(db, "bands", "b", "members")));
    await assertFails(setDoc(doc(db, "bands", "b", "items", "x"), { name: "X", visible: true }));
    await assertFails(setDoc(doc(db, "bands", "b", "stock", "hat"), { qty: 0 }));
    await assertFails(setDoc(doc(db, "bands", "b", "settings", "public"), { bandName: "Hijacked" }));
    await assertFails(updateDoc(doc(db, "bands", "b", "members", ids.mateB), { role: "disabled" }));
    await assertFails(updateDoc(doc(db, "bands", "b", "members", ids.both), { role: "admin" }));
    await assertFails(deleteDoc(doc(db, "bands", "b", "sales", "s1")));
  }
});

test("one login in two bands has the role of each band, not the stronger one", async () => {
  const db = as(ids.both);
  await assertSucceeds(getDoc(doc(db, "bands", "a", "stock", "hat"))); // band mate in A
  await assertFails(getDoc(doc(db, "bands", "b", "stock", "hat"))); // only pending in B
  await assertFails(setDoc(doc(db, "bands", "b", "items", "x"), { name: "X", visible: true }));
  const stranger = as(ids.stranger);
  await assertFails(getDoc(doc(stranger, "bands", "a", "stock", "hat")));
  await assertFails(getDoc(doc(stranger, "bands", "a", "members", ids.mateA)));
});

test("only the BandMate operator creates bands and domains, and sees every band", async () => {
  const op = as(ids.platform);
  await assertSucceeds(setDoc(doc(op, "bands", "new-band"), { name: "New", status: "active", createdAt: 1 }));
  await assertSucceeds(setDoc(doc(op, "domains", "new.bandmate.app"), { bandId: "new-band" }));
  await assertSucceeds(getDocs(collection(op, "bands")));
  await assertSucceeds(getDocs(collection(op, "domains")));
  await assertSucceeds(getDoc(doc(op, "bands", "b", "stock", "hat")));
  await assertSucceeds(updateDoc(doc(op, "bands", "b", "members", ids.mateB), { role: "disabled" }));
  await assertSucceeds(setDoc(doc(op, "bands", "new-band", "members", "u-first-admin"), { email: "o@x.com", displayName: "O", role: "admin" }));
  for (const db of [as(ids.adminA), as(ids.mateA), as(ids.stranger), fan()]) {
    await assertFails(setDoc(doc(db, "bands", "new-band"), { name: "New", status: "active" }));
    await assertFails(setDoc(doc(db, "domains", "evil.com"), { bandId: "a" }));
    await assertFails(setDoc(doc(db, "domains", "merch.band-a.com"), { bandId: "b" })); // cannot repoint a domain
    await assertFails(setDoc(doc(db, "platformAdmins", "u-evil"), { email: "e@x.com" }));
  }
  await assertSucceeds(getDoc(doc(fan(), "domains", "merch.band-a.com"))); // looked up by fans' browsers
});

test("storage: only a band's own staff upload into that band's folder; everyone reads", async () => {
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const up = (ctx, path, type = "image/png") => uploadBytes(ref(ctx.storage(), path), png, { contentType: type });
  await assertFails(up(env.unauthenticatedContext(), "bands/a/photos/p.png"));
  await assertFails(up(authed(ids.pendA), "bands/a/photos/p.png"));
  await assertFails(up(authed(ids.mateA, false), "bands/a/photos/p.png"));
  await assertSucceeds(up(authed(ids.mateA), "bands/a/photos/p.png"));
  await assertSucceeds(up(authed(ids.mateA), "bands/a/qr/q.png"));
  await assertSucceeds(up(authed(ids.adminA), "bands/a/logo/l.png"));
  await assertFails(up(authed(ids.mateA), "bands/b/photos/p.png")); // other band's folder
  await assertFails(up(authed(ids.mateB), "bands/a/photos/p.png"));
  await assertFails(up(authed(ids.both), "bands/b/photos/p.png")); // pending in B
  await assertFails(up(authed(ids.mateA), "bands/c/photos/p.png")); // paused band
  await assertFails(up(authed(ids.mateA), "bands/a/photos/p.html", "text/html"));
  await assertFails(up(authed(ids.mateA), "bands/a/secret/x.png"));
  await assertFails(up(authed(ids.mateA), "private/x.png"));
  await assertSucceeds(up(authed(ids.platform), "bands/b/photos/p.png")); // operator
});

test("band requests: one per verified account, valid address, terms stamped by the server, operator approves", async () => {
  const { serverTimestamp } = await import("firebase/firestore");
  const req = (over = {}) => ({
    uid: "u-founder", email: "founder@x.com", displayName: "Founder", bandName: "Helloween", bandId: "helloween",
    termsVersion: "v1", termsAcceptedAt: serverTimestamp(), status: "pending", createdAt: 1, ...over,
  });
  const founder = as("u-founder", "founder@x.com");
  const mine = (db) => doc(db, "bandRequests", "u-founder");
  await assertFails(setDoc(doc(fan(), "bandRequests", "u-founder"), req())); // not signed in
  await assertFails(setDoc(mine(as("u-founder", "founder@x.com", false)), req())); // unverified email
  await assertFails(setDoc(doc(as("u-other", "o@x.com"), "bandRequests", "u-founder"), req())); // someone else's slot
  await assertFails(setDoc(mine(founder), req({ email: "other@x.com" }))); // not their email
  await assertFails(setDoc(mine(founder), req({ status: "approved" }))); // cannot approve itself
  await assertFails(setDoc(mine(founder), req({ termsAcceptedAt: 123 }))); // terms time must come from the server
  await assertFails(setDoc(mine(founder), req({ bandId: "admin" }))); // reserved
  await assertFails(setDoc(mine(founder), req({ bandId: "Bad Id" }))); // not a valid address
  await assertFails(setDoc(mine(founder), req({ bandId: "ab" }))); // too short
  await assertFails(setDoc(mine(founder), req({ bandId: "a" }))); // an existing band
  await assertFails(setDoc(mine(founder), req({ bandName: "x" }))); // name too short
  await assertFails(setDoc(mine(founder), { ...req(), role: "admin" })); // no extra fields
  await assertFails(setDoc(mine(founder), req({ plan: "paid" }))); // Paid cannot be requested yet (no online payment)
  await assertSucceeds(setDoc(mine(founder), req({ plan: "free" })));
  await assertSucceeds(setDoc(doc(as("u-founder2", "f2@x.com"), "bandRequests", "u-founder2"), req({ uid: "u-founder2", email: "f2@x.com", bandId: "second-band", domain: "merch.second.com" }))); // optional own domain
  await assertFails(setDoc(mine(founder), req({ bandName: "Changed" }))); // already filed: cannot overwrite
  await assertFails(updateDoc(mine(founder), { status: "approved" })); // cannot approve itself
  await assertSucceeds(getDoc(mine(founder))); // can read their own
  await assertFails(getDoc(doc(as("u-other", "o@x.com"), "bandRequests", "u-founder"))); // not others'
  await assertFails(getDocs(collection(founder, "bandRequests"))); // no listing
  await assertFails(getDocs(collection(as(ids.adminA), "bandRequests"))); // a band admin is not the operator
  const op = as(ids.platform);
  await assertSucceeds(getDocs(collection(op, "bandRequests")));
  await assertSucceeds(updateDoc(mine(op), { status: "approved" }));
  await assertFails(deleteDoc(mine(founder))); // approved: the founder can no longer withdraw it
  await assertSucceeds(deleteDoc(doc(as("u-founder2", "f2@x.com"), "bandRequests", "u-founder2"))); // a pending one can be withdrawn
});

test("'which bands am I in': a person finds only their own memberships, by their own verified email", async () => {
  const mine = (db, email) => getDocs(query(collectionGroup(db, "members"), where("email", "==", email)));
  const me = as(ids.both, "u-both@x.com");
  const res = await assertSucceeds(mine(me, "u-both@x.com"));
  assert.equal(res.size, 2); // band mate in A, pending in B
  await assertFails(mine(me, "u-admin-a@x.com")); // someone else's memberships
  await assertFails(mine(me, "u-mate-b@x.com"));
  await assertFails(mine(as(ids.both, "u-both@x.com", false), "u-both@x.com")); // unverified email
  await assertFails(mine(fan(), "u-both@x.com")); // not signed in
  await assertFails(getDocs(collectionGroup(me, "members"))); // no unfiltered listing
  await assertFails(getDocs(collectionGroup(as(ids.adminA, "u-admin-a@x.com"), "members"))); // not even a band admin
  const op = as(ids.platform, "ops@bandmate.app");
  assert.equal((await assertSucceeds(mine(op, "u-both@x.com"))).size, 2); // the operator can check anyone (is this person already in a band?)
  await assertSucceeds(getDocs(collectionGroup(op, "members")));
});

test("only the BandMate operator can wipe a band; a band's own admin cannot delete the band", async () => {
  const admin = as(ids.adminA);
  await assertFails(deleteDoc(doc(admin, "bands", "a"))); // not even its own admin
  await assertFails(deleteDoc(doc(as(ids.mateA), "bands", "a")));
  await assertFails(deleteDoc(doc(fan(), "bands", "a")));
  const op = as(ids.platform);
  const p = (...x) => doc(op, "bands", "b", ...x);
  await assertSucceeds(deleteDoc(p("sales", "s1")));
  await assertSucceeds(deleteDoc(p("items", "hat")));
  await assertSucceeds(deleteDoc(p("stock", "hat")));
  await assertSucceeds(deleteDoc(p("members", ids.mateB)));
  await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), "bands", "b", "members", ids.platform), { email: "ops@x.com", displayName: "Ops", role: "admin", createdAt: 1 }); });
  await assertSucceeds(deleteDoc(p("members", ids.platform))); // the operator can remove even their own membership
  await assertSucceeds(deleteDoc(p("members", ids.both)));
  await assertSucceeds(deleteDoc(p("settings", "public")));
  await assertSucceeds(deleteDoc(p("settings", "band")));
  await assertSucceeds(deleteDoc(doc(op, "bands", "b")));
  await assertSucceeds(deleteDoc(doc(op, "domains", "merch.band-a.com")));
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  await env.withSecurityRulesDisabled(async (ctx) => { await uploadBytes(ref(ctx.storage(), "bands/a/photos/x.png"), png, { contentType: "image/png" }); });
  const { deleteObject } = await import("firebase/storage");
  const listing = (who) => listAll(ref(authed(who).storage(), "bands/a/photos"));
  assert.ok((await assertSucceeds(listing(ids.platform))).items.some((i) => i.name === "x.png")); // the operator can list a band's folders
  await assertSucceeds(listAll(ref(authed(ids.platform).storage(), "bands/a"))); // and the band's top folder
  const top = (who) => listAll(ref(who === null ? env.unauthenticatedContext().storage() : authed(who).storage(), "bands/a"));
  await assertFails(top(ids.adminA)); // a band's own admin cannot list the whole band folder
  await assertFails(top(ids.pendA));
  await assertFails(top(null)); // nor can the public
  await assertFails(deleteObject(ref(authed(ids.pendA).storage(), "bands/a/photos/x.png"))); // not staff
  await assertSucceeds(deleteObject(ref(authed(ids.platform).storage(), "bands/a/photos/x.png"))); // operator may remove pictures
});


test("plan limits: items are counted in the same batch and capped by the band's plan", async () => {
  const mateB = as(ids.mateB);
  await setUsage("b", { items: 99, bytes: 0, members: 1 }); // Free: 100 items
  await assertSucceeds(addItem(mateB, "b", "i100"));
  await assertFails(addItem(mateB, "b", "i101"));
  await assertSucceeds(deleteDoc(doc(mateB, "bands", "b", "items", "i100"))); // removing is always fine
  await setUsage("a", { items: 199, bytes: 0, members: 1 }); // Paid: 200 items
  await assertSucceeds(addItem(as(ids.mateA), "a", "i200"));
  await assertFails(addItem(as(ids.mateA), "a", "i201"));
  await setBand("b", { plan: "paid" }); // upgrading raises the limit at once
  await setUsage("b", { items: 150, bytes: 0, members: 1 });
  await assertSucceeds(addItem(mateB, "b", "i151"));
  await assertFails(addItem(as(ids.mateA), "b", "x")); // another band's staff never
});

test("usage counters: staff of that band only, only known fields, never negative", async () => {
  const u = (db, b = "a") => usageOf(db, b);
  await assertSucceeds(getDoc(u(as(ids.mateA))));
  await assertFails(getDoc(u(fan())));
  await assertFails(getDoc(u(as(ids.mateB)))); // another band
  await assertFails(getDoc(u(as(ids.pendA)))); // pending
  await assertSucceeds(setDoc(u(as(ids.mateA)), { items: 5, bytes: 10, members: 2 }));
  await assertFails(setDoc(u(as(ids.mateA)), { items: -1, bytes: 0, members: 1 }));
  await assertFails(setDoc(u(as(ids.mateA)), { items: 1, bytes: 0, members: 1, extra: 1 }));
  await assertFails(setDoc(u(as(ids.mateB), "a"), { items: 0, bytes: 0, members: 1 }));
});

test("plan and extra space can only be changed by the BandMate operator", async () => {
  for (const [db, b] of [[as(ids.adminB), "b"], [as(ids.mateB), "b"], [as(ids.adminA), "a"]]) {
    await assertFails(updateDoc(doc(db, "bands", b), { plan: "paid" }));
    await assertFails(updateDoc(doc(db, "bands", b), { extraPacks: 5 }));
  }
  const op = as(ids.platform);
  await assertSucceeds(updateDoc(doc(op, "bands", "b"), { plan: "paid", extraPacks: 2 }));
  await assertSucceeds(updateDoc(doc(op, "bands", "b"), { plan: "free", extraPacks: 0 }));
});

test("colours and logo backdrop are Paid only; name, tagline, currency and top bar are free", async () => {
  const theme = { primary: "#fff", bg: "#000", surface: "#111", text: "#eee" };
  const free = (id) => doc(as(ids.mateB), "bands", "b", "settings", id);
  await assertSucceeds(setDoc(free("public"), { bandName: "New", tagline: "Hi", currency: "€" }, { merge: true }));
  await assertSucceeds(setDoc(free("public"), { topBar: { enabled: false, email: "", links: [] } }, { merge: true }));
  await assertFails(setDoc(free("public"), { theme }, { merge: true }));
  await assertFails(setDoc(free("public"), { preset: "metal" }, { merge: true }));
  await assertFails(setDoc(free("public"), { logoUrl: "https://x/y.png", logoPath: "bands/b/logo/y.png" }, { merge: true }));
  await assertFails(setDoc(free("public"), { logoOpacity: 0.5 }, { merge: true }));
  await assertFails(setDoc(free("public"), { bandName: "Replaced", theme })); // a full overwrite is an update too
  await assertFails(deleteDoc(free("public"))); // cannot delete-and-recreate to dodge the lock
  const paid = doc(as(ids.mateA), "bands", "a", "settings", "public");
  await assertSucceeds(setDoc(paid, { theme, preset: "metal", logoOpacity: 0.5 }, { merge: true }));
  await assertFails(setDoc(doc(as(ids.mateA), "bands", "b", "settings", "public"), { bandName: "x" }, { merge: true })); // other band
  await setBand("b", { plan: "paid" }); // after an upgrade the same band can restyle
  await assertSucceeds(setDoc(free("public"), { theme }, { merge: true }));
});

test("invitations: Paid only, admin only, capped by the plan, one tap to remove someone", async () => {
  const inv = (db, b, email, over = {}) => {
    const w = writeBatch(db);
    w.set(doc(db, "bands", b, "invites", email), { email, role: "bandmate", invitedBy: "x", createdAt: 1, ...over });
    w.set(usageOf(db, b), { members: increment(1) }, { merge: true });
    return w.commit();
  };
  await setUsage("a", { items: 0, bytes: 0, members: 1 }); // Paid: 3 people
  const adminA = as(ids.adminA);
  await assertSucceeds(inv(adminA, "a", "p2@x.com"));
  await assertSucceeds(inv(adminA, "a", "p3@x.com"));
  await assertFails(inv(adminA, "a", "p4@x.com")); // 4th person
  await assertFails(inv(as(ids.mateA), "a", "q@x.com")); // not an admin
  await assertFails(inv(as(ids.adminB), "b", "q@x.com")); // Free plan: no invitations
  await assertFails(inv(adminA, "b", "q@x.com")); // another band
  await setUsage("a", { items: 0, bytes: 0, members: 1 });
  await assertFails(inv(adminA, "a", "r@x.com", { role: "admin" })); // only band mates
  await assertFails(inv(adminA, "a", "r@x.com", { extra: 1 }));
  await assertFails(inv(adminA, "a", "Upper@x.com")); // ids are lowercase
  await assertFails(setDoc(doc(adminA, "bands", "a", "invites", "s@x.com"), { email: "other@x.com", role: "bandmate", invitedBy: "x", createdAt: 1 })); // id must be the email
  await assertSucceeds(getDocs(collection(adminA, "bands", "a", "invites")));
  await assertFails(getDocs(collection(as(ids.mateA), "bands", "a", "invites")));
  await assertSucceeds(deleteDoc(doc(adminA, "bands", "a", "invites", "p2@x.com"))); // cancel an invitation
  const rm = writeBatch(adminA); // remove a member: no confirmation step, counter goes down
  rm.delete(doc(adminA, "bands", "a", "members", ids.mateA));
  rm.set(usageOf(adminA, "a"), { members: increment(-1) }, { merge: true });
  await assertSucceeds(rm.commit());
  await assertFails(deleteDoc(doc(adminA, "bands", "a", "members", ids.adminA))); // not yourself
  await assertFails(deleteDoc(doc(as(ids.mateB), "bands", "b", "members", ids.adminB)));
});

test("storage: picture space is capped by the plan, add-on packs raise it", async () => {
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); // 8 bytes
  const up = (ctx, path) => uploadBytes(ref(ctx.storage(), path), png, { contentType: "image/png" });
  const MB = 1024 * 1024;
  await setUsage("b", { items: 0, bytes: 50 * MB - 8, members: 1 }); // Free: 50 MB
  await assertSucceeds(up(authed(ids.mateB), "bands/b/photos/fits.png"));
  await setUsage("b", { items: 0, bytes: 50 * MB - 7, members: 1 });
  await assertFails(up(authed(ids.mateB), "bands/b/photos/over.png"));
  await setBand("b", { extraPacks: 1 }); // +150 MB
  await assertSucceeds(up(authed(ids.mateB), "bands/b/photos/packed.png"));
  await setUsage("b", { items: 0, bytes: 200 * MB - 7, members: 1 });
  await assertFails(up(authed(ids.mateB), "bands/b/photos/over2.png"));
  await setUsage("a", { items: 0, bytes: 150 * MB - 7, members: 1 }); // Paid: 150 MB
  await assertFails(up(authed(ids.mateA), "bands/a/photos/over3.png"));
  await setUsage("a", { items: 0, bytes: 150 * MB - 8, members: 1 });
  await assertSucceeds(up(authed(ids.mateA), "bands/a/photos/fits2.png"));
  await assertSucceeds(up(authed(ids.mateA), "bands/a/qr/q.png"));
});
