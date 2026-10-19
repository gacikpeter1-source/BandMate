import { useState } from "react";
import { useBand } from "../../state/band";
import { useSettings } from "../../state/settings";
import { useAuth } from "../../state/auth";
import { useToast } from "../../state/toast";
import { errorText, itemLabel, money, timeLabel } from "../../lib/format";
import { setSaleUndone } from "../../lib/ops";

const METHOD: Record<string, string> = { qr: "QR", cash: "Cash", card: "Card", quick: "Quick" };

export default function Sales() {
  const { sales, band, stock, items } = useBand();
  const { settings } = useSettings();
  const { profile } = useAuth();
  const toast = useToast();
  const cur = settings.currency;
  const gigs = [...new Set(sales.map((s) => s.gig || ""))];
  const [gig, setGig] = useState<string>(band.gig && gigs.includes(band.gig) ? band.gig : "__all");

  const list = sales.filter((s) => gig === "__all" || (s.gig || "") === gig);
  const live = list.filter((s) => !s.undone);
  const revenue = live.reduce((t, s) => t + (Number(s.total) || 0), 0);
  const pcs = live.reduce((t, s) => t + s.lines.reduce((u, l) => u + l.picks.reduce((w, p) => w + p.qty, 0), 0), 0);
  const byMethod: Record<string, number> = {};
  live.forEach((s) => (byMethod[s.method] = (byMethod[s.method] || 0) + (Number(s.total) || 0)));
  const maxM = Math.max(1, ...Object.values(byMethod));

  const byItem: Record<string, number> = {};
  live.forEach((s) => s.lines.forEach((l) => l.picks.forEach((p) => (byItem[p.itemId] = (byItem[p.itemId] || 0) + p.qty))));
  const top = Object.entries(byItem).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const toggle = (id: string, undone: boolean) => {
    const s = sales.find((x) => x.id === id);
    if (!s) return;
    setSaleUndone(s, undone, stock, items).catch((e) => toast(errorText(e)));
    toast(undone ? "Sale cancelled, stock put back" : "Sale restored");
  };

  return (
    <>
      <div className="toolbar center-y">
        <label htmlFor="gigFilter" className="note">Showing</label>
        <select id="gigFilter" className="filter" value={gig} onChange={(e) => setGig(e.target.value)}>
          <option value="__all">All gigs</option>
          {gigs.map((g) => <option key={g} value={g}>{g || "No gig set"}</option>)}
        </select>
      </div>
      <div className="stats">
        <div className="stat"><small>Takings</small><b className="num">{money(revenue, cur)}</b></div>
        <div className="stat"><small>Pieces</small><b className="num">{pcs}</b></div>
        <div className="stat"><small>Sales</small><b className="num">{live.length}</b></div>
      </div>
      {Object.keys(byMethod).length > 0 && (
        <div className="methods">
          {Object.entries(byMethod).sort((a, b) => b[1] - a[1]).map(([m, v]) => (
            <div className="mrow" key={m}>
              <span>{METHOD[m] || m}</span>
              <div className="bar"><i style={{ width: `${(v / maxM) * 100}%` }} /></div>
              <b className="num">{money(v, cur)}</b>
            </div>
          ))}
          {top.length > 0 && (
            <p className="note">
              Best sellers: {top.map(([id, n]) => `${itemLabel(items.find((i) => i.id === id))} ×${n}`).join(" · ")}
            </p>
          )}
        </div>
      )}
      {!list.length ? (
        <div className="empty">
          <h3>No sales yet</h3>
          <p>Every sale from the Sell tab or the Sold 1 button shows up here, with who sold it and how it was paid.</p>
        </div>
      ) : (
        list.map((s) => (
          <div className={`sale ${s.undone ? "undone" : ""}`} key={s.id}>
            <div className="items">
              {s.lines.map((l, i) => (
                <span key={i}>
                  {i > 0 && ", "}
                  {l.qty > 1 ? `${l.qty}× ` : ""}
                  {l.label}
                  {l.detail && <small> ({l.detail})</small>}
                </span>
              ))}
            </div>
            <div className="total num">{money(s.total, cur)}</div>
            <div className="meta">
              <span className="num">{timeLabel(s.at)}</span>
              <span className="mpill">{METHOD[s.method] || s.method}</span>
              <span>{s.by === profile?.id ? "You" : s.byName}</span>
              {s.gig && gig === "__all" && <span>{s.gig}</span>}
              {s.undone && <span>Cancelled</span>}
            </div>
            <button className="btn sm ghost" onClick={() => toggle(s.id, !s.undone)}>{s.undone ? "Restore" : "Undo"}</button>
          </div>
        ))
      )}
    </>
  );
}
