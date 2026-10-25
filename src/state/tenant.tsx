import { createContext, useContext, useMemo, type ReactNode } from "react";
import { doc } from "firebase/firestore";
import { db } from "../firebase";
import { useLiveDoc } from "../lib/live";
import { setScope } from "../lib/scope";

export interface BandInfo {
  name: string;
  status: "active" | "paused";
  createdAt?: number;
  /** "free" when missing. Only the BandMate operator can change plan and extraPacks (see lib/plans.ts). */
  plan?: "free" | "paid";
  extraPacks?: number;
}

interface TenantState {
  /** "" on the platform pages (BandMate home and admin). */
  bandId: string;
  base: string;
  band: BandInfo | null;
  ready: boolean;
}

const Ctx = createContext<TenantState>({ bandId: "", base: "", band: null, ready: true });

export function TenantProvider({ bandId, base, children }: { bandId: string; base: string; children: ReactNode }) {
  setScope(bandId, base); // before children render, so lib/ code sees the right band
  const live = useLiveDoc<BandInfo>(() => (bandId ? doc(db, "bands", bandId) : null), `band-${bandId}`);
  const value = useMemo<TenantState>(
    () => ({ bandId, base, band: live.data, ready: !bandId || live.ready }),
    [bandId, base, live.data, live.ready]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useTenant = () => useContext(Ctx);
