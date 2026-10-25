// Inviting people into a band (paid plans) and removing them again.
// An invitation is a document bands/{bandId}/invites/{email} plus Firebase's own "sign-in link" email: the link
// proves the address is real, then the person chooses a password (pages/band/Accept.tsx). Accepting it turns the
// invitation into a membership (state/auth.tsx). "members" in settings/usage counts members + open invitations.
import { sendSignInLinkToEmail } from "firebase/auth";
import { increment, writeBatch } from "firebase/firestore";
import { auth, db } from "../firebase";
import { PLATFORM_HOST, isPlatformHost } from "./host";
import { assertUserRoom } from "./planState";
import { bandDoc, getBandId, getBase } from "./scope";
import { usageDoc } from "./ops";

/** Where the invitation email's link lands. Always on the BandMate address (or localhost): a band's own
 *  address would also have to be on Firebase's authorized-domains list, this one already is. */
export function acceptUrl(email: string) {
  const origin = isPlatformHost() ? window.location.origin : `https://${PLATFORM_HOST}`;
  const base = isPlatformHost() ? getBase() : `/b/${getBandId()}`;
  return `${origin}${base}/accept?e=${encodeURIComponent(email)}`;
}

export async function cancelInvite(email: string) {
  const b = writeBatch(db);
  b.delete(bandDoc("invites", email));
  b.set(usageDoc(), { members: increment(-1) }, { merge: true });
  return b.commit();
}

export async function inviteMember(emailRaw: string, invitedBy: string) {
  const email = emailRaw.trim().toLowerCase();
  assertUserRoom(); // the rules enforce the same limit and "Paid plans only"
  const b = writeBatch(db);
  b.set(bandDoc("invites", email), { email, role: "bandmate", invitedBy, createdAt: Date.now() });
  b.set(usageDoc(), { members: increment(1) }, { merge: true });
  await b.commit();
  try {
    await sendSignInLinkToEmail(auth, email, { url: acceptUrl(email), handleCodeInApp: true });
  } catch (e) {
    await cancelInvite(email).catch(() => {}); // no email went out, so don't keep a place reserved
    throw e;
  }
  return email;
}

/** Removes a person from the band at once (their login stays in Firebase Auth but opens nothing). */
export async function removeMember(uid: string) {
  const b = writeBatch(db);
  b.delete(bandDoc("members", uid));
  b.set(usageDoc(), { members: increment(-1) }, { merge: true });
  return b.commit();
}
