import { useEffect, useState } from "react";
import { Link } from "../lib/nav";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { errorText } from "../lib/format";
import { sendVerification } from "../lib/verify";
import { useAuth } from "../state/auth";
import { useTenant } from "../state/tenant";
import { useT } from "../i18n";
import LangSwitch from "../components/LangSwitch";

const RESEND_SECONDS = 60;
const POLL_MS = 4000;

/** Shown to anyone signed in whose email address is not confirmed yet. */
export default function VerifyEmail() {
  const t = useT();
  const { bandId } = useTenant();
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
      await sendVerification(auth.currentUser);
      setMsg(t("verify.sentOk"));
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
      if (!auth.currentUser?.emailVerified) setMsg(t("verify.notYet"));
    } catch (x) {
      setErr(errorText(x));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page auth">
      <div className="authcard">
        <div className="card-top"><span /><LangSwitch /></div>
        <h1>{t("verify.title")}</h1>
        <p className="note">
          {t("verify.sent")} <b>{user?.email}</b>. {t("verify.open")}
        </p>
        {msg && <p className="hint">{msg}</p>}
        {err && <p className="hint err">{err}</p>}
        <div className="stack-sm">
          <button className="btn primary block" onClick={check} disabled={busy}>
            {t("verify.confirmed")}
          </button>
          <button className="btn ghost block" onClick={resend} disabled={busy || wait > 0}>
            {wait > 0 ? t("verify.resendWait", { s: wait }) : t("verify.resend")}
          </button>
          {bandId && <Link className="btn ghost block" to="/">{t("verify.fanPage")}</Link>}
          <button className="btn ghost block" onClick={() => signOut(auth)}>{t("common.signOut")}</button>
        </div>
      </div>
    </main>
  );
}
