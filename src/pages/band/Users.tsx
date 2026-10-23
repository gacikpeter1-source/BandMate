import { updateDoc } from "firebase/firestore";
import { bandDoc } from "../../lib/scope";
import { useBand } from "../../state/band";
import { roleLabel, useAuth } from "../../state/auth";
import { useT } from "../../i18n";
import { useToast } from "../../state/toast";
import { errorText, timeLabel } from "../../lib/format";
import type { Role, UserProfile } from "../../types";

/** Admin only: approve sign-ups and change roles. */
export default function Users() {
  const t = useT();
  const { users } = useBand();
  const { profile } = useAuth();
  const toast = useToast();
  const pending = users.filter((u) => u.role === "pending").sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  const others = users.filter((u) => u.role !== "pending").sort((a, b) => a.displayName.localeCompare(b.displayName));

  const setRole = (u: UserProfile, role: Role) => {
    const extra = role === "bandmate" && u.role === "pending" ? { approvedBy: profile!.id, approvedAt: Date.now() } : {};
    updateDoc(bandDoc("members", u.id), { role, ...extra }).catch((e) => toast(errorText(e)));
    toast(role === "bandmate" && u.role === "pending" ? t("users.nowBandmate", { name: u.displayName || u.email }) : t("users.roleSet", { name: u.displayName || u.email, role: roleLabel(role) }));
  };

  return (
    <>
      <section className="card">
        <h2 className="card-h">{t("users.waiting")}</h2>
        {!pending.length ? (
          <p className="note">{t("users.nobody")}</p>
        ) : (
          pending.map((u) => (
            <div className="person" key={u.id}>
              <div className="lbl">
                <b>{u.displayName || t("users.noName")}</b>
                <small>{u.email}{u.createdAt ? ` · ${t("users.signedUp", { when: timeLabel(u.createdAt) })}` : ""}</small>
              </div>
              <div className="row-act">
                <button className="btn primary sm" onClick={() => setRole(u, "bandmate")}>{t("users.approve")}</button>
                <button className="btn ghost sm" onClick={() => setRole(u, "disabled")}>{t("users.reject")}</button>
              </div>
            </div>
          ))
        )}
      </section>
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
                <select className="filter" value={u.role} onChange={(e) => setRole(u, e.target.value as Role)} aria-label={t("users.roleFor", { name: u.displayName || u.email })}>
                  <option value="bandmate">{roleLabel("bandmate")}</option>
                  <option value="admin">{roleLabel("admin")}</option>
                  <option value="disabled">{roleLabel("disabled")}</option>
                  <option value="pending">{t("users.backToWaiting")}</option>
                </select>
              )}
            </div>
          );
        })}
        <p className="note">{t("users.note")}</p>
      </section>
    </>
  );
}
