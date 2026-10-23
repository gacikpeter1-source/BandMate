import { useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useNavigate } from "../lib/nav";
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth } from "../firebase";
import { errorText } from "../lib/format";
import { sendVerification } from "../lib/verify";
import { setPendingName, useAuth } from "../state/auth";
import { useSettings } from "../state/settings";
import { LogoBackdrop } from "../components/brand";
import { platformAdminUrl } from "../lib/host";
import { useTenant } from "../state/tenant";
import { useT } from "../i18n";
import LangSwitch from "../components/LangSwitch";

function Shell({ title, children }: { title: string; children: ReactNode }) {
  const t = useT();
  const { settings } = useSettings();
  const { bandId } = useTenant();
  return (
    <>
      <LogoBackdrop settings={settings} />
      <main className="page auth">
        <div className="authcard">
          <div className="card-top">
            <Link to="/" className="back">
              {bandId ? t("auth.backShop", { name: settings.bandName || "Merch" }) : "← BandMate"}
            </Link>
            <LangSwitch />
          </div>
          <h1>{title}</h1>
          {children}
        </div>
      </main>
    </>
  );
}

/** band = a band's own login; operator = BandMate admin (/platform/login);
 *  customer = someone registering a band at bandmate.shop (/start/login). */
export function Login({ variant = "band" }: { variant?: "band" | "operator" | "customer" }) {
  const t = useT();
  const nav = useNavigate();
  const after = variant === "operator" ? "/platform" : variant === "customer" ? "/start" : "/band";
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
    <Shell title={variant === "operator" ? t("login.titleOperator") : variant === "customer" ? t("login.titleCustomer") : t("login.titleBand")}>
      <form onSubmit={submit} className="stack">
        <div className="field">
          <label htmlFor="lEmail">{t("login.email")}</label>
          <input id="lEmail" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="lPw">{t("login.password")}</label>
          <input id="lPw" type="password" autoComplete="current-password" required value={pw} onChange={(e) => setPw(e.target.value)} />
        </div>
        {err && <p className="hint err">{err}</p>}
        {info && <p className="hint">{info}</p>}
        <button className="btn primary block" disabled={busy}>
          {busy ? t("common.signingIn") : t("login.signIn")}
        </button>
        <button
          type="button"
          className="linkbtn"
          onClick={async () => {
            if (!email.trim()) return setErr(t("login.typeEmailFirst"));
            try {
              await sendPasswordResetEmail(auth, email.trim());
              setErr("");
              setInfo(t("login.resetSent"));
            } catch (x) {
              setErr(errorText(x));
            }
          }}
        >
          {t("login.forgot")}
        </button>
      </form>
      {variant === "customer" && (
        <p className="note center">
          {t("login.newHere")} <Link to="/start/register">{t("login.createAccount")}</Link>
        </p>
      )}
      {variant === "band" && (
        <>
          <p className="note center">
            {t("login.newMember")} <Link to="/register">{t("login.createAccount")}</Link>
          </p>
          {/* Only here, on the login screen: never shown once someone is signed in. */}
          <p className="note center">
            <a href={platformAdminUrl()}>{t("login.adminLink")}</a>
          </p>
        </>
      )}
    </Shell>
  );
}

/** band = joining a band's team (waits for that band's admin); customer = account for registering a band. */
export function Register({ variant = "band" }: { variant?: "band" | "customer" }) {
  const t = useT();
  const nav = useNavigate();
  const after = variant === "customer" ? "/start" : "/band";
  const { user, ready } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  if (ready && user) return <Navigate to={after} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) return setErr(t("err.weakPassword"));
    setBusy(true);
    setErr("");
    try {
      if (variant === "band") setPendingName(name.trim());
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), pw);
      await updateProfile(cred.user, { displayName: name.trim() }).catch(() => {});
      // If this fails the next screen has a "Send again" button, so it is not fatal.
      await sendVerification(cred.user).catch(() => {});
      nav(after);
    } catch (x) {
      setErr(errorText(x));
      setBusy(false);
    }
  };

  return (
    <Shell title={variant === "customer" ? t("reg.titleCustomer") : t("reg.titleBand")}>
      <p className="note">
        {variant === "customer" ? t("reg.noteCustomer") : t("reg.noteBand")}
      </p>
      <form onSubmit={submit} className="stack">
        <div className="field">
          <label htmlFor="rName">{t("reg.yourName")}</label>
          <input id="rName" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("reg.namePh")} />
        </div>
        <div className="field">
          <label htmlFor="rEmail">{t("login.email")}</label>
          <input id="rEmail" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="rPw">{t("login.password")}</label>
          <input id="rPw" type="password" required autoComplete="new-password" minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} />
          <span className="hint">{t("reg.pwHint")}</span>
        </div>
        {err && <p className="hint err">{err}</p>}
        <button className="btn primary block" disabled={busy}>
          {busy ? t("reg.creating") : t("reg.create")}
        </button>
      </form>
      <p className="note center">
        {t("reg.haveAccount")} <Link to={variant === "customer" ? "/start/login" : "/login"}>{t("login.signIn")}</Link>
      </p>
    </Shell>
  );
}
