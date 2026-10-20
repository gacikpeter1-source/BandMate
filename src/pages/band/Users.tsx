import { updateDoc } from "firebase/firestore";
import { bandDoc } from "../../lib/scope";
import { useBand } from "../../state/band";
import { ROLE_LABEL, useAuth } from "../../state/auth";
import { useToast } from "../../state/toast";
import { errorText, timeLabel } from "../../lib/format";
import type { Role, UserProfile } from "../../types";

/** Admin only: approve sign-ups and change roles. */
export default function Users() {
  const { users } = useBand();
  const { profile } = useAuth();
  const toast = useToast();
  const pending = users.filter((u) => u.role === "pending").sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  const others = users.filter((u) => u.role !== "pending").sort((a, b) => a.displayName.localeCompare(b.displayName));

  const setRole = (u: UserProfile, role: Role) => {
    const extra = role === "bandmate" && u.role === "pending" ? { approvedBy: profile!.id, approvedAt: Date.now() } : {};
    updateDoc(bandDoc("members", u.id), { role, ...extra }).catch((e) => toast(errorText(e)));
    toast(role === "bandmate" && u.role === "pending" ? `${u.displayName || u.email} is now a BandMate` : `${u.displayName || u.email}: ${ROLE_LABEL[role]}`);
  };

  return (
    <>
      <section className="card">
        <h2 className="card-h">Waiting for approval</h2>
        {!pending.length ? (
          <p className="note">Nobody is waiting. New band members sign up at the “Create an account” link on the login page, then appear here.</p>
        ) : (
          pending.map((u) => (
            <div className="person" key={u.id}>
              <div className="lbl">
                <b>{u.displayName || "No name"}</b>
                <small>{u.email}{u.createdAt ? ` · signed up ${timeLabel(u.createdAt)}` : ""}</small>
              </div>
              <div className="row-act">
                <button className="btn primary sm" onClick={() => setRole(u, "bandmate")}>Approve as BandMate</button>
                <button className="btn ghost sm" onClick={() => setRole(u, "disabled")}>Reject</button>
              </div>
            </div>
          ))
        )}
      </section>
      <section className="card">
        <h2 className="card-h">Everyone</h2>
        {others.map((u) => {
          const self = u.id === profile?.id;
          return (
            <div className="person" key={u.id}>
              <div className="lbl">
                <b>{u.displayName || "No name"}{self ? " (you)" : ""}</b>
                <small>{u.email}</small>
              </div>
              {self ? (
                <span className="pill ok">{ROLE_LABEL[u.role]}</span>
              ) : (
                <select className="filter" value={u.role} onChange={(e) => setRole(u, e.target.value as Role)} aria-label={`Role for ${u.displayName || u.email}`}>
                  <option value="bandmate">BandMate</option>
                  <option value="admin">Admin</option>
                  <option value="disabled">Disabled</option>
                  <option value="pending">Back to waiting</option>
                </select>
              )}
            </div>
          );
        })}
        <p className="note">BandMates run the whole merch desk: stock, QR pictures, bundles, sales and the band's look. Admins can also approve people and change roles.</p>
      </section>
    </>
  );
}
