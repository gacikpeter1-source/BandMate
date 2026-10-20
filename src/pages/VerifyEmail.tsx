import { useEffect, useState } from "react";
import { Link } from "../lib/nav";
import { sendEmailVerification, signOut } from "firebase/auth";
import { auth } from "../firebase";
import { errorText } from "../lib/format";
import { verifyLinkSettings } from "../lib/verify";
import { useAuth } from "../state/auth";

const RESEND_SECONDS = 60;
const POLL_MS = 4000;

/** Shown to anyone signed in whose email address is not confirmed yet. */
export default function VerifyEmail() {
  const { user, recheck } = useAuth();
  const [wait, setWait] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // Opens the desk by itself once the link in the email was clicked (even on another device).
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        await auth.currentUser?.reload();
        if (auth.currentUser?.emailVerified) await recheck();
      } catch {
        /* offline: try again on the next tick */
      }
    }, POLL_MS);
    return () => clearInterval(t);
  }, [recheck]);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const resend = async () => {
    if (!auth.currentUser) return;
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      await sendEmailVerification(auth.currentUser, verifyLinkSettings());
      setMsg("Sent. Check your inbox and your spam folder.");
      setWait(RESEND_SECONDS);
    } catch (x) {
      setErr(errorText(x));
    } finally {
      setBusy(false);
    }
  };

  const check = async () => {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      await recheck();
      if (!auth.currentUser?.emailVerified) setMsg("Not confirmed yet. Open the link in the email first.");
    } catch (x) {
      setErr(errorText(x));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page auth">
      <div className="authcard">
        <h1>Confirm your email</h1>
        <p className="note">
          We sent a link to <b>{user?.email}</b>. Open it to confirm this address. You can't use the app until you do. This page continues by itself once you have.
        </p>
        {msg && <p className="hint">{msg}</p>}
        {err && <p className="hint err">{err}</p>}
        <div className="stack-sm">
          <button className="btn primary block" onClick={check} disabled={busy}>
            I've confirmed it
          </button>
          <button className="btn ghost block" onClick={resend} disabled={busy || wait > 0}>
            {wait > 0 ? `Send the email again (${wait}s)` : "Send the email again"}
          </button>
          <Link className="btn ghost block" to="/">See the fan page</Link>
          <button className="btn ghost block" onClick={() => signOut(auth)}>Sign out</button>
        </div>
      </div>
    </main>
  );
}
