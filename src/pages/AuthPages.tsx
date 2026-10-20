import { useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useNavigate } from "../lib/nav";
import { createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth } from "../firebase";
import { errorText } from "../lib/format";
import { verifyLinkSettings } from "../lib/verify";
import { setPendingName, useAuth } from "../state/auth";
import { useSettings } from "../state/settings";
import { LogoBackdrop } from "../components/brand";
import { platformAdminUrl } from "../lib/host";
import { useTenant } from "../state/tenant";

function Shell({ title, children }: { title: string; children: ReactNode }) {
  const { settings } = useSettings();
  const { bandId } = useTenant();
  return (
    <>
      <LogoBackdrop settings={settings} />
      <main className="page auth">
        <div className="authcard">
          <Link to="/" className="back">
            ← {bandId ? `${settings.bandName || "Merch"} shop` : "BandMate"}
          </Link>
          <h1>{title}</h1>
          {children}
        </div>
      </main>
    </>
  );
}

/** `platform` = the BandMate operator's own login (/platform/login), not a band's. */
export function Login({ platform = false }: { platform?: boolean }) {
  const nav = useNavigate();
  const after = platform ? "/platform" : "/band";
  const { user, ready } = useAuth();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  if (ready && user) return <Navigate to={after} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), pw);
      nav(after);
    } catch (x) {
      setErr(errorText(x));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title={platform ? "BandMate admin" : "Band login"}>
      <form onSubmit={submit} className="stack">
        <div className="field">
          <label htmlFor="lEmail">Email</label>
          <input id="lEmail" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="lPw">Password</label>
          <input id="lPw" type="password" autoComplete="current-password" required value={pw} onChange={(e) => setPw(e.target.value)} />
        </div>
        {err && <p className="hint err">{err}</p>}
        {info && <p className="hint">{info}</p>}
        <button className="btn primary block" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <button
          type="button"
          className="linkbtn"
          onClick={async () => {
            if (!email.trim()) return setErr("Type your email first, then tap Forgot password.");
            try {
              await sendPasswordResetEmail(auth, email.trim());
              setErr("");
              setInfo("If that account exists, a reset link is on its way to your inbox.");
            } catch (x) {
              setErr(errorText(x));
            }
          }}
        >
          Forgot password?
        </button>
      </form>
      {!platform && (
        <>
          <p className="note center">
            New band member? <Link to="/register">Create an account</Link>
          </p>
          {/* Only here, on the login screen: never shown once someone is signed in. */}
          <p className="note center">
            <a href={platformAdminUrl()}>BandMate admin</a>
          </p>
        </>
      )}
    </Shell>
  );
}

export function Register() {
  const nav = useNavigate();
  const { user, ready } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  if (ready && user) return <Navigate to="/band" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) return setErr("Use a password of at least 8 characters.");
    setBusy(true);
    setErr("");
    try {
      setPendingName(name.trim());
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), pw);
      await updateProfile(cred.user, { displayName: name.trim() }).catch(() => {});
      // If this fails the next screen has a "Send again" button, so it is not fatal.
      await sendEmailVerification(cred.user, verifyLinkSettings()).catch(() => {});
      nav("/band");
    } catch (x) {
      setErr(errorText(x));
      setBusy(false);
    }
  };

  return (
    <Shell title="Join the band desk">
      <p className="note">We email you a link to confirm your address. After that, the admin approves your account and makes you a BandMate.</p>
      <form onSubmit={submit} className="stack">
        <div className="field">
          <label htmlFor="rName">Your name</label>
          <input id="rName" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name the band knows you by" />
        </div>
        <div className="field">
          <label htmlFor="rEmail">Email</label>
          <input id="rEmail" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="rPw">Password</label>
          <input id="rPw" type="password" required autoComplete="new-password" minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} />
          <span className="hint">At least 8 characters.</span>
        </div>
        {err && <p className="hint err">{err}</p>}
        <button className="btn primary block" disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="note center">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </Shell>
  );
}
