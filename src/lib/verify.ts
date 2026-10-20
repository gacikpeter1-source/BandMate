import type { ActionCodeSettings } from "firebase/auth";

// After confirming, the link's "Continue" button brings the person back to the app.
// This only works for domains listed in Firebase Auth → Settings → Authorized domains.
export const verifyLinkSettings = (): ActionCodeSettings => ({ url: `${window.location.origin}/band` });
