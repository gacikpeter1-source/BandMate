import type { Item } from "../types";
import { currentLang, currentLocale, tr } from "../i18n";

const SUFFIX = ["€", "Kč", "zł", "Ft", "kr", "lei", "CHF"];

export function money(n: number, currency = "€") {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  let t = v % 1 ? v.toFixed(2) : String(v);
  if (currentLang() === "sk") t = t.replace(".", ","); // 12,50 €
  return SUFFIX.includes(currency) ? `${t} ${currency}` : `${currency}${t}`;
}

const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "2XL", "3XL", "XXXL", "4XL", "5XL"];
export const sizeRank = (v: string) => {
  const i = SIZE_ORDER.indexOf(String(v || "").toUpperCase().trim());
  return i < 0 ? 100 : i;
};

export const gkey = (n: string) => String(n || "").trim().toLowerCase();

export const itemLabel = (it?: Pick<Item, "name" | "variant"> | null) =>
  it ? (it.variant ? `${it.name} ${it.variant}` : it.name) : tr("common.removedItem");

export interface Group {
  key: string;
  name: string;
  items: Item[];
  order: number;
}

export function groupItems(items: Item[]): Group[] {
  const g = new Map<string, Group>();
  for (const it of items) {
    const k = gkey(it.name);
    if (!g.has(k)) g.set(k, { key: k, name: it.name.trim(), items: [], order: it.order ?? 0 });
    const e = g.get(k)!;
    e.items.push(it);
    e.order = Math.min(e.order, it.order ?? 0);
  }
  const arr = [...g.values()];
  arr.forEach((e) =>
    e.items.sort((a, b) => sizeRank(a.variant) - sizeRank(b.variant) || a.variant.localeCompare(b.variant))
  );
  return arr.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

export function priceTag(items: Item[], currency: string) {
  const prices = [...new Set(items.map((i) => Number(i.price) || 0))];
  if (!prices.length) return "";
  return prices.length === 1 ? money(prices[0], currency) : `${money(Math.min(...prices), currency)}+`;
}

export const newKey = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function timeLabel(at: number) {
  const d = new Date(at);
  const today = new Date().toDateString() === d.toDateString();
  const loc = currentLocale();
  const t = d.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" });
  return today ? t : `${d.toLocaleDateString(loc, { day: "numeric", month: "short" })} ${t}`;
}

export function errorText(e: unknown) {
  const code = (e as { code?: string })?.code || "";
  const map: Record<string, Parameters<typeof tr>[0]> = {
    "auth/invalid-credential": "err.wrongCreds",
    "auth/wrong-password": "err.wrongCreds",
    "auth/user-not-found": "err.wrongCreds",
    "auth/invalid-email": "err.badEmail",
    "auth/email-already-in-use": "err.emailInUse",
    "auth/weak-password": "err.weakPassword",
    "auth/too-many-requests": "err.tooMany",
    "auth/network-request-failed": "err.network",
    "auth/requires-recent-login": "err.recentLogin",
    "permission-denied": "err.denied",
    "storage/unauthorized": "err.storageDenied",
  };
  if (map[code]) return tr(map[code]);
  return (e as Error)?.message || tr("err.generic");
}
