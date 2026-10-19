import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { collection, doc, limit, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";
import { useLiveDoc, useLiveQuery } from "../lib/live";
import type { BandSettings, BasketLine, Bundle, Item, Sale, UserProfile } from "../types";
import { useAuth } from "./auth";

interface BandData {
  items: Item[];
  stock: Record<string, number>;
  bundles: Bundle[];
  sales: Sale[];
  band: BandSettings;
  users: UserProfile[];
  ready: boolean;
  basket: BasketLine[];
  setBasket: (fn: (b: BasketLine[]) => BasketLine[]) => void;
}

const Ctx = createContext<BandData | null>(null);

export function BandDataProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const admin = profile?.role === "admin";
  const items = useLiveQuery<Item>(() => collection(db, "items"), "items");
  const stockQ = useLiveQuery<{ id: string; qty: number }>(() => collection(db, "stock"), "stock");
  const bundles = useLiveQuery<Bundle>(() => collection(db, "bundles"), "bundles");
  const sales = useLiveQuery<Sale>(() => query(collection(db, "sales"), orderBy("at", "desc"), limit(1000)), "sales");
  const band = useLiveDoc<BandSettings>(() => doc(db, "settings", "band"), "settings-band");
  const users = useLiveQuery<UserProfile>(() => (admin ? collection(db, "users") : null), `users-${admin}`);
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
