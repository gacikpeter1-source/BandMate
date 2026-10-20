import type { ActionCodeSettings } from "firebase/auth";
import { getBase } from "./scope";

// After confirming, the link's "Continue" button brings the person back to this band's desk.
// This only works for domains listed in Firebase Auth → Settings → Authorized domains.
export const verifyLinkSettings = (): ActionCodeSettings => ({ url: `${window.location.origin}${getBase()}/band` });
