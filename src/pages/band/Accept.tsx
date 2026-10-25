import { useEffect, useRef, useState, type FormEvent } from "react";
import { isSignInWithEmailLink, signInWithEmailLink, updatePassword, updateProfile } from "firebase/auth";
import { updateDoc } from "firebase/firestore";
import { auth } from "../../firebase";
import { Link, useNavigate } from "../../lib/nav";
import { bandDoc } from "../../lib/scope";
import { errorText } from "../../lib/format";
import { useSettings } from "../../state/settings";
import { setPendingName } from "../../state/auth";
import { useT } from "../../i18n";
import { Shell } from "../AuthPages";

/** The page an invitation email links to: confirms the link (which also proves the email address is real),
 *  then lets the person choose a name and password. Their membership is created by state/auth.tsx. */
export default function Accept() {
  const t = useT();
  const nav = useNavigate();
  const { settings } = useSettings();
  const href = window.location.href;
  const isLink = isSignInWithEmailLink(auth, href);
  const [email, setEmail] = useState(new URLSearchParams(window.location.search).get("e")?.toLowerCase() || "");
  const [step, setStep] = useState<"email" | "checking" | "password" | "bad">(isLink ? (email ? "checking" : "email") : "bad");
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  const confirmLink = async (addr: string) => {
    if (started.current) return;
    started.current = true;
    try {
      // A page reload after the link was used would fail; someone already signed in as this address just continues.
      if ((auth.currentUser?.email || "").toLowerCase() !== addr) await signInWithEmailLink(auth, addr, href);
      setStep("password");
    } catch {
      started.current = false;
      setStep("bad");
    }
  };

  useEffect(() => {
    if (step === "checking" && email) confirmLink(email);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submitEmail = (e: FormEvent) => {
    e.preventDefault();
    setStep("checking");
    confirmLink(email.trim().toLowerCase());
  };

  const submitPassword = async (e: FormEvent) => {
    e.preventDefault();
    const u = auth.currentUser;
    if (!u) return setStep("bad");
    if (pw.length < 8) return setErr(t("err.weakPassword"));
    setBusy(true);
    setErr("");
    try {
      setPendingName(name.trim());
      await updatePassword(u, pw);
      await updateProfile(u, { displayName: name.trim() }).catch(() => {});
      // The membership may already exist (created the moment the link signed them in): put their name on it.
      await updateDoc(bandDoc("members", u.uid), { displayName: name.trim() }).catch(() => {});
      nav("/band");
    } catch (x) {
      setErr(errorText(x));
      setBusy(false);
    }
  };

  const band = settings.bandName || "";
  return (
    <Shell title={t("accept.title", { band })}>
      {step === "checking" && <p className="note">{t("accept.checking")}</p>}
      {step === "email" && (
        <form className="stack" onSubmit={submitEmail}>
          <p className="note">{t("accept.askEmail")}</p>
          <div className="field">
            <label htmlFor="aEmail">{t("login.email")}</label>
            <input id="aEmail" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <button className="btn primary block">{t("accept.continue")}</button>
        </form>
      )}
      {step === "password" && (
        <form className="stack" onSubmit={submitPassword}>
          <p className="note">{t("accept.welcome", { email: auth.currentUser?.email || email })}</p>
          <div className="field">
            <label htmlFor="aName">{t("reg.yourName")}</label>
            <input id="aName" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("reg.namePh")} />
          </div>
          <div className="field">
            <label htmlFor="aPw">{t("accept.choosePassword")}</label>
            <input id="aPw" type="password" required autoComplete="new-password" minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} />
            <span className="hint">{t("reg.pwHint")}</span>
          </div>
          {err && <p className="hint err">{err}</p>}
          <button className="btn primary block" disabled={busy}>{busy ? t("reg.creating") : t("accept.finish")}</button>
        </form>
      )}
      {step === "bad" && (
        <>
          <p className="note">{t("accept.bad")}</p>
          <Link className="btn ghost block" to="/login">{t("accept.toLogin")}</Link>
        </>
      )}
    </Shell>
  );
}
