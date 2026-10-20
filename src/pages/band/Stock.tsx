import { useState, type FormEvent } from "react";
import { useBand } from "../../state/band";
import { useSettings } from "../../state/settings";
import { useAuth } from "../../state/auth";
import { useToast } from "../../state/toast";
import { errorText, groupItems, itemLabel, money } from "../../lib/format";
import { addStock, createItems, deleteItem, recordSale, setStockCount, updateItem } from "../../lib/ops";
import { ConfirmButton, Icon, ImageField, QrFull, Sheet, Toggle } from "../../components/ui";
import type { Item } from "../../types";

const pill = (n: number) => (n < 0 ? "out" : n === 0 ? "out" : n <= 3 ? "low" : "ok");

export default function Stock() {
  const { items, stock, band } = useBand();
  const { settings } = useSettings();
  const { profile } = useAuth();
  const toast = useToast();
  const cur = settings.currency;
  const [edit, setEdit] = useState<Item | "new" | null>(null);
  const [restock, setRestock] = useState<Item | null>(null);
  const [zoom, setZoom] = useState<Item | null>(null);
  const groups = groupItems(items);
  const totalPcs = items.reduce((t, i) => t + Math.max(0, stock[i.id] ?? 0), 0);

  const soldOne = (it: Item) => {
    const { saved } = recordSale({
      lines: [{ kind: "item", refId: it.id, label: itemLabel(it), price: Number(it.price) || 0, qty: 1, picks: [{ itemId: it.id, qty: 1 }] }],
      method: "quick",
      gig: band.gig,
      by: profile!.id,
      byName: profile!.displayName || profile!.email,
      stock,
    });
    saved.catch((e) => toast(`Sale not saved: ${errorText(e)}`));
    toast(`Sold 1 × ${itemLabel(it)}. Undo it in Sales.`);
  };

  return (
    <>
      <div className="toolbar">
        <button className="btn primary" onClick={() => setEdit("new")}>+ Add item</button>
      </div>
      {groups.length > 0 && <p className="note num">{items.length} items · {totalPcs} pieces in stock</p>}
      {!groups.length && (
        <div className="empty">
          <h3>No stock yet</h3>
          <p>Add each product with its sizes and how many pieces you have. Example: T-shirt, sizes “S, M, L, XL”, 20 pieces each.</p>
        </div>
      )}
      <div className="flow">
      {groups.map((g) => {
        const total = g.items.reduce((t, i) => t + (stock[i.id] ?? 0), 0);
        return (
          <section className="group" key={g.key}>
            <div className="group-h">
              <h3>{g.name}</h3>
              <span className="num">{total} pcs</span>
            </div>
            {g.items.map((it) => {
              const n = stock[it.id] ?? 0;
              return (
                <div className="row" key={it.id}>
                  <button className={`qrthumb ${it.qrUrl ? "has" : ""}`} onClick={() => (it.qrUrl ? setZoom(it) : setEdit(it))} aria-label={it.qrUrl ? "Show QR" : "Add QR picture"}>
                    {it.qrUrl ? <img src={it.qrUrl} alt="" /> : "+ QR"}
                  </button>
                  <div className="lbl">
                    <b>
                      {it.variant || "One size"}
                      {!it.visible && <span className="hidden-tag" title="Hidden from fans">{Icon.eyeOff} hidden</span>}
                    </b>
                    <small className="num">{money(it.price, cur)}</small>
                  </div>
                  <span className={`pill ${pill(n)} num`} title={n < 0 ? "Oversold: more sold than counted" : undefined}>
                    {n < 0 ? `${n} over` : n}
                  </span>
                  <div className="row-act">
                    <button className="sold-btn" disabled={n <= 0} onClick={() => soldOne(it)}>Sold 1</button>
                    <button className="add-btn" onClick={() => setRestock(it)} aria-label={`Add pieces of ${itemLabel(it)}`}>+ pcs</button>
                    <button className="icon-btn" onClick={() => setEdit(it)} aria-label={`Edit ${itemLabel(it)}`}>{Icon.edit}</button>
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}
      </div>
      {edit && <ItemSheet item={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
      {restock && <RestockSheet item={restock} onClose={() => setRestock(null)} />}
      {zoom && <QrFull src={zoom.qrUrl} title={itemLabel(zoom)} sub={money(zoom.price, cur)} onClose={() => setZoom(null)} />}
    </>
  );
}

function RestockSheet({ item, onClose }: { item: Item; onClose: () => void }) {
  const { stock } = useBand();
  const toast = useToast();
  const now = stock[item.id] ?? 0;
  const [add, setAdd] = useState("");
  const [exact, setExact] = useState(String(now));
  const n = parseInt(add) || 0;

  const doAdd = (d: number) => {
    if (!d) return;
    addStock(item.id, d, now).catch((e) => toast(errorText(e)));
    toast(`${d > 0 ? "Added" : "Removed"} ${Math.abs(d)} × ${itemLabel(item)}`);
    onClose();
  };
  return (
    <Sheet title={`Stock · ${itemLabel(item)}`} onClose={onClose}>
      <div className="grand">
        <span>In stock now</span>
        <b className="num">{now}</b>
      </div>
      <div className="field">
        <span className="label">Add pieces (new box arrived)</span>
        <div className="sizes">
          {[1, 5, 10, 25].map((v) => (
            <button key={v} className="btn ghost sm" onClick={() => doAdd(v)}>+{v}</button>
          ))}
        </div>
      </div>
      <form
        className="row-form"
        onSubmit={(e) => {
          e.preventDefault();
          doAdd(n);
        }}
      >
        <input id="rsAdd" type="number" inputMode="numeric" step="1" placeholder="Other amount" value={add} onChange={(e) => setAdd(e.target.value)} aria-label="Pieces to add" />
        <button className="btn primary" disabled={!n}>Add {n > 0 ? n : ""}</button>
      </form>
      <form
        className="field"
        onSubmit={(e) => {
          e.preventDefault();
          const q = Math.max(0, parseInt(exact) || 0);
          setStockCount(item.id, q).catch((x) => toast(errorText(x)));
          toast(`${itemLabel(item)} set to ${q} pcs`);
          onClose();
        }}
      >
        <label htmlFor="rsExact">Or correct the count after counting the box</label>
        <div className="row-form">
          <input id="rsExact" type="number" inputMode="numeric" min="0" step="1" value={exact} onChange={(e) => setExact(e.target.value)} />
          <button className="btn ghost">Set count</button>
        </div>
      </form>
    </Sheet>
  );
}

function ItemSheet({ item, onClose }: { item: Item | null; onClose: () => void }) {
  const { items, stock } = useBand();
  const { settings } = useSettings();
  const toast = useToast();
  const [name, setName] = useState(item?.name ?? "");
  const [variant, setVariant] = useState(item?.variant ?? "");
  const [price, setPrice] = useState(item ? String(item.price) : "");
  const [count, setCount] = useState(item ? String(stock[item.id] ?? 0) : "");
  const [visible, setVisible] = useState(item?.visible ?? true);
  const [qr, setQr] = useState<{ url: string; path: string } | null>(item?.qrUrl ? { url: item.qrUrl, path: item.qrPath || "" } : null);
  const [applyQrToGroup, setApplyQrToGroup] = useState(false);
  const names = [...new Set(items.map((i) => i.name.trim()))];
  const siblings = item ? items.filter((i) => i.id !== item.id && i.name.trim().toLowerCase() === item.name.trim().toLowerCase()) : [];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const p = Number(price) || 0;
    const q = Math.max(0, parseInt(count) || 0);
    const done = (x: Promise<unknown>) => x.catch((err) => toast(errorText(err)));
    if (item) {
      done(updateItem(item.id, { name: name.trim(), variant: variant.trim(), price: p, visible, qrUrl: qr?.url ?? null, qrPath: qr?.path ?? null }));
      if (q !== (stock[item.id] ?? 0)) done(setStockCount(item.id, q));
      if (applyQrToGroup) siblings.forEach((s) => done(updateItem(s.id, { qrUrl: qr?.url ?? null, qrPath: qr?.path ?? null })));
      toast(`${itemLabel({ name, variant })} saved`);
    } else {
      const variants = variant.split(",").map((v) => v.trim()).filter(Boolean);
      const order = Math.max(0, ...items.map((i) => i.order ?? 0)) + 1;
      done(createItems({ name: name.trim(), price: p, qrUrl: qr?.url ?? null, qrPath: qr?.path ?? null, visible }, variants, q, order));
      toast(variants.length > 1 ? `Added ${variants.length} sizes of ${name.trim()}` : `${name.trim()} added`);
    }
    onClose();
  };

  return (
    <Sheet title={item ? "Edit item" : "Add item"} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <div className="field">
          <label htmlFor="fName">Item</label>
          <input id="fName" list="nameList" required value={name} onChange={(e) => setName(e.target.value)} placeholder="T-shirt, White hat, Cup…" />
          <datalist id="nameList">{names.map((n) => <option key={n} value={n} />)}</datalist>
          <span className="hint">Use the same name for every size so they group together.</span>
        </div>
        <div className="field">
          <label htmlFor="fVar">Size or variant</label>
          <input id="fVar" value={variant} onChange={(e) => setVariant(e.target.value)} placeholder={item ? "Leave empty for one size" : "S, M, L, XL"} />
          <span className="hint">{item ? "Leave empty if there's only one size." : "Leave empty for one size. Separate with commas to add several sizes at once."}</span>
        </div>
        <div className="two">
          <div className="field">
            <label htmlFor="fPrice">Price ({settings.currency})</label>
            <input id="fPrice" type="number" inputMode="decimal" min="0" step="0.01" required value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="fCount">{item ? "Pieces in stock" : "Pieces (each size)"}</label>
            <input id="fCount" type="number" inputMode="numeric" min="0" step="1" required value={count} onChange={(e) => setCount(e.target.value)} />
          </div>
        </div>
        <ImageField label="Payment QR picture" folder="qr" url={qr?.url ?? null} onChange={setQr} hint="A screenshot of the QR from your payment app (SumUp, Revolut, bank app…). Fans scan it to pay this item." />
        {item && siblings.length > 0 && (
          <Toggle id="fGroupQr" checked={applyQrToGroup} onChange={setApplyQrToGroup} label={`Use this QR for all ${item.name} sizes`} hint={`Also sets it on ${siblings.map((s) => s.variant || "one size").join(", ")}.`} />
        )}
        <Toggle id="fVisible" checked={visible} onChange={setVisible} label="Show on the fan page" hint="Hidden items stay in stock and can still be sold here." />
        <button className="btn primary block">{item ? "Save changes" : "Add to stock"}</button>
        {item && (
          <ConfirmButton
            confirmText="Tap again to delete"
            onConfirm={() => {
              deleteItem(item.id).catch((e) => toast(errorText(e)));
              toast(`${itemLabel(item)} deleted`);
              onClose();
            }}
          >
            Delete item
          </ConfirmButton>
        )}
      </form>
    </Sheet>
  );
}
