import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useBand } from "../../state/band";
import { useSettings } from "../../state/settings";
import { useAuth } from "../../state/auth";
import { useToast } from "../../state/toast";
import { gkey, groupItems, itemLabel, money, newKey, priceTag, sizeRank } from "../../lib/format";
import { recordSale, setSaleUndone } from "../../lib/ops";
import { errorText } from "../../lib/format";
import { Icon, QrFull, Sheet } from "../../components/ui";
import type { BasketLine, Bundle, Item, Method } from "../../types";

export function basketMap(basket: BasketLine[]) {
  const m: Record<string, number> = {};
  for (const l of basket) for (const p of l.picks) m[p.itemId] = (m[p.itemId] || 0) + p.qty;
  return m;
}

export default function Sell() {
  const { items, stock, bundles, basket, setBasket } = useBand();
  const { settings } = useSettings();
  const cur = settings.currency;
  const [picker, setPicker] = useState<Bundle | null>(null);
  const [checkout, setCheckout] = useState(false);
  const inBasket = basketMap(basket);
  const avail = (id: string, extra = 0) => (stock[id] ?? 0) - (inBasket[id] ?? 0) - extra;
  const groups = groupItems(items);

  const add = (it: Item) => {
    if (avail(it.id) <= 0) return;
    setBasket((b) => {
      const ex = b.find((l) => l.kind === "item" && l.refId === it.id);
      if (ex) return b.map((l) => (l === ex ? { ...l, qty: l.qty + 1, picks: [{ itemId: it.id, qty: l.qty + 1 }] } : l));
      return [...b, { key: newKey(), kind: "item", refId: it.id, label: itemLabel(it), price: Number(it.price) || 0, qty: 1, qrUrl: it.qrUrl, picks: [{ itemId: it.id, qty: 1 }] }];
    });
  };

  const groupAvail = (name: string) => items.filter((i) => gkey(i.name) === gkey(name)).reduce((t, i) => t + Math.max(0, avail(i.id)), 0);
  const bundleOk = (b: Bundle) => b.parts.length > 0 && b.parts.every((p) => groupAvail(p.name) >= (p.qty || 1));

  if (!groups.length && !bundles.length)
    return (
      <div className="empty">
        <h3>Your merch box is empty</h3>
        <p>Add what you brought to the gig: each shirt size, hats, cups. Then attach a payment QR picture to each one.</p>
        <Link className="btn primary" to="/band/stock">Add stock</Link>
      </div>
    );

  const count = basket.reduce((t, l) => t + l.qty, 0);
  const total = basket.reduce((t, l) => t + l.qty * l.price, 0);

  return (
    <>
      <h2 className="sec">Tap a size to add it to the basket</h2>
      <div className="grid">
        {groups.map((g) => {
          const single = g.items.length === 1 && !g.items[0].variant;
          const left = g.items.reduce((t, i) => t + Math.max(0, stock[i.id] ?? 0), 0);
          return (
            <article className="tile" key={g.key}>
              <div className="tile-top">
                <div className="tile-id">
                  {g.items.find((i) => i.images?.length)?.images?.[0] && <img className="thumb" src={g.items.find((i) => i.images?.length)!.images![0].url} alt="" />}
                  <div>
                    <h3>{g.name}</h3>
                    <div className="sub num">{left} in stock</div>
                  </div>
                </div>
                <span className="tag">{priceTag(g.items, cur)}</span>
              </div>
              {single ? (
                <button className={`btn block ${avail(g.items[0].id) > 0 ? "primary" : ""}`} disabled={avail(g.items[0].id) <= 0} onClick={() => add(g.items[0])}>
                  {avail(g.items[0].id) > 0 ? "Add to basket" : (stock[g.items[0].id] ?? 0) > 0 ? "All in basket" : "Sold out"}
                  {inBasket[g.items[0].id] ? <span className="num"> ({inBasket[g.items[0].id]})</span> : null}
                </button>
              ) : (
                <div className="sizes">
                  {g.items.map((it) => (
                    <button key={it.id} className="chip" disabled={avail(it.id) <= 0} onClick={() => add(it)} aria-label={`Add ${itemLabel(it)}, ${Math.max(0, stock[it.id] ?? 0)} left`}>
                      <b>{it.variant || "One size"}</b>
                      <small className="num">{Math.max(0, stock[it.id] ?? 0)} left</small>
                      {inBasket[it.id] ? <span className="badge num">{inBasket[it.id]}</span> : null}
                    </button>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
      {bundles.length > 0 && (
        <>
          <h2 className="sec">Bundles</h2>
          <div className="grid">
            {bundles.map((b) => {
              const ok = bundleOk(b);
              const choose = b.parts.some((p) => items.filter((i) => gkey(i.name) === gkey(p.name)).length > 1);
              return (
                <article className="tile bundle" key={b.id}>
                  <div className="tile-top">
                    <div className="tile-id">
                      {b.images?.[0] && <img className="thumb" src={b.images[0].url} alt="" />}
                      <div>
                        <h3>{b.name}</h3>
                        <div className="sub">{b.parts.map((p) => `${p.qty > 1 ? p.qty + "× " : ""}${p.name}`).join(" + ")}</div>
                      </div>
                    </div>
                    <span className="tag">{money(b.price, cur)}</span>
                  </div>
                  <button className={`btn block ${ok ? "primary" : ""}`} disabled={!ok} onClick={() => setPicker(b)}>
                    {ok ? (choose ? "Choose sizes" : "Add bundle") : "Not enough stock"}
                  </button>
                </article>
              );
            })}
          </div>
        </>
      )}
      {basket.length > 0 && (
        <div className="basket">
          <button className="basket-in" onClick={() => setCheckout(true)}>
            <span className="cnt num">{count} in basket</span>
            <span className="tot num">{money(total, cur)}</span>
            <span className="go">Checkout</span>
          </button>
        </div>
      )}
      {picker && <BundlePicker bundle={picker} avail={avail} onClose={() => setPicker(null)} />}
      {checkout && <Checkout onClose={() => setCheckout(false)} avail={avail} />}
    </>
  );
}

function BundlePicker({ bundle, avail, onClose }: { bundle: Bundle; avail: (id: string, extra?: number) => number; onClose: () => void }) {
  const { items, setBasket } = useBand();
  const { settings } = useSettings();
  const slots = useMemo(() => {
    const s: { name: string; n: number; of: number; options: Item[] }[] = [];
    bundle.parts.forEach((p) => {
      const opts = items.filter((i) => gkey(i.name) === gkey(p.name)).sort((a, b) => sizeRank(a.variant) - sizeRank(b.variant));
      for (let k = 0; k < (p.qty || 1); k++) s.push({ name: p.name, n: k + 1, of: p.qty || 1, options: opts });
    });
    return s;
  }, [bundle, items]);
  const [picked, setPicked] = useState<(string | null)[]>(() => slots.map((s) => (s.options.length === 1 ? s.options[0].id : null)));

  const usedExcept = (idx: number) => {
    const m: Record<string, number> = {};
    picked.forEach((id, i) => i !== idx && id && (m[id] = (m[id] || 0) + 1));
    return m;
  };
  const all = usedExcept(-1);
  const ok = picked.every(Boolean) && Object.entries(all).every(([id, n]) => avail(id) >= n);

  const addBundle = () => {
    const picks = Object.entries(all).map(([itemId, qty]) => ({ itemId, qty }));
    const detail = picks
      .map((p) => {
        const it = items.find((i) => i.id === p.itemId);
        return `${p.qty > 1 ? p.qty + "× " : ""}${itemLabel(it)}`;
      })
      .join(", ");
    setBasket((b) => [...b, { key: newKey(), kind: "bundle", refId: bundle.id, label: bundle.name, detail, price: Number(bundle.price) || 0, qty: 1, qrUrl: bundle.qrUrl, picks }]);
    onClose();
  };

  // Nothing to choose: add straight away.
  if (slots.every((s) => s.options.length === 1) && ok) {
    queueMicrotask(addBundle);
    return null;
  }

  return (
    <Sheet title={bundle.name} onClose={onClose}>
      {slots.map((s, i) => {
        if (!s.options.length) return <p key={i} className="hint err">No “{s.name}” in stock list.</p>;
        if (s.options.length === 1)
          return (
            <div className="pick" key={i}>
              <h4>{s.name}</h4>
              <span className="note">{itemLabel(s.options[0])} · included</span>
            </div>
          );
        const used = usedExcept(i);
        return (
          <div className="pick" key={i}>
            <h4>
              {s.name}
              {s.of > 1 ? ` ${s.n} of ${s.of}` : ""}
            </h4>
            <div className="sizes">
              {s.options.map((it) => {
                const a = avail(it.id, used[it.id] || 0);
                return (
                  <button key={it.id} className={`chip ${picked[i] === it.id ? "sel" : ""}`} disabled={a <= 0 && picked[i] !== it.id} onClick={() => setPicked((p) => p.map((v, j) => (j === i ? it.id : v)))}>
                    <b>{it.variant || "One size"}</b>
                    <small className="num">{Math.max(0, a)} left</small>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      <button className="btn primary block" disabled={!ok} onClick={addBundle}>
        Add bundle · {money(bundle.price, settings.currency)}
      </button>
    </Sheet>
  );
}

function Checkout({ onClose, avail }: { onClose: () => void; avail: (id: string) => number }) {
  const { basket, setBasket, stock, items, band } = useBand();
  const { settings } = useSettings();
  const { profile } = useAuth();
  const toast = useToast();
  const cur = settings.currency;
  const qrs = basket.filter((l) => l.qrUrl).map((l) => ({ src: l.qrUrl!, title: l.label + (l.detail ? ` (${l.detail})` : ""), sub: l.qty > 1 ? `${l.qty}× ${money(l.price, cur)} = ${money(l.price * l.qty, cur)}` : money(l.price, cur) }));
  const [method, setMethod] = useState<Method>(qrs.length ? "qr" : "cash");
  const [idx, setIdx] = useState(0);
  const [full, setFull] = useState(false);
  const total = basket.reduce((t, l) => t + l.qty * l.price, 0);
  const q = qrs[Math.min(idx, Math.max(0, qrs.length - 1))];

  const change = (key: string, d: number) =>
    setBasket((b) =>
      b.flatMap((l) => {
        if (l.key !== key) return [l];
        const qty = l.qty + d;
        return qty <= 0 ? [] : [{ ...l, qty, picks: [{ itemId: l.refId, qty }] }];
      })
    );

  const confirm = () => {
    const { id, total, saved } = recordSale({ lines: basket, method, gig: band.gig, by: profile!.id, byName: profile!.displayName || profile!.email, stock });
    const lines = basket.map((l) => ({ ...l }));
    saved.catch((e) => toast(`Sale not saved: ${errorText(e)}`));
    setBasket(() => []);
    onClose();
    toast(`Sold · ${money(total, cur)}`, () => {
      setSaleUndone({ id, lines }, true, stock, items).catch((e) => toast(errorText(e)));
    });
  };

  if (!basket.length) {
    queueMicrotask(onClose);
    return null;
  }

  return (
    <Sheet title="Checkout" onClose={onClose}>
      <div>
        {basket.map((l) => (
          <div className="line" key={l.key}>
            <div className="nm">
              <b>{l.label}</b>
              {l.detail && <small>{l.detail}</small>}
              <small className="num">{money(l.price, cur)} each</small>
            </div>
            {l.kind === "item" ? (
              <div className="stepper">
                <button onClick={() => change(l.key, -1)} aria-label="One less">−</button>
                <span className="num">{l.qty}</span>
                <button onClick={() => change(l.key, 1)} disabled={avail(l.refId) <= 0} aria-label="One more">+</button>
              </div>
            ) : (
              <span />
            )}
            <button className="icon-btn" onClick={() => setBasket((b) => b.filter((x) => x.key !== l.key))} aria-label={`Remove ${l.label}`}>
              {Icon.x}
            </button>
          </div>
        ))}
      </div>
      <div className="grand">
        <span>Total</span>
        <b className="num">{money(total, cur)}</b>
      </div>
      <div className="seg" role="group" aria-label="Payment method">
        {(["qr", "cash", "card"] as Method[]).map((m) => (
          <button key={m} aria-pressed={method === m} onClick={() => setMethod(m)}>
            {m === "qr" ? "QR" : m === "cash" ? "Cash" : "Card"}
          </button>
        ))}
      </div>
      {method === "qr" &&
        (q ? (
          <div className="payqr">
            <button className="plain" onClick={() => setFull(true)} aria-label="Show QR full screen">
              <img src={q.src} alt={`Payment QR for ${q.title}`} />
            </button>
            <div className="cap">
              {q.title}
              <small className="num">{q.sub}</small>
            </div>
            {qrs.length > 1 && (
              <div className="qrnav">
                <button onClick={() => setIdx((idx - 1 + qrs.length) % qrs.length)}>‹ Prev</button>
                <span className="num">QR {Math.min(idx, qrs.length - 1) + 1} of {qrs.length}</span>
                <button onClick={() => setIdx((idx + 1) % qrs.length)}>Next ›</button>
              </div>
            )}
          </div>
        ) : (
          <div className="noqr">None of these items has a QR picture yet. Add one in Stock, or take cash or card.</div>
        ))}
      <p className="note">
        {method === "qr" ? "Tap the code to show it full screen. When the fan shows you the payment confirmation, mark it paid." : method === "cash" ? "Take the cash, then mark it paid." : "Run the card on your terminal, then mark it paid."}
      </p>
      <button className="btn primary block" onClick={confirm}>Payment received · mark sold</button>
      <button className="btn ghost block" onClick={() => { setBasket(() => []); onClose(); }}>Empty basket</button>
      {full && q && <QrFull src={q.src} title={q.title} sub={q.sub} onClose={() => setFull(false)} />}
    </Sheet>
  );
}
