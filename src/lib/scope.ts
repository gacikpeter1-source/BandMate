// The band this page is showing. Set once by TenantProvider before any child renders, so plain
// (non-React) code such as lib/ops.ts and lib/images.ts can build per-band paths.
// Every band's data lives under bands/{bandId}/..., which is what the security rules key on.
import { collection, doc } from "firebase/firestore";
import { db } from "../firebase";

let currentBandId = "";
let currentBase = "";

export function setScope(bandId: string, base: string) {
  currentBandId = bandId;
  currentBase = base;
}
export const getBandId = () => currentBandId;
/** URL prefix of this band: "" on its own domain, "/b/<bandId>" when reached through the BandMate address. */
export const getBase = () => currentBase;

export const bandCol = (name: string) => collection(db, "bands", currentBandId, name);
export const bandDoc = (name: string, id: string) => doc(db, "bands", currentBandId, name, id);
/** "settings/public" style path inside the current band. */
export const bandPath = (path: string) => doc(db, `bands/${currentBandId}/${path}`);
