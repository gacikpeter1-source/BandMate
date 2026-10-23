// Everything only the BandMate operator, or a new band's founder at /start, touches.
import { collection, deleteDoc, doc, getDoc, getDocs, limit, query, runTransaction, serverTimestamp, setDoc, updateDoc, where, writeBatch, type CollectionReference } from "firebase/firestore";
import { deleteObject, listAll, ref } from "firebase/storage";
import { db, storage } from "../firebase";
import { RESERVED_BAND_IDS } from "./host";
import { tr } from "../i18n";
import { DEFAULT_SETTINGS } from "../state/settings";
import { activeBands, fetchMyBands } from "./memberships";
import type { BandRequest } from "../types";

export const bandsCol = () => collection(db, "bands");
export const domainsCol = () => collection(db, "domains");
export const requestsCol = () => collection(db, "bandRequests");
export const requestDoc = (uid: string) => doc(db, "bandRequests", uid);

/** Bump when the terms text changes; the version a person agreed to is stored with their request. */
export const TERMS_VERSION = "2026-10-draft";

/** "Helloween Čierna!" -> "helloween-cierna" (letters and digits only, dashes between). */
export function slugify(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

export type SlugProblem = "short" | "bad" | "reserved" | "taken" | null;

export function slugFormatProblem(id: string): SlugProblem {
  if (id.length < 3) return "short";
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id) || id.length > 40) return "bad";
  if (RESERVED_BAND_IDS.includes(id)) return "reserved";
  return null;
}

export async function isBandIdTaken(id: string) {
  return (await getDoc(doc(db, "bands", id))).exists();
}

export function fileBandRequest(r: { uid: string; email: string; displayName: string; bandName: string; bandId: string; domain: string }) {
  return setDoc(requestDoc(r.uid), {
    uid: r.uid,
    email: r.email,
    displayName: r.displayName,
    bandName: r.bandName.trim(),
    bandId: r.bandId,
    ...(r.domain.trim() ? { domain: r.domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "") } : {}),
    termsVersion: TERMS_VERSION,
    termsAcceptedAt: serverTimestamp(), // the rules require the server's own clock here
    status: "pending",
    createdAt: Date.now(),
  });
}

export const cancelBandRequest = (uid: string) => deleteDoc(requestDoc(uid));

/** Creates the band, its default settings, its first admin and (if asked for) its own domain, in one
 *  all-or-nothing step, and marks the request approved. Fails if the address got taken meanwhile. */
export async function approveBandRequest(r: BandRequest) {
  // One email, one band. (A transaction can't run this lookup, so it is checked first.)
  const already = activeBands(await fetchMyBands(r.email)).find((b) => b.bandId !== r.bandId);
  if (already) throw new Error(tr("con.errAlreadyMember", { email: r.email, band: already.name }));
  return runTransaction(db, async (tx) => {
    const bandRef = doc(db, "bands", r.bandId);
    if ((await tx.get(bandRef)).exists()) throw new Error(tr("con.errTaken", { id: r.bandId }));
    let domainRef = null;
    if (r.domain) {
      domainRef = doc(db, "domains", r.domain);
      const existing = await tx.get(domainRef);
      if (existing.exists() && existing.data().bandId !== r.bandId) throw new Error(tr("con.errDomain", { d: r.domain }));
    }
    tx.set(bandRef, { name: r.bandName, status: "active", createdAt: Date.now() });
    tx.set(doc(db, "bands", r.bandId, "settings", "public"), { ...DEFAULT_SETTINGS, bandName: r.bandName });
    tx.set(doc(db, "bands", r.bandId, "settings", "band"), { gig: "" });
    tx.set(doc(db, "bands", r.bandId, "members", r.uid), { email: r.email, displayName: r.displayName, role: "admin", createdAt: Date.now() });
    if (domainRef) tx.set(domainRef, { bandId: r.bandId });
    tx.update(doc(db, "bandRequests", r.uid), { status: "approved", approvedAt: Date.now() });
  });
}

export const rejectBandRequest = (uid: string) => updateDoc(requestDoc(uid), { status: "rejected", rejectedAt: Date.now() });

export const setBandStatus = (bandId: string, status: "active" | "paused") => updateDoc(doc(db, "bands", bandId), { status });

export const addBandDomain = (host: string, bandId: string) =>
  setDoc(doc(db, "domains", host.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "")), { bandId });

async function deleteAllIn(col: CollectionReference) {
  for (;;) {
    const snap = await getDocs(query(col, limit(400)));
    if (snap.empty) return;
    const b = writeBatch(db);
    snap.docs.forEach((d) => b.delete(d.ref));
    await b.commit();
  }
}

async function deleteStorageFolder(path: string) {
  const res = await listAll(ref(storage, path));
  await Promise.all(res.items.map((i) => deleteObject(i)));
  for (const p of res.prefixes) await deleteStorageFolder(p.fullPath);
}

/** Erases a band completely: its data, pictures, addresses and registration request. Irreversible.
 *  The band record goes last, so an interrupted run can simply be started again. */
export async function deleteBand(bandId: string) {
  await setBandStatus(bandId, "paused"); // closes the store for fans while it is being emptied
  for (const sub of ["sales", "items", "stock", "bundles", "members"]) await deleteAllIn(collection(db, "bands", bandId, sub));
  for (const id of ["public", "band"]) await deleteDoc(doc(db, "bands", bandId, "settings", id));
  await deleteStorageFolder(`bands/${bandId}`);
  for (const col of [domainsCol(), requestsCol()]) {
    const snap = await getDocs(query(col, where("bandId", "==", bandId)));
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  }
  await deleteDoc(doc(db, "bands", bandId));
}
