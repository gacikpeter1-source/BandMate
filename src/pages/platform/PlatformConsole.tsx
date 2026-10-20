import { Link } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase";
import { bandsCol, domainsCol } from "../../lib/platform";
import { useLiveQuery } from "../../lib/live";
import { useAuth } from "../../state/auth";
import { Loading } from "../../components/ui";
import type { BandInfo } from "../../state/tenant";

type BandRow = BandInfo & { id: string };
type DomainRow = { id: string; bandId: string };

/** BandMate operator console: every band and the addresses that open it. */
export default function PlatformConsole() {
  const { user, isPlatform, ready } = useAuth();
  const bands = useLiveQuery<BandRow>(() => (isPlatform ? bandsCol() : null), `platform-bands-${isPlatform}`);
  const domains = useLiveQuery<DomainRow>(() => (isPlatform ? domainsCol() : null), `platform-domains-${isPlatform}`);

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

  return (
    <main className="page">
      <div className="wrap">
        <h1>BandMate admin</h1>
        <p className="note">Signed in as {user.email}</p>
        {!bands.ready ? (
          <Loading />
        ) : (
          bands.data.map((b) => (
            <section className="card" key={b.id}>
              <h2 className="card-h">{b.name}</h2>
              <p className="note">
                {b.id} · {b.status}
              </p>
              <p className="note">
                Addresses: {domains.data.filter((d) => d.bandId === b.id).map((d) => d.id).join(", ") || "only /b/" + b.id}
              </p>
              <div className="stack-sm">
                <Link className="btn ghost" to={`/b/${b.id}`}>Open store</Link>
                <Link className="btn primary" to={`/b/${b.id}/band`}>Open desk</Link>
              </div>
            </section>
          ))
        )}
        <button className="btn ghost block" onClick={() => signOut(auth)}>Sign out</button>
      </div>
    </main>
  );
}
