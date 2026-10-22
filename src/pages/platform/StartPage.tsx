import { useEffect, useState, type FormEvent } from "react";
import { signOut, type User } from "firebase/auth";
import { auth } from "../../firebase";
import { Link } from "../../lib/nav";
import { PLATFORM_HOST, bandUrl } from "../../lib/host";
import { useLiveDoc } from "../../lib/live";
import { cancelBandRequest, fileBandRequest, isBandIdTaken, requestDoc, slugFormatProblem, slugify, type SlugProblem } from "../../lib/platform";
import { useAuth } from "../../state/auth";
import { Loading } from "../../components/ui";
import VerifyEmail from "../VerifyEmail";
import type { BandRequest } from "../../types";

const card = (children: React.ReactNode) => (
  <main className="page auth">
    <div className="authcard">{children}</div>
  </main>
);

/** /start: register your band. Sign in (or create an account), confirm the email, file the request. */
export default function StartPage() {
  const { user, ready } = useAuth();
  if (!ready) return <main className="page"><div className="wrap"><Loading /></div></main>;
  if (!user)
    return card(
      <>
        <Link to="/" className="back">← BandMate</Link>
        <h1>Register your band</h1>
        <p className="note">Create an account (we email you a link to confirm your address), then tell us your band's name and the address you want, for example helloween.{PLATFORM_HOST}.</p>
        <div className="stack-sm">
          <Link className="btn primary block" to="/start/register">Create an account</Link>
          <Link className="btn ghost block" to="/start/login">I already have an account</Link>
        </div>
      </>
    );
  if (!user.emailVerified) return <VerifyEmail />;
  return <Founder user={user} />;
}

function Founder({ user }: { user: User }) {
  const req = useLiveDoc<BandRequest>(() => requestDoc(user.uid), `request-${user.uid}`);
  if (!req.ready) return <main className="page"><div className="wrap"><Loading /></div></main>;
  if (req.data) return <Status req={req.data} uid={user.uid} />;
  return <RequestForm user={user} />;
}

const PROBLEM: Record<Exclude<SlugProblem, null>, string> = {
  short: "At least 3 characters.",
  bad: "Use only lowercase letters, digits and single dashes.",
  reserved: "That name is reserved. Pick another.",
  taken: "That address is already taken. Pick another.",
};

function RequestForm({ user }: { user: User }) {
  const [person, setPerson] = useState(user.displayName || "");
  const [bandName, setBandName] = useState("");
  const [address, setAddress] = useState("");
  const [edited, setEdited] = useState(false);
  const [domain, setDomain] = useState("");
  const [agree, setAgree] = useState(false);
  const [problem, setProblem] = useState<SlugProblem>(null);
  const [checking, setChecking] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // The address follows the band name until the person types their own.
  useEffect(() => {
    if (!edited) setAddress(slugify(bandName));
  }, [bandName, edited]);

  useEffect(() => {
    if (!address) return setProblem(null);
    const local = slugFormatProblem(address);
    if (local) return setProblem(local);
    setChecking(true);
    let stale = false;
    const t = setTimeout(async () => {
      try {
        const taken = await isBandIdTaken(address);
        if (!stale) setProblem(taken ? "taken" : null);
      } catch {
        if (!stale) setProblem(null);
      } finally {
        if (!stale) setChecking(false);
      }
    }, 350);
    return () => {
      stale = true;
      clearTimeout(t);
      setChecking(false);
    };
  }, [address]);

  const ok = bandName.trim().length >= 2 && person.trim().length >= 2 && address && !problem && !checking && agree;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ok) return;
    setBusy(true);
    setErr("");
    try {
      await fileBandRequest({ uid: user.uid, email: (user.email || "").toLowerCase(), displayName: person.trim(), bandName, bandId: address, domain });
    } catch (x) {
      const code = (x as { code?: string })?.code;
      setErr(code === "permission-denied" ? "That address was just taken or isn't allowed. Pick another one." : "Couldn't send the request. Check your connection and try again.");
      setBusy(false);
    }
  };

  return (
    <main className="page auth">
      <div className="authcard">
        <Link to="/" className="back">← BandMate</Link>
        <h1>Register your band</h1>
        <form className="stack" onSubmit={submit}>
          <div className="field">
            <label htmlFor="rqPerson">Your name</label>
            <input id="rqPerson" required autoComplete="name" value={person} onChange={(e) => setPerson(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="rqBand">Band name</label>
            <input id="rqBand" required maxLength={60} value={bandName} onChange={(e) => setBandName(e.target.value)} placeholder="Helloween" />
          </div>
          <div className="field">
            <label htmlFor="rqAddr">Your address</label>
            <div className="addr">
              <input id="rqAddr" value={address} autoCapitalize="none" autoCorrect="off" spellCheck={false} onChange={(e) => { setEdited(true); setAddress(e.target.value.toLowerCase()); }} placeholder="helloween" />
              <span>.{PLATFORM_HOST}</span>
            </div>
            {problem ? <span className="hint err">{PROBLEM[problem]}</span> : address ? <span className="hint">{checking ? "Checking…" : `Free: ${address}.${PLATFORM_HOST}`}</span> : <span className="hint">Letters, digits and dashes. This is where fans find your merch.</span>}
          </div>
          <div className="field">
            <label htmlFor="rqDom">Your own domain (optional)</label>
            <input id="rqDom" value={domain} autoCapitalize="none" autoCorrect="off" spellCheck={false} onChange={(e) => setDomain(e.target.value)} placeholder="merch.yourband.com" />
            <span className="hint">If you already own one, we can connect it too.</span>
          </div>
          <label className="check">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>I have read the <Link to="/terms" target="_blank" rel="noopener">terms and rules</Link> and agree with them.</span>
          </label>
          {err && <p className="hint err">{err}</p>}
          <button className="btn primary block" disabled={!ok || busy}>{busy ? "Sending…" : "Send request"}</button>
        </form>
        <button className="btn ghost block" onClick={() => signOut(auth)}>Sign out</button>
      </div>
    </main>
  );
}

function Status({ req, uid }: { req: BandRequest; uid: string }) {
  const [busy, setBusy] = useState(false);
  const url = bandUrl(req.bandId);
  const withdraw = () => {
    setBusy(true);
    cancelBandRequest(uid).catch(() => setBusy(false));
  };
  if (req.status === "approved")
    return card(
      <>
        <h1>Your band is ready</h1>
        <p className="note"><b>{req.bandName}</b> now has its own page. Open it and sign in there with the same email and password. Each address has its own sign-in.</p>
        <div className="stack-sm">
          <a className="btn primary block" href={bandUrl(req.bandId, "/login")}>Sign in to your band desk</a>
          <a className="btn ghost block" href={url}>See your merch page</a>
          <button className="btn ghost block" onClick={() => signOut(auth)}>Sign out</button>
        </div>
      </>
    );
  if (req.status === "rejected")
    return card(
      <>
        <h1>Request not approved</h1>
        <p className="note">We couldn't approve the request for <b>{req.bandName}</b>. You can send a new one with different details.</p>
        <div className="stack-sm">
          <button className="btn primary block" onClick={withdraw} disabled={busy}>Start a new request</button>
          <button className="btn ghost block" onClick={() => signOut(auth)}>Sign out</button>
        </div>
      </>
    );
  return card(
    <>
      <h1>Request received</h1>
      <p className="note">We're looking at it. Once it's approved, <b>{req.bandName}</b> will live at <b>{req.bandId}.{PLATFORM_HOST}</b>. Come back to this page to see the result.</p>
      <div className="stack-sm">
        <button className="btn ghost block" onClick={withdraw} disabled={busy}>Withdraw the request</button>
        <button className="btn ghost block" onClick={() => signOut(auth)}>Sign out</button>
      </div>
    </>
  );
}
