import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc, getDocFromServer, onSnapshot, writeBatch } from "firebase/firestore";
import { auth, db } from "../firebase";
import type { Role, UserProfile } from "../types";
import { tr } from "../i18n";
import { useTenant } from "./tenant";

interface AuthState {
  user: User | null;
  /** This person's membership in the current band (role pending/bandmate/admin/disabled). */
  profile: UserProfile | null;
  /** BandMate operator: may open every band's desk as admin. */
  isPlatform: boolean;
  ready: boolean;
}
interface AuthCtx extends AuthState {
  /** Re-reads the account from Firebase after the person clicked the email link. */
  recheck: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({ user: null, profile: null, isPlatform: false, ready: false, recheck: async () => {} });

// The invitation page sets the chosen name here, so the membership document is created once,
// by the listener below, with the right name.
let pendingName: string | null = null;
export const setPendingName = (n: string) => {
  pendingName = n;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const { bandId } = useTenant();
  const [s, set] = useState<AuthState>({ user: null, profile: null, isPlatform: false, ready: false });
  const [tick, setTick] = useState(0);

  const recheck = async () => {
    const u = auth.currentUser;
    if (!u) return;
    await u.reload();
    await u.getIdToken(true); // the rules read email_verified from the token, so refresh it
    setTick((t) => t + 1);
  };

  useEffect(() => {
    let stopDoc: (() => void) | null = null;
    let cancelled = false;
    const stop = onAuthStateChanged(auth, (u) => {
      stopDoc?.();
      stopDoc = null;
      if (!u) {
        set({ user: null, profile: null, isPlatform: false, ready: true });
        return;
      }
      // Nobody gets a membership (or any access) until the email address is confirmed;
      // firestore.rules and storage.rules enforce the same thing on the server.
      if (!u.emailVerified) {
        set({ user: u, profile: null, isPlatform: false, ready: true });
        return;
      }
      set({ user: u, profile: null, isPlatform: false, ready: false });
      (async () => {
        let platform = false;
        try {
          platform = (await getDoc(doc(db, "platformAdmins", u.uid))).exists();
        } catch {
          /* not an operator, or offline */
        }
        if (cancelled) return;
        if (!bandId) {
          set({ user: u, profile: null, isPlatform: platform, ready: true });
          return;
        }
        const ref = doc(db, "bands", bandId, "members", u.uid);
        let seq = 0;
        stopDoc = onSnapshot(
          ref,
          (snap) => {
            const mine = ++seq;
            const email = (u.email || "").toLowerCase();
            const member = snap.exists() ? ({ ...(snap.data() as Omit<UserProfile, "id">), id: snap.id } as UserProfile) : null;
            const apply = (m: UserProfile | null) => {
              if (mine !== seq || cancelled) return; // a newer snapshot already decided
              if (!m && !platform) {
                // Nobody joins on their own. If an admin invited this (verified) address, accepting means
                // creating the membership and using up the invitation, in one step.
                const inviteRef = doc(db, "bands", bandId, "invites", email);
                getDoc(inviteRef)
                  .then((inv) => {
                    if (!inv.exists()) return set({ user: u, profile: null, isPlatform: platform, ready: true });
                    const b = writeBatch(db);
                    b.set(ref, { email, displayName: pendingName || u.displayName || email.split("@")[0], role: inv.data().role || "bandmate", createdAt: Date.now() });
                    b.delete(inviteRef);
                    pendingName = null;
                    return b.commit(); // the snapshot listener fires again with the new membership
                  })
                  .catch(() => set({ user: u, profile: null, isPlatform: platform, ready: true }));
                return;
              }
              const profile: UserProfile | null = platform
                ? { id: u.uid, email, displayName: m?.displayName || u.displayName || email.split("@")[0], role: "admin" }
                : m;
              set({ user: u, profile, isPlatform: platform, ready: true });
            };
            if (member && snap.metadata.fromCache && !platform) {
              // A membership remembered on this phone may have been removed since. Ask the server before
              // opening the desk, so a removed person never starts reading data they no longer may read.
              // Offline (or a very slow signal) the remembered membership is trusted, so the desk still works.
              Promise.race([getDocFromServer(ref).then((x) => x.exists()), new Promise<boolean>((r) => setTimeout(() => r(true), 3000))])
                .catch(() => true)
                .then((stillThere) => apply(stillThere ? member : null));
            } else apply(member);
          },
          () => set({ user: u, profile: null, isPlatform: platform, ready: true })
        );
      })();
    });
    return () => {
      cancelled = true;
      stop();
      stopDoc?.();
    };
  }, [tick, bandId]);

  return <Ctx.Provider value={{ ...s, recheck }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
export const isStaff = (r?: Role) => r === "bandmate" || r === "admin";
export const roleLabel = (r: Role) => tr(`role.${r}` as const);
