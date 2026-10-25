import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { limit, orderBy, query, setDoc } from "firebase/firestore";
import { useLiveDoc, useLiveQuery } from "../lib/live";
import type { BandSettings, BasketLine, Bundle, Invite, Item, Sale, UserProfile } from "../types";
import { bandCol, bandPath } from "../lib/scope";
import { useAuth } from "./auth";
import { useTenant } from "./tenant";
import { EMPTY_USAGE, limitsOf, type Limits, type Usage } from "../lib/plans";
import { setPlanState } from "../lib/planState";

interface BandData {
  items: Item[];
  stock: Record<string, number>;
  bundles: Bundle[];
  sales: Sale[];
  band: BandSettings;
  users: UserProfile[];
  /** Invitations sent and not accepted yet (admin only). */
  invites: Invite[];
  /** True once members and invitations have been read (the counter is only corrected then). */
  peopleReady: boolean;
  limits: Limits;
  usage: Usage;
  ready: boolean;
  basket: BasketLine[];
  setBasket: (fn: (b: BasketLine[]) => BasketLine[]) => void;
}

const Ctx = createContext<BandData | null>(null);

export function BandDataProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const { bandId, band: bandInfo } = useTenant();
  const admin = profile?.role === "admin";
  const items = useLiveQuery<Item>(() => bandCol("items"), `items-${bandId}`);
  const stockQ = useLiveQuery<{ id: string; qty: number }>(() => bandCol("stock"), `stock-${bandId}`);
  const bundles = useLiveQuery<Bundle>(() => bandCol("bundles"), `bundles-${bandId}`);
  const sales = useLiveQuery<Sale>(() => query(bandCol("sales"), orderBy("at", "desc"), limit(1000)), `sales-${bandId}`);
  const band = useLiveDoc<BandSettings>(() => bandPath("settings/band"), `settings-band-${bandId}`);
  const users = useLiveQuery<UserProfile>(() => (admin ? bandCol("members") : null), `members-${bandId}-${admin}`);
  const invites = useLiveQuery<Invite>(() => (admin ? bandCol("invites") : null), `invites-${bandId}-${admin}`);
  const usageDoc = useLiveDoc<Partial<Usage>>(() => bandPath("settings/usage"), `usage-${bandId}`);
  const limits = useMemo(() => limitsOf(bandInfo), [bandInfo]);
  const usage = useMemo<Usage>(() => ({ ...EMPTY_USAGE, ...(usageDoc.data || {}) }), [usageDoc.data]);
  useEffect(() => setPlanState(limits, usage), [limits, usage]);
  // The counter is what the plan limit is checked against. If it ever disagrees with the real number of
  // items (old data, another phone, an interrupted save), correct it once the disagreement has settled.
  const realItems = items.data.length;
  const itemsReady = items.ready && usageDoc.ready;
  useEffect(() => {
    if (!itemsReady || usage.items === realItems) return;
    const timer = setTimeout(() => {
      setDoc(bandPath("settings/usage"), { items: realItems }, { merge: true }).catch(() => {});
    }, 2500);
    return () => clearTimeout(timer);
  }, [itemsReady, realItems, usage.items]);
  const [basket, setBasketState] = useState<BasketLine[]>([]);

  const stock = useMemo(() => {
    const m: Record<string, number> = {};
    stockQ.data.forEach((s) => (m[s.id] = Number(s.qty) || 0));
    return m;
  }, [stockQ.data]);

  const value: BandData = {
    items: items.data,
    stock,
    bundles: bundles.data.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    sales: sales.data,
    band: { gig: "", ...(band.data || {}) },
    users: users.data,
    invites: invites.data,
    peopleReady: users.ready && invites.ready,
    limits,
    usage,
    ready: items.ready && stockQ.ready && bundles.ready && sales.ready && band.ready,
    basket,
    setBasket: (fn) => setBasketState(fn),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBand() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useBand outside BandDataProvider");
  return v;
}
