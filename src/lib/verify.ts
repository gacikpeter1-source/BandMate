import { sendEmailVerification, type ActionCodeSettings, type User } from "firebase/auth";
import { getBandId, getBase } from "./scope";

// After confirming, the link's "Continue" button brings the person back to this band's desk
// (or, on the BandMate address, to the "start your band" page).
// This only works for domains listed in Firebase Auth → Settings → Authorized domains.
export const verifyLinkSettings = (): ActionCodeSettings => ({ url: `${window.location.origin}${getBase()}${getBandId() ? "/band" : "/start"}` });

/** Sends the confirmation email. If this address isn't on Firebase's authorized-domains list the
 *  "continue" button can't be added, so it is sent without it rather than failing sign-up. */
export async function sendVerification(user: User) {
  try {
    await sendEmailVerification(user, verifyLinkSettings());
  } catch (e) {
    const code = (e as { code?: string })?.code || "";
    if (code === "auth/unauthorized-continue-uri" || code === "auth/invalid-continue-uri") await sendEmailVerification(user);
    else throw e;
  }
}
