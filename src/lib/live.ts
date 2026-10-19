import { useEffect, useState } from "react";
import { onSnapshot, type Query, type DocumentReference } from "firebase/firestore";

export interface Live<T> {
  data: T;
  ready: boolean;
  error: string | null;
}

/** Live list from a Firestore query. `key` must change when the query changes. */
export function useLiveQuery<T>(make: () => Query | null, key: string): Live<T[]> {
  const [s, set] = useState<Live<T[]>>({ data: [], ready: false, error: null });
  useEffect(() => {
    const q = make();
    if (!q) {
      set({ data: [], ready: true, error: null });
      return;
    }
    set((p) => ({ ...p, ready: false }));
    return onSnapshot(
      q,
      (snap) => set({ data: snap.docs.map((d) => ({ ...(d.data() as object), id: d.id }) as T), ready: true, error: null }),
      (e) => set({ data: [], ready: true, error: e.code || e.message })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return s;
}

/** Live single document. */
export function useLiveDoc<T>(make: () => DocumentReference | null, key: string): Live<T | null> {
  const [s, set] = useState<Live<T | null>>({ data: null, ready: false, error: null });
  useEffect(() => {
    const r = make();
    if (!r) {
      set({ data: null, ready: true, error: null });
      return;
    }
    return onSnapshot(
      r,
      (snap) => set({ data: snap.exists() ? (snap.data() as T) : null, ready: true, error: null }),
      (e) => set({ data: null, ready: true, error: e.code || e.message })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return s;
}
