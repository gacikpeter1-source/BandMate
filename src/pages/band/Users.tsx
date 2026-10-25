import { useEffect, useState, type FormEvent } from "react";
import { setDoc, updateDoc } from "firebase/firestore";
import { bandDoc, bandPath } from "../../lib/scope";
import { useBand } from "../../state/band";
import { roleLabel, useAuth } from "../../state/auth";
import { useT } from "../../i18n";
import { useToast } from "../../state/toast";
import { errorText, timeLabel } from "../../lib/format";
import { cancelInvite, inviteMember, removeMember } from "../../lib/invites";
import { LimitError } from "../../lib/planState";
import { PLAN_LIMITS } from "../../lib/plans";
import { ExtendButton, LimitNote } from "../../components/plans";
import type { Role, UserProfile } from "../../types";

/** Admin only: invite people (paid plans), change roles, remove anyone. */
export default function Users() {
  const t = useT();
  const { users, invites, limits, usage, peopleReady } = useBand();
  const { profile } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [limitHit, setLimitHit] = useState(false);
  const pending = users.filter((u) => u.role === "pending").sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  const others = users.filter((u) => u.role !== "pending").sort((a, b) => a.displayName.localeCompare(b.displayName));
  const canInvite = limits.plan === "paid";

  // "Places used" = members + open invitations. Correct the stored counter if it ever disagrees.
  const actual = users.length + invites.length;
  useEffect(() => {
    if (!peopleReady || usage.members === actual) return;
    const timer = setTimeout(() => setDoc(bandPath("settings/usage"), { members: actual }, { merge: true }).catch(() => {}), 1500);
    return () => clearTimeout(timer);
  }, [peopleReady, actual, usage.members]);

  const setRole = (u: UserProfile, role: Role) => {
    const extra = role === "bandmate" && u.role === "pending" ? { approvedBy: profile!.id, approvedAt: Date.now() } : {};
    updateDoc(bandDoc("members", u.id), { role, ...extra }).catch((e) => toast(errorText(e)));
    toast(role === "bandmate" && u.role === "pending" ? t("users.nowBandmate", { name: u.displayName || u.email }) : t("users.roleSet", { name: u.displayName || u.email, role: roleLabel(role) }));
  };

  const remove = (u: UserProfile) => {
    removeMember(u.id).catch((e) => toast(errorText(e)));
    toast(t("users.removed", { name: u.displayName || u.email }));
  };

  const invite = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    setLimitHit(false);
    try {
      const sent = await inviteMember(email, profile!.id);
      toast(t("users.invited", { email: sent }));
      setEmail("");
    } catch (x) {
      setErr(errorText(x));
      setLimitHit(x instanceof LimitError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="card">
        <h2 className="card-h">{t("users.inviteTitle")}</h2>
        {!canInvite ? (
          <>
            <p className="note">{t("users.freePlan", { max: PLAN_LIMITS.paid.users })}</p>
            <ExtendButton />
          </>
        ) : (
          <form className="stack" onSubmit={invite}>
            <p className="note">{t("users.places", { used: Math.max(0, usage.members), max: limits.users })}</p>
            <div className="field">
              <label htmlFor="invEmail">{t("users.inviteEmail")}</label>
              <input id="invEmail" type="email" required autoCapitalize="none" autoCorrect="off" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
              <span className="hint">{t("users.inviteHint")}</span>
            </div>
            {err && (limitHit ? <LimitNote text={err} /> : <p className="hint err">{err}</p>)}
            <button className="btn primary block" disabled={busy || !email.trim()}>{busy ? t("users.inviting") : t("users.inviteSend")}</button>
          </form>
        )}
      </section>

      {invites.length > 0 && (
        <section className="card">
          <h2 className="card-h">{t("users.invitesWaiting")}</h2>
          {invites.map((i) => (
            <div className="person" key={i.id}>
              <div className="lbl">
                <b>{i.email}</b>
                <small>{t("users.invitedWhen", { when: timeLabel(i.createdAt) })}</small>
              </div>
              <button className="btn ghost sm" onClick={() => cancelInvite(i.id).catch((e) => toast(errorText(e)))}>{t("users.cancelInvite")}</button>
            </div>
          ))}
        </section>
      )}

      {pending.length > 0 && (
        <section className="card">
          <h2 className="card-h">{t("users.waiting")}</h2>
          {pending.map((u) => (
            <div className="person" key={u.id}>
              <div className="lbl">
                <b>{u.displayName || t("users.noName")}</b>
                <small>{u.email}{u.createdAt ? ` · ${t("users.signedUp", { when: timeLabel(u.createdAt) })}` : ""}</small>
              </div>
              <div className="row-act">
                <button className="btn primary sm" onClick={() => setRole(u, "bandmate")}>{t("users.approve")}</button>
                <button className="btn ghost sm" onClick={() => remove(u)}>{t("users.reject")}</button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="card">
        <h2 className="card-h">{t("users.everyone")}</h2>
        {others.map((u) => {
          const self = u.id === profile?.id;
          return (
            <div className="person" key={u.id}>
              <div className="lbl">
                <b>{u.displayName || t("users.noName")}{self ? ` ${t("users.you")}` : ""}</b>
                <small>{u.email}</small>
              </div>
              {self ? (
                <span className="pill ok">{roleLabel(u.role)}</span>
              ) : (
                <div className="row-act">
                  <select className="filter" value={u.role} onChange={(e) => setRole(u, e.target.value as Role)} aria-label={t("users.roleFor", { name: u.displayName || u.email })}>
                    <option value="bandmate">{roleLabel("bandmate")}</option>
                    <option value="admin">{roleLabel("admin")}</option>
                    {u.role === "disabled" && <option value="disabled">{roleLabel("disabled")}</option>}
                  </select>
                  <button className="btn danger sm" onClick={() => remove(u)} aria-label={t("users.removeAria", { name: u.displayName || u.email })}>{t("users.remove")}</button>
                </div>
              )}
            </div>
          );
        })}
        <p className="note">{t("users.note")}</p>
      </section>
    </>
  );
}
