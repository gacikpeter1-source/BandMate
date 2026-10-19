// All writes that change stock. They use batched increments instead of
// transactions so they also work offline: the phone saves the sale at once
// and Firebase syncs it when the signal returns. Two phones selling the last
// piece at the same moment can push stock to -1; the Stock tab shows that as
// "oversold" so the band can see it rather than lose it.

import { collection, doc, increment, writeBatch, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import type { Item, Method, Sale, SaleLine } from "../types";

type StockMap = Record<string, number>;

function picksTotal(lines: SaleLine[]) {
  const need: Record<string, number> = {};
  for (const l of lines) for (const p of l.picks) need[p.itemId] = (need[p.itemId] || 0) + p.qty;
  return need;
}

const clean = (l: SaleLine): SaleLine => ({
  kind: l.kind,
  refId: l.refId,
  label: l.label,
  ...(l.detail ? { detail: l.detail } : {}),
  price: l.price,
  qty: l.qty,
  picks: l.picks.map((p) => ({ itemId: p.itemId, qty: p.qty })),
});

export function recordSale(opts: {
  lines: SaleLine[];
  method: Method;
  gig: string;
  by: string;
  byName: string;
  stock: StockMap;
}) {
  const b = writeBatch(db);
  const ref = doc(collection(db, "sales"));
  for (const [id, n] of Object.entries(picksTotal(opts.lines))) {
    b.set(doc(db, "stock", id), { qty: increment(-n) }, { merge: true });
    b.update(doc(db, "items", id), { soldOut: (opts.stock[id] ?? 0) - n <= 0 });
  }
  const total = opts.lines.reduce((t, l) => t + l.price * l.qty, 0);
  b.set(ref, {
    at: Date.now(),
    by: opts.by,
    byName: opts.byName,
    method: opts.method,
    gig: opts.gig,
    total,
    lines: opts.lines.map(clean),
    undone: false,
  });
  return { id: ref.id, total, saved: b.commit() };
}

/** Cancel (undone=true) or restore a sale, putting stock back or taking it again. */
export function setSaleUndone(sale: Pick<Sale, "id" | "lines">, undone: boolean, stock: StockMap, items: Item[]) {
  const b = writeBatch(db);
  const sign = undone ? 1 : -1;
  const exists = new Set(items.map((i) => i.id));
  for (const [id, n] of Object.entries(picksTotal(sale.lines))) {
    if (!exists.has(id)) continue;
    b.set(doc(db, "stock", id), { qty: increment(sign * n) }, { merge: true });
    b.update(doc(db, "items", id), { soldOut: (stock[id] ?? 0) + sign * n <= 0 });
  }
  b.update(doc(db, "sales", sale.id), { undone });
  return b.commit();
}

export function addStock(itemId: string, delta: number, current: number) {
  const b = writeBatch(db);
  b.set(doc(db, "stock", itemId), { qty: increment(delta) }, { merge: true });
  b.update(doc(db, "items", itemId), { soldOut: current + delta <= 0 });
  return b.commit();
}

export function setStockCount(itemId: string, qty: number) {
  const b = writeBatch(db);
  b.set(doc(db, "stock", itemId), { qty });
  b.update(doc(db, "items", itemId), { soldOut: qty <= 0 });
  return b.commit();
}

export function createItems(
  base: { name: string; price: number; qrUrl: string | null; qrPath: string | null; visible: boolean },
  variants: string[],
  qty: number,
  orderStart: number
) {
  const b = writeBatch(db);
  (variants.length ? variants : [""]).forEach((variant, i) => {
    const ref = doc(collection(db, "items"));
    b.set(ref, { ...base, variant, soldOut: qty <= 0, order: orderStart + i });
    b.set(doc(db, "stock", ref.id), { qty });
  });
  return b.commit();
}

export const updateItem = (id: string, data: Partial<Omit<Item, "id">>) => updateDoc(doc(db, "items", id), data);

export function deleteItem(id: string) {
  const b = writeBatch(db);
  b.delete(doc(db, "items", id));
  b.delete(doc(db, "stock", id));
  return b.commit();
}

export const saveDoc = (path: string, data: object, merge = true) => setDoc(doc(db, path), data, { merge });
