import { useState } from "react";
import { EXTRA_PACK_MB, PAID_CHECKOUT_ENABLED, PLAN_LIMITS, PRICE_PACK, PRICE_PAID, mbText, type Limits, type Usage } from "../lib/plans";
import { useT } from "../i18n";
import { Sheet } from "./ui";

const Tick = ({ on }: { on: boolean }) => {
  const t = useT();
  return <span className={on ? "tick yes" : "tick no"} role="img" aria-label={on ? t("plan.yes") : t("plan.no")}>{on ? "✓" : "–"}</span>;
};

/** Free vs Paid side by side. Opened from the sign-up form and from every "Extend?" button. */
export function PlanTable() {
  const t = useT();
  const f = PLAN_LIMITS.free;
  const p = PLAN_LIMITS.paid;
  const rows: { label: string; free: React.ReactNode; paid: React.ReactNode }[] = [
    { label: t("plan.rowUsers"), free: f.users, paid: p.users },
    { label: t("plan.rowItems"), free: f.items, paid: p.items },
    { label: t("plan.rowSpace"), free: t("plan.mb", { n: f.mb }), paid: t("plan.mb", { n: p.mb }) },
    { label: t("plan.rowQr"), free: <Tick on />, paid: <Tick on /> },
    { label: t("plan.rowDesign"), free: <Tick on={f.design} />, paid: <Tick on={p.design} /> },
    { label: t("plan.rowDomain"), free: <Tick on={f.domain} />, paid: <Tick on={p.domain} /> },
    { label: t("plan.rowInvite"), free: <Tick on={false} />, paid: <Tick on /> },
    { label: t("plan.rowPrice"), free: t("plan.priceFree"), paid: t("plan.pricePaid", { price: PRICE_PAID }) },
  ];
  return (
    <div className="plantable" role="table">
      <div className="pt-row pt-head" role="row">
        <span />
        <b role="columnheader">{t("plan.free")}</b>
        <b role="columnheader">
          {t("plan.paid")}
          {!PAID_CHECKOUT_ENABLED && <small className="pt-soon">{t("plan.soon")}</small>}
        </b>
      </div>
      {rows.map((r) => (
        <div className="pt-row" role="row" key={r.label}>
          <span role="rowheader">{r.label}</span>
          <span role="cell">{r.free}</span>
          <span role="cell">{r.paid}</span>
        </div>
      ))}
      <p className="note">{t("plan.addOn", { mb: EXTRA_PACK_MB, price: PRICE_PACK })}</p>
    </div>
  );
}

export function ExtendSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  return (
    <Sheet title={t("plan.extendTitle")} onClose={onClose}>
      <PlanTable />
      {!PAID_CHECKOUT_ENABLED && <p className="hint">{t("plan.paySoon")}</p>}
      <button className="btn ghost block" onClick={onClose}>{t("common.close")}</button>
    </Sheet>
  );
}

/** "Extend?" next to a limit message: opens the plan table. */
export function ExtendButton() {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="linkbtn" onClick={() => setOpen(true)}>{t("plan.extend")}</button>
      {open && <ExtendSheet onClose={() => setOpen(false)} />}
    </>
  );
}

/** A limit message with its "Extend?" button. */
export function LimitNote({ text }: { text: string }) {
  return (
    <p className="hint err limitnote">
      {text} <ExtendButton />
    </p>
  );
}

function Meter({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = Math.min(100, max ? (Math.max(0, used) / max) * 100 : 0);
  return (
    <div className="meter">
      <span>{label}</span>
      <div className="bar" aria-hidden="true"><i className={pct >= 100 ? "full" : pct >= 80 ? "near" : ""} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

/** Settings: which plan the band is on and how much of it is used. */
export function UsageCard({ limits, usage, packs }: { limits: Limits; usage: Usage; packs: number }) {
  const t = useT();
  return (
    <section className="card">
      <h2 className="card-h">{t("plan.yourPlan")}</h2>
      <p className="note">
        <span className={`pill ${limits.plan === "paid" ? "ok" : "low"}`}>{limits.plan === "paid" ? t("plan.paid") : t("plan.free")}</span>
        {packs > 0 && <> {t("plan.packs", { n: packs })}</>}
      </p>
      <Meter label={t("plan.usageItems", { used: Math.max(0, usage.items), max: limits.items })} used={usage.items} max={limits.items} />
      <Meter label={t("plan.usageSpace", { used: mbText(usage.bytes), max: mbText(limits.bytes) })} used={usage.bytes} max={limits.bytes} />
      <Meter label={t("plan.usageUsers", { used: Math.max(0, usage.members), max: limits.users })} used={usage.members} max={limits.users} />
      <ExtendButton />
    </section>
  );
}
