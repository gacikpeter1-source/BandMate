import { useEffect, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "../../firebase";
import { Link } from "../../lib/nav";
import { errorText } from "../../lib/format";
import { fetchMyBands, type MyBand } from "../../lib/memberships";
import { useAuth, roleLabel } from "../../state/auth";
import { useT } from "../../i18n";
import LangSwitch from "../../components/LangSwitch";
import { Loading } from "../../components/ui";
import VerifyEmail from "../VerifyEmail";
import type { User } from "firebase/auth";

const Card = ({ children }: { children: React.ReactNode }) => {
  return (
    <main className="page auth">
      <div className="authcard">
        <div className="card-top">
          <h1>BandMate</h1>
          <LangSwitch />
        </div>
        {children}
      </div>
    </main>
  );
};

/** bandmate.shop: sign in with email + password, or start a new band. Kept deliberately simple. */
export default function PlatformHome() {
  const { user, ready } = useAuth();
  if (!ready) return <main className="page"><div className="wrap"><Loading /></div></main>;
  if (!user) return <LoginCard />;
  if (!user.emailVerified) return <VerifyEmail />;
  return <MyBands user={user} />;
}

function LoginCard() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    setInfo("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), pw);
    } catch (x) {
      setErr(errorText(x));
      setBusy(false);
    }
  };

  return (
    <Card>
      <p className="note">{t("home.tagline")}</p>
      <form onSubmit={submit} className="stack">
        <div className="field">
          <label htmlFor="hEmail">{t("login.email")}</label>
          <input id="hEmail" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="hPw">{t("login.password")}</label>
          <input id="hPw" type="password" autoComplete="current-password" required value={pw} onChange={(e) => setPw(e.target.value)} />
        </div>
        {err && <p className="hint err">{err}</p>}
        {info && <p className="hint">{info}</p>}
        <button className="btn primary block" disabled={busy}>{busy ? t("common.signingIn") : t("home.loginBtn")}</button>
      </form>
      <Link className="btn ghost block" to="/start">{t("home.start")}</Link>
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
    </Card>
  );
}

/** Signed in: straight into the band if there is only one, otherwise a short list to choose from. */
function MyBands({ user }: { user: User }) {
  const t = useT();
  const { isPlatform } = useAuth();
  const [bands, setBands] = useState<MyBand[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let stale = false;
    fetchMyBands(user.email || "")
      .then((b) => !stale && setBands(b))
      .catch(() => !stale && setFailed(true));
    return () => {
      stale = true;
    };
  }, [user.email]);

  if (bands && bands.length === 1 && !isPlatform) return <Navigate to={`/b/${bands[0].bandId}/band`} replace />;

  return (
    <Card>
      {failed ? (
        <p className="hint err">{t("home.bandsError")}</p>
      ) : !bands ? (
        <p className="note">{t("home.findingBands")}</p>
      ) : (
        <>
          {bands.length > 0 ? (
            <>
              <h2 className="sec">{t("home.yourBands")}</h2>
              <div className="stack-sm">
                {bands.map((b) => (
                  <Link key={b.bandId} className="btn ghost block" to={`/b/${b.bandId}/band`}>
                    {b.name}
                    {b.role === "pending" ? ` · ${t("home.pendingTag")}` : ` · ${roleLabel(b.role)}`}
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <>
              <h2 className="sec">{t("home.noBandsTitle")}</h2>
              <p className="note">{t("home.noBandsText")}</p>
            </>
          )}
          {isPlatform && <Link className="btn primary block" to="/platform">{t("home.console")}</Link>}
          <Link className="btn ghost block" to="/start">{t("home.start")}</Link>
        </>
      )}
      <button className="btn ghost block" onClick={() => signOut(auth)}>{t("common.signOut")}</button>
    </Card>
  );
}
