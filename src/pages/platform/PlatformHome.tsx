import { useState, type FormEvent } from "react";
import { Link } from "../../lib/nav";
import { PLATFORM_HOST, bandUrl } from "../../lib/host";
import { isBandIdTaken, slugFormatProblem } from "../../lib/platform";

/** What the person typed -> where to sign in. "name", "name.bandmate.shop" or a band's own domain. */
function signInTarget(raw: string): { host?: string; bandId?: string } | null {
  const v = raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!v) return null;
  if (v.endsWith(`.${PLATFORM_HOST}`)) return { bandId: v.slice(0, -PLATFORM_HOST.length - 1) };
  if (v.includes(".")) return { host: v };
  return { bandId: v };
}

export default function PlatformHome() {
  const [typed, setTyped] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const go = async (e: FormEvent) => {
    e.preventDefault();
    const t = signInTarget(typed);
    if (!t) return;
    setErr("");
    if (t.host) return window.location.assign(`https://${t.host}/login`);
    if (!t.bandId || slugFormatProblem(t.bandId)) return setErr("We can't find a band with that address.");
    setBusy(true);
    try {
      if (!(await isBandIdTaken(t.bandId))) {
        setErr("We can't find a band with that address.");
        setBusy(false);
        return;
      }
      window.location.assign(bandUrl(t.bandId, "/login"));
    } catch {
      setErr("Couldn't check. Check your connection and try again.");
      setBusy(false);
    }
  };

  return (
    <main className="page auth">
      <div className="authcard">
        <h1>BandMate</h1>
        <p className="note">
          Your own merch page: products and photos, stock, payment QR codes and sales at the merch table, from your phone. Every band gets its own address and its own team.
        </p>
        <Link className="btn primary block" to="/start">Start Your BandMate</Link>

        <hr className="sep" />
        <form className="stack" onSubmit={go}>
          <div className="field">
            <label htmlFor="homeBand">Already have a band here? Sign in</label>
            <div className="addr">
              <input id="homeBand" value={typed} autoCapitalize="none" autoCorrect="off" spellCheck={false} onChange={(e) => { setTyped(e.target.value); setErr(""); }} placeholder="your-band" />
              <span>.{PLATFORM_HOST}</span>
            </div>
            {err ? <span className="hint err">{err}</span> : <span className="hint">Type your band's address to go to its sign-in.</span>}
          </div>
          <button className="btn ghost block" disabled={!typed.trim() || busy}>{busy ? "Looking…" : "Sign in to your band"}</button>
        </form>
      </div>
    </main>
  );
}
