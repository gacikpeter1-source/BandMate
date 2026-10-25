import { useState, type FormEvent } from "react";
import { useBand } from "../../state/band";
import { LimitNote } from "../../components/plans";
import { useSettings } from "../../state/settings";
import { useAuth } from "../../state/auth";
import { useToast } from "../../state/toast";
import { errorText, groupItems, itemLabel, money } from "../../lib/format";
import { addStock, createItems, deleteItem, recordSale, setStockCount, updateItem } from "../../lib/ops";
import { removeImage } from "../../lib/images";
import { useT } from "../../i18n";
import { ConfirmButton, Icon, ImageField, PayLinkField, PhotosField, QrPopup, Sheet, Toggle } from "../../components/ui";
import { cleanPayUrl } from "../../lib/qrdecode";
import type { Item, Photo } from "../../types";

const pill = (n: number) => (n < 0 ? "out" : n === 0 ? "out" : n <= 3 ? "low" : "ok");

export default function Stock() {
  const t = useT();
  const { items, stock, band, limits, usage } = useBand();
  const { settings } = useSettings();
  const { profile } = useAuth();
  const atLimit = usage.items >= limits.items;
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
    saved.catch((e) => toast(t("sell.saleNotSaved", { err: errorText(e) })));
    toast(t("stock.soldOne", { label: itemLabel(it) }));
  };

  return (
    <>
      <div className="toolbar">
        <button className="btn primary" disabled={atLimit} onClick={() => setEdit("new")}>{t("stock.add")}</button>
      </div>
      {atLimit && <LimitNote text={t("limit.items", { max: limits.items })} />}
      {groups.length > 0 && <p className="note num">{t("stock.items", { n: items.length })} · {t("stock.piecesInStock", { n: totalPcs })}</p>}
      {!groups.length && (
        <div className="empty">
          <h3>{t("stock.emptyTitle")}</h3>
          <p>{t("stock.emptyText")}</p>
        </div>
      )}
      <div className="flow">
      {groups.map((g) => {
        const total = g.items.reduce((sum, i) => sum + (stock[i.id] ?? 0), 0);
        return (
          <section className="group" key={g.key}>
            <div className="group-h">
              <h3>{g.name}</h3>
              <span className="num">{t("common.pcs", { n: total })}</span>
            </div>
            {g.items.map((it) => {
              const n = stock[it.id] ?? 0;
              return (
                <div className="row" key={it.id}>
                  <button className={`qrthumb ${it.qrUrl ? "has" : ""}`} onClick={() => (it.qrUrl ? setZoom(it) : setEdit(it))} aria-label={it.qrUrl ? t("stock.showQr") : t("stock.addQr")}>
                    {it.qrUrl ? <img src={it.qrUrl} alt="" /> : t("stock.plusQr")}
                  </button>
                  <div className="lbl">
                    <b>
                      {it.variant || t("common.oneSize")}
                      {!it.visible && <span className="hidden-tag" title={t("stock.hiddenTitle")}>{Icon.eyeOff} {t("stock.hidden")}</span>}
                    </b>
                    <small className="num">{money(it.price, cur)}</small>
                  </div>
                  <span className={`pill ${pill(n)} num`} title={n < 0 ? t("stock.oversold") : undefined}>
                    {n < 0 ? t("stock.over", { m: Math.abs(n) }) : n}
                  </span>
                  <div className="row-act">
                    <button className="sold-btn" disabled={n <= 0} onClick={() => soldOne(it)}>{t("stock.sold1")}</button>
                    <button className="add-btn" onClick={() => setRestock(it)} aria-label={t("stock.addPiecesAria", { label: itemLabel(it) })}>{t("stock.plusPcs")}</button>
                    <button className="icon-btn" onClick={() => setEdit(it)} aria-label={t("stock.editAria", { label: itemLabel(it) })}>{Icon.edit}</button>
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
      {zoom && <QrPopup src={zoom.qrUrl} title={itemLabel(zoom)} sub={money(zoom.price, cur)} payUrl={zoom.payUrl} onClose={() => setZoom(null)} />}
    </>
  );
}

function RestockSheet({ item, onClose }: { item: Item; onClose: () => void }) {
  const t = useT();
  const { stock } = useBand();
  const toast = useToast();
  const now = stock[item.id] ?? 0;
  const [add, setAdd] = useState("");
  const [exact, setExact] = useState(String(now));
  const n = parseInt(add) || 0;

  const doAdd = (d: number) => {
    if (!d) return;
    addStock(item.id, d, now).catch((e) => toast(errorText(e)));
    toast(t(d > 0 ? "stock.added" : "stock.removed", { n: Math.abs(d), label: itemLabel(item) }));
    onClose();
  };
  return (
    <Sheet title={t("stock.title", { label: itemLabel(item) })} onClose={onClose}>
      <div className="grand">
        <span>{t("stock.inStockNow")}</span>
        <b className="num">{now}</b>
      </div>
      <div className="field">
        <span className="label">{t("stock.addPieces")}</span>
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
        <input id="rsAdd" type="number" inputMode="numeric" step="1" placeholder={t("stock.otherAmount")} value={add} onChange={(e) => setAdd(e.target.value)} aria-label={t("stock.piecesToAdd")} />
        <button className="btn primary" disabled={!n}>{t("stock.addN", { n: n > 0 ? n : "" })}</button>
      </form>
      <form
        className="field"
        onSubmit={(e) => {
          e.preventDefault();
          const q = Math.max(0, parseInt(exact) || 0);
          setStockCount(item.id, q).catch((x) => toast(errorText(x)));
          toast(t("stock.setTo", { label: itemLabel(item), n: q }));
          onClose();
        }}
      >
        <label htmlFor="rsExact">{t("stock.correct")}</label>
        <div className="row-form">
          <input id="rsExact" type="number" inputMode="numeric" min="0" step="1" value={exact} onChange={(e) => setExact(e.target.value)} />
          <button className="btn ghost">{t("stock.setCount")}</button>
        </div>
      </form>
    </Sheet>
  );
}

function ItemSheet({ item, onClose }: { item: Item | null; onClose: () => void }) {
  const t = useT();
  const { items, stock } = useBand();
  const { settings } = useSettings();
  const toast = useToast();
  const [name, setName] = useState(item?.name ?? "");
  const [variant, setVariant] = useState(item?.variant ?? "");
  const [price, setPrice] = useState(item ? String(item.price) : "");
  const [count, setCount] = useState(item ? String(stock[item.id] ?? 0) : "");
  const [visible, setVisible] = useState(item?.visible ?? true);
  const [qr, setQr] = useState<{ url: string; path: string } | null>(item?.qrUrl ? { url: item.qrUrl, path: item.qrPath || "" } : null);
  const [payUrl, setPayUrl] = useState(item?.payUrl ?? "");
  const [applyQrToGroup, setApplyQrToGroup] = useState(false);
  // Photos belong to the product, so every size of it shares one set (kept in sync on save).
  const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const groupPhotos = (n: string): Photo[] => items.find((i) => i.images?.length && sameName(i.name, n))?.images ?? [];
  const startPhotos = item ? (item.images?.length ? item.images : groupPhotos(item.name)) : null;
  const [photos, setPhotos] = useState<Photo[] | null>(startPhotos);
  const shownPhotos = photos ?? groupPhotos(name); // a new size of an existing product starts with its photos
  const names = [...new Set(items.map((i) => i.name.trim()))];
  const siblings = item ? items.filter((i) => i.id !== item.id && i.name.trim().toLowerCase() === item.name.trim().toLowerCase()) : [];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const p = Number(price) || 0;
    const q = Math.max(0, parseInt(count) || 0);
    const pay = cleanPayUrl(payUrl);
    if (pay === null) return toast(t("item.payUrlBad"));
    const done = (x: Promise<unknown>) => x.catch((err) => toast(errorText(err)));
    if (item) {
      done(updateItem(item.id, { name: name.trim(), variant: variant.trim(), price: p, visible, qrUrl: qr?.url ?? null, qrPath: qr?.path ?? null, payUrl: pay || null, images: shownPhotos }));
      const before = (startPhotos ?? []).map((x) => x.url).join("|");
      if (shownPhotos.map((x) => x.url).join("|") !== before) {
        siblings.forEach((s) => done(updateItem(s.id, { images: shownPhotos })));
        const keep = new Set(shownPhotos.map((x) => x.path));
        (startPhotos ?? []).filter((x) => !keep.has(x.path)).forEach((x) => removeImage(x.path));
      }
      if (q !== (stock[item.id] ?? 0)) done(setStockCount(item.id, q));
      if (applyQrToGroup) siblings.forEach((s) => done(updateItem(s.id, { qrUrl: qr?.url ?? null, qrPath: qr?.path ?? null, payUrl: pay || null })));
      toast(t("item.saved", { label: itemLabel({ name, variant }) }));
    } else {
      const variants = variant.split(",").map((v) => v.trim()).filter(Boolean);
      const order = Math.max(0, ...items.map((i) => i.order ?? 0)) + 1;
      try {
        done(createItems({ name: name.trim(), price: p, qrUrl: qr?.url ?? null, qrPath: qr?.path ?? null, payUrl: pay || null, visible, images: shownPhotos }, variants, q, order));
      } catch (limit) {
        return toast(errorText(limit)); // over the plan's item limit: keep the form open so nothing typed is lost
      }
      toast(variants.length > 1 ? t("item.addedSizes", { n: variants.length, name: name.trim() }) : t("item.added", { name: name.trim() }));
    }
    onClose();
  };

  return (
    <Sheet title={item ? t("item.editTitle") : t("item.addTitle")} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <div className="field">
          <label htmlFor="fName">{t("item.item")}</label>
          <input id="fName" list="nameList" required value={name} onChange={(e) => setName(e.target.value)} placeholder={t("item.itemPh")} />
          <datalist id="nameList">{names.map((n) => <option key={n} value={n} />)}</datalist>
          <span className="hint">{t("item.itemHint")}</span>
        </div>
        <div className="field">
          <label htmlFor="fVar">{t("item.variant")}</label>
          <input id="fVar" value={variant} onChange={(e) => setVariant(e.target.value)} placeholder={item ? t("item.variantPhEdit") : t("item.variantPhNew")} />
          <span className="hint">{item ? t("item.variantHintEdit") : t("item.variantHintNew")}</span>
        </div>
        <div className="two">
          <div className="field">
            <label htmlFor="fPrice">{t("item.price", { cur: settings.currency })}</label>
            <input id="fPrice" type="number" inputMode="decimal" min="0" step="0.01" required value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="fCount">{item ? t("item.pieces") : t("item.piecesEach")}</label>
            <input id="fCount" type="number" inputMode="numeric" min="0" step="1" required value={count} onChange={(e) => setCount(e.target.value)} />
          </div>
        </div>
        <PhotosField label={t("item.photos")} photos={shownPhotos} onChange={setPhotos} hint={t("item.photosHint")} />
        <ImageField label={t("item.qr")} folder="qr" url={qr?.url ?? null} onChange={(v) => { setQr(v); if (v?.qrText && cleanPayUrl(v.qrText) && !payUrl.trim()) setPayUrl(cleanPayUrl(v.qrText)!); }} hint={t("item.qrHint")} />
        <PayLinkField id="fPay" value={payUrl} onChange={setPayUrl} />
        {item && siblings.length > 0 && (
          <Toggle id="fGroupQr" checked={applyQrToGroup} onChange={setApplyQrToGroup} label={t("item.qrAll", { name: item.name })} hint={t("item.qrAllHint", { list: siblings.map((s) => s.variant || t("item.oneSizeLower")).join(", ") })} />
        )}
        <Toggle id="fVisible" checked={visible} onChange={setVisible} label={t("item.visible")} hint={t("item.visibleHint")} />
        <button className="btn primary block">{item ? t("item.saveChanges") : t("item.addToStock")}</button>
        {item && (
          <ConfirmButton
            confirmText={t("item.confirmDelete")}
            onConfirm={() => {
              deleteItem(item.id).catch((e) => toast(errorText(e)));
              toast(t("item.deleted", { label: itemLabel(item) }));
              onClose();
            }}
          >
            {t("item.delete")}
          </ConfirmButton>
        )}
      </form>
    </Sheet>
  );
}
