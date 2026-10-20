import { useState, type FormEvent } from "react";
import { deleteDoc, doc, setDoc } from "firebase/firestore";
import { bandCol, bandDoc } from "../../lib/scope";
import { useBand } from "../../state/band";
import { useSettings } from "../../state/settings";
import { useToast } from "../../state/toast";
import { errorText, groupItems, money } from "../../lib/format";
import { removeImage } from "../../lib/images";
import { ConfirmButton, Icon, ImageField, PhotosField, Sheet, Toggle } from "../../components/ui";
import type { Bundle, BundlePart, Photo } from "../../types";

export default function Bundles() {
  const { bundles, items } = useBand();
  const { settings } = useSettings();
  const [edit, setEdit] = useState<Bundle | "new" | null>(null);
  return (
    <>
      <div className="toolbar">
        <button className="btn primary" disabled={!items.length} onClick={() => setEdit("new")}>+ New bundle</button>
      </div>
      {!bundles.length ? (
        <div className="empty">
          <h3>No bundles yet</h3>
          <p>A bundle sells several things for one price, like a shirt and a hat for less. The size is picked when you sell it.</p>
        </div>
      ) : (
        <div className="grid">
          {bundles.map((b) => (
            <article className="tile bundle" key={b.id}>
              <div className="tile-top">
                <div>
                  <h3>{b.name}</h3>
                  <div className="sub">{b.parts.map((p) => `${p.qty > 1 ? p.qty + "× " : ""}${p.name}`).join(" + ")}</div>
                </div>
                <span className="tag">{money(b.price, settings.currency)}</span>
              </div>
              <div className="meta-row">
                {b.qrUrl ? <img className="mini-qr" src={b.qrUrl} alt="" /> : null}
                <span className="note">{b.qrUrl ? "Payment QR attached" : "No payment QR"}</span>
                {!b.visible && <span className="hidden-tag">{Icon.eyeOff} hidden from fans</span>}
              </div>
              <button className="btn ghost block" onClick={() => setEdit(b)}>Edit bundle</button>
            </article>
          ))}
        </div>
      )}
      {edit && <BundleSheet bundle={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function BundleSheet({ bundle, onClose }: { bundle: Bundle | null; onClose: () => void }) {
  const { items, bundles } = useBand();
  const { settings } = useSettings();
  const toast = useToast();
  const names = groupItems(items).map((g) => g.name);
  const [name, setName] = useState(bundle?.name ?? "");
  const [price, setPrice] = useState(bundle ? String(bundle.price) : "");
  const [parts, setParts] = useState<BundlePart[]>(bundle?.parts?.length ? bundle.parts.map((p) => ({ ...p })) : [{ name: names[0] || "", qty: 1 }]);
  const [visible, setVisible] = useState(bundle?.visible ?? true);
  const [photos, setPhotos] = useState<Photo[]>(bundle?.images ?? []);
  const [qr, setQr] = useState<{ url: string; path: string } | null>(bundle?.qrUrl ? { url: bundle.qrUrl, path: bundle.qrPath || "" } : null);

  const setPart = (i: number, p: Partial<BundlePart>) => setParts((ps) => ps.map((x, j) => (j === i ? { ...x, ...p } : x)));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const clean = parts.filter((p) => p.name).map((p) => ({ name: p.name, qty: Math.max(1, p.qty || 1) }));
    if (!clean.length) return toast("Add at least one item to the bundle.");
    const ref = bundle ? bandDoc("bundles", bundle.id) : doc(bandCol("bundles"));
    setDoc(ref, {
      name: name.trim(),
      price: Number(price) || 0,
      parts: clean,
      visible,
      qrUrl: qr?.url ?? null,
      qrPath: qr?.path ?? null,
      images: photos,
      order: bundle?.order ?? Math.max(0, ...bundles.map((b) => b.order ?? 0)) + 1,
    }).catch((x) => toast(errorText(x)));
    const keep = new Set(photos.map((x) => x.path));
    (bundle?.images ?? []).filter((x) => !keep.has(x.path)).forEach((x) => removeImage(x.path));
    toast("Bundle saved");
    onClose();
  };

  return (
    <Sheet title={bundle ? "Edit bundle" : "New bundle"} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <div className="field">
          <label htmlFor="bName">Bundle name</label>
          <input id="bName" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Shirt + Hat" />
        </div>
        <div className="field">
          <label htmlFor="bPrice">Bundle price ({settings.currency})</label>
          <input id="bPrice" type="number" inputMode="decimal" min="0" step="0.01" required value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div className="field">
          <span className="label">What's inside</span>
          {parts.map((p, i) => (
            <div className="part" key={i}>
              <select value={p.name} onChange={(e) => setPart(i, { name: e.target.value })} aria-label={`Item ${i + 1}`}>
                {names.map((n) => <option key={n}>{n}</option>)}
              </select>
              <input type="number" min="1" step="1" inputMode="numeric" value={p.qty} onChange={(e) => setPart(i, { qty: parseInt(e.target.value) || 1 })} aria-label="Quantity" />
              <button type="button" className="icon-btn" disabled={parts.length < 2} onClick={() => setParts((ps) => ps.filter((_, j) => j !== i))} aria-label="Remove">{Icon.x}</button>
            </div>
          ))}
          <button type="button" className="btn ghost sm" onClick={() => setParts((ps) => [...ps, { name: names[0] || "", qty: 1 }])}>+ Add another item</button>
          <span className="hint">Pick the item, not the size. The seller chooses the size when selling.</span>
        </div>
        <PhotosField label="Photos" photos={photos} onChange={setPhotos} hint="Fans scroll through these on the shop page. The first photo is the main one." />
        <ImageField label="Payment QR picture" folder="qr" url={qr?.url ?? null} onChange={setQr} />
        <Toggle id="bVisible" checked={visible} onChange={setVisible} label="Show on the fan page" />
        <button className="btn primary block">{bundle ? "Save bundle" : "Create bundle"}</button>
        {bundle && (
          <ConfirmButton
            confirmText="Tap again to delete"
            onConfirm={() => {
              deleteDoc(bandDoc("bundles", bundle.id)).catch((x) => toast(errorText(x)));
              toast("Bundle deleted");
              onClose();
            }}
          >
            Delete bundle
          </ConfirmButton>
        )}
      </form>
    </Sheet>
  );
}
