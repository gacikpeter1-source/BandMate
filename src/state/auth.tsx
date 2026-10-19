import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import type { Role, UserProfile } from "../types";

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  ready: boolean;
}

const Ctx = createContext<AuthState>({ user: null, profile: null, ready: false });

// The register page sets the chosen name here before the account exists, so the
// profile document is created once, by the listener below, with the right name.
let pendingName: string | null = null;
export const setPendingName = (n: string) => {
  pendingName = n;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [s, set] = useState<AuthState>({ user: null, profile: null, ready: false });

  useEffect(() => {
    let stopDoc: (() => void) | null = null;
    const stop = onAuthStateChanged(auth, (u) => {
      stopDoc?.();
      stopDoc = null;
      if (!u) {
        set({ user: null, profile: null, ready: true });
        return;
      }
      set({ user: u, profile: null, ready: false });
      const ref = doc(db, "users", u.uid);
      stopDoc = onSnapshot(
        ref,
        (snap) => {
          if (!snap.exists()) {
            const email = (u.email || "").toLowerCase();
            setDoc(ref, {
              email,
              displayName: pendingName || u.displayName || email.split("@")[0],
              role: "pending",
              createdAt: Date.now(),
            }).catch(() => set({ user: u, profile: null, ready: true }));
            pendingName = null;
            return;
          }
          set({ user: u, profile: { ...(snap.data() as Omit<UserProfile, "id">), id: snap.id }, ready: true });
        },
        () => set({ user: u, profile: null, ready: true })
      );
    });
    return () => {
      stop();
      stopDoc?.();
    };
  }, []);

  return <Ctx.Provider value={s}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
export const isStaff = (r?: Role) => r === "bandmate" || r === "admin";
export const ROLE_LABEL: Record<Role, string> = {
  pending: "Waiting for approval",
  bandmate: "BandMate",
  admin: "Admin",
  disabled: "Disabled",
};
