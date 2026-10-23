import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { signOut } from "firebase/auth";
import { query, where } from "firebase/firestore";
import { auth } from "../../firebase";
import { PLATFORM_HOST } from "../../lib/host";
import { activeBands, fetchMyBands, type MyBand } from "../../lib/memberships";
import { addBandDomain, approveBandRequest, bandsCol, domainsCol, rejectBandRequest, requestsCol, setBandStatus } from "../../lib/platform";
import { useLiveQuery } from "../../lib/live";
import { errorText } from "../../lib/format";
import { useAuth } from "../../state/auth";
import { useToast } from "../../state/toast";
import { useT } from "../../i18n";
import LangSwitch from "../../components/LangSwitch";
import { Loading } from "../../components/ui";
import type { BandInfo } from "../../state/tenant";
import type { BandRequest } from "../../types";

type BandRow = BandInfo & { id: string };
type DomainRow = { id: string; bandId: string };

/** BandMate operator console: new band requests, and every band with the addresses that open it. */
export default function PlatformConsole() {
  const t = useT();
  const { user, isPlatform, ready } = useAuth();
  const toast = useToast();
  const bands = useLiveQuery<BandRow>(() => (isPlatform ? bandsCol() : null), `platform-bands-${isPlatform}`);
  const domains = useLiveQuery<DomainRow>(() => (isPlatform ? domainsCol() : null), `platform-domains-${isPlatform}`);
  const requests = useLiveQuery<BandRequest>(() => (isPlatform ? query(requestsCol(), where("status", "==", "pending")) : null), `platform-requests-${isPlatform}`);
  const [newDomain, setNewDomain] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  // Is the person behind each pending request already working in a band? (one email, one band)
  const [inBands, setInBands] = useState<Record<string, MyBand[]>>({});
  const emailsKey = requests.data.map((r) => r.email).join("|");
  useEffect(() => {
    if (!isPlatform) return;
    requests.data.forEach((r) => {
      fetchMyBands(r.email)
        .then((b) => setInBands((m) => ({ ...m, [r.email]: activeBands(b).filter((x) => x.bandId !== r.bandId) })))
        .catch(() => {});
    });
  }, [emailsKey, isPlatform]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready) return <main className="page"><div className="wrap"><Loading /></div></main>;
  if (!user) return <main className="page"><div className="wrap"><Link to="/platform/login">{t("con.signInLink")}</Link></div></main>;
  if (!isPlatform)
    return (
      <main className="page auth">
        <div className="authcard">
          <div className="card-top"><span /><LangSwitch /></div>
          <h1>{t("con.noAccess")}</h1>
          <p className="note">{t("con.notAdmin", { email: user.email ?? "" })}</p>
          <button className="btn ghost block" onClick={() => signOut(auth)}>{t("common.signOut")}</button>
        </div>
      </main>
    );

  const run = (key: string, p: Promise<unknown>, okMsg: string) => {
    setBusy(key);
    p.then(() => toast(okMsg)).catch((e) => toast(errorText(e) || (e as Error).message)).finally(() => setBusy(""));
  };

  return (
    <main className="page">
      <div className="wrap">
        <div className="card-top"><h1>{t("con.title")}</h1><LangSwitch /></div>
        <p className="note">{t("con.signedInAs", { email: user.email ?? "" })}</p>

        <h2 className="sec">{t("con.requests")} {requests.data.length ? `(${requests.data.length})` : ""}</h2>
        {!requests.ready ? (
          <Loading />
        ) : requests.data.length === 0 ? (
          <p className="note">{t("con.none")}</p>
        ) : (
          requests.data.map((r) => (
            <section className="card" key={r.id}>
              <h2 className="card-h">{r.bandName}</h2>
              <p className="note">{t("con.address", { addr: `${r.bandId}.${PLATFORM_HOST}` })}</p>
              {r.domain && <p className="note">{t("con.ownDomain", { d: r.domain })}</p>}
              <p className="note">{t("con.byline", { name: r.displayName, email: r.email, v: r.termsVersion })}</p>
              {(inBands[r.email] || []).length > 0 && (
                <p className="hint err">{t("con.alreadyMember", { list: inBands[r.email].map((b) => `${b.name} (${b.role})`).join(", ") })}</p>
              )}
              <div className="stack-sm">
                <button className="btn primary" disabled={busy === r.id || (inBands[r.email] || []).length > 0} onClick={() => run(r.id, approveBandRequest(r), t("con.approved", { name: r.bandName }))}>{t("con.approve")}</button>
                <button className="btn ghost" disabled={busy === r.id} onClick={() => run(r.id, rejectBandRequest(r.id), t("con.rejected"))}>{t("con.reject")}</button>
              </div>
            </section>
          ))
        )}

        <h2 className="sec">{t("con.bands")}</h2>
        {!bands.ready ? (
          <Loading />
        ) : (
          bands.data.map((b) => (
            <section className="card" key={b.id}>
              <h2 className="card-h">{b.name}</h2>
              <p className="note">
                {b.id} · {b.status === "active" ? t("con.statusActive") : t("con.statusPaused")}
              </p>
              <p className="note">
                {t("con.addresses", { list: [`${b.id}.${PLATFORM_HOST}`, ...domains.data.filter((d) => d.bandId === b.id).map((d) => d.id)].join(", ") })}
              </p>
              <div className="stack-sm">
                <Link className="btn ghost" to={`/b/${b.id}`}>{t("con.openStore")}</Link>
                <Link className="btn primary" to={`/b/${b.id}/band`}>{t("con.openDesk")}</Link>
                <button className="btn ghost" disabled={busy === b.id} onClick={() => run(b.id, setBandStatus(b.id, b.status === "active" ? "paused" : "active"), b.status === "active" ? t("con.paused", { name: b.name }) : t("con.live", { name: b.name }))}>
                  {b.status === "active" ? t("con.pause") : t("con.resume")}
                </button>
              </div>
              <form
                className="row-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const host = (newDomain[b.id] || "").trim();
                  if (host) run(`d-${b.id}`, addBandDomain(host, b.id).then(() => setNewDomain((m) => ({ ...m, [b.id]: "" }))), t("con.domainAdded", { host, name: b.name }));
                }}
              >
                <input value={newDomain[b.id] || ""} onChange={(e) => setNewDomain((m) => ({ ...m, [b.id]: e.target.value }))} placeholder={t("con.addDomainPh")} aria-label={t("con.addDomainAria", { name: b.name })} autoCapitalize="none" spellCheck={false} />
                <button className="btn ghost" disabled={!(newDomain[b.id] || "").trim()}>{t("con.add")}</button>
              </form>
            </section>
          ))
        )}
        <button className="btn ghost block" onClick={() => signOut(auth)}>{t("common.signOut")}</button>
      </div>
    </main>
  );
}
