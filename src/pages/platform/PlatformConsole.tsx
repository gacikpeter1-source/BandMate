import { useState } from "react";
import { Link } from "react-router-dom";
import { signOut } from "firebase/auth";
import { query, where } from "firebase/firestore";
import { auth } from "../../firebase";
import { PLATFORM_HOST } from "../../lib/host";
import { addBandDomain, approveBandRequest, bandsCol, domainsCol, rejectBandRequest, requestsCol, setBandStatus } from "../../lib/platform";
import { useLiveQuery } from "../../lib/live";
import { errorText } from "../../lib/format";
import { useAuth } from "../../state/auth";
import { useToast } from "../../state/toast";
import { Loading } from "../../components/ui";
import type { BandInfo } from "../../state/tenant";
import type { BandRequest } from "../../types";

type BandRow = BandInfo & { id: string };
type DomainRow = { id: string; bandId: string };

/** BandMate operator console: new band requests, and every band with the addresses that open it. */
export default function PlatformConsole() {
  const { user, isPlatform, ready } = useAuth();
  const toast = useToast();
  const bands = useLiveQuery<BandRow>(() => (isPlatform ? bandsCol() : null), `platform-bands-${isPlatform}`);
  const domains = useLiveQuery<DomainRow>(() => (isPlatform ? domainsCol() : null), `platform-domains-${isPlatform}`);
  const requests = useLiveQuery<BandRequest>(() => (isPlatform ? query(requestsCol(), where("status", "==", "pending")) : null), `platform-requests-${isPlatform}`);
  const [newDomain, setNewDomain] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");

  if (!ready) return <main className="page"><div className="wrap"><Loading /></div></main>;
  if (!user) return <main className="page"><div className="wrap"><Link to="/platform/login">Sign in to BandMate admin</Link></div></main>;
  if (!isPlatform)
    return (
      <main className="page auth">
        <div className="authcard">
          <h1>No access</h1>
          <p className="note">{user.email} is not a BandMate admin.</p>
          <button className="btn ghost block" onClick={() => signOut(auth)}>Sign out</button>
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
        <h1>BandMate admin</h1>
        <p className="note">Signed in as {user.email}</p>

        <h2 className="sec">New band requests {requests.data.length ? `(${requests.data.length})` : ""}</h2>
        {!requests.ready ? (
          <Loading />
        ) : requests.data.length === 0 ? (
          <p className="note">No requests waiting.</p>
        ) : (
          requests.data.map((r) => (
            <section className="card" key={r.id}>
              <h2 className="card-h">{r.bandName}</h2>
              <p className="note">Address: <b>{r.bandId}.{PLATFORM_HOST}</b></p>
              {r.domain && <p className="note">Own domain: {r.domain} (add it in Vercel and Firebase after approving)</p>}
              <p className="note">{r.displayName} · {r.email} · agreed to terms {r.termsVersion}</p>
              <div className="stack-sm">
                <button className="btn primary" disabled={busy === r.id} onClick={() => run(r.id, approveBandRequest(r), `${r.bandName} approved`)}>Approve and create the band</button>
                <button className="btn ghost" disabled={busy === r.id} onClick={() => run(r.id, rejectBandRequest(r.id), "Request rejected")}>Reject</button>
              </div>
            </section>
          ))
        )}

        <h2 className="sec">Bands</h2>
        {!bands.ready ? (
          <Loading />
        ) : (
          bands.data.map((b) => (
            <section className="card" key={b.id}>
              <h2 className="card-h">{b.name}</h2>
              <p className="note">
                {b.id} · {b.status === "active" ? "active" : "paused"}
              </p>
              <p className="note">
                Addresses: {[`${b.id}.${PLATFORM_HOST}`, ...domains.data.filter((d) => d.bandId === b.id).map((d) => d.id)].join(", ")}
              </p>
              <div className="stack-sm">
                <Link className="btn ghost" to={`/b/${b.id}`}>Open store</Link>
                <Link className="btn primary" to={`/b/${b.id}/band`}>Open desk</Link>
                <button className="btn ghost" disabled={busy === b.id} onClick={() => run(b.id, setBandStatus(b.id, b.status === "active" ? "paused" : "active"), b.status === "active" ? `${b.name} paused` : `${b.name} is live again`)}>
                  {b.status === "active" ? "Pause this band" : "Resume this band"}
                </button>
              </div>
              <form
                className="row-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const host = (newDomain[b.id] || "").trim();
                  if (host) run(`d-${b.id}`, addBandDomain(host, b.id).then(() => setNewDomain((m) => ({ ...m, [b.id]: "" }))), `${host} now opens ${b.name}`);
                }}
              >
                <input value={newDomain[b.id] || ""} onChange={(e) => setNewDomain((m) => ({ ...m, [b.id]: e.target.value }))} placeholder="Add the band's own domain" aria-label={`Add a domain for ${b.name}`} autoCapitalize="none" spellCheck={false} />
                <button className="btn ghost" disabled={!(newDomain[b.id] || "").trim()}>Add</button>
              </form>
            </section>
          ))
        )}
        <button className="btn ghost block" onClick={() => signOut(auth)}>Sign out</button>
      </div>
    </main>
  );
}
