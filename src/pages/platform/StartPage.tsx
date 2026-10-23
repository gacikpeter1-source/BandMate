import { useEffect, useState, type FormEvent } from "react";
import { signOut, type User } from "firebase/auth";
import { auth } from "../../firebase";
import { Link } from "../../lib/nav";
import { PLATFORM_HOST, bandUrl } from "../../lib/host";
import { useLiveDoc } from "../../lib/live";
import { cancelBandRequest, fileBandRequest, isBandIdTaken, requestDoc, slugFormatProblem, slugify, type SlugProblem } from "../../lib/platform";
import { useAuth } from "../../state/auth";
import { useT, type Key } from "../../i18n";
import LangSwitch from "../../components/LangSwitch";
import { Loading } from "../../components/ui";
import VerifyEmail from "../VerifyEmail";
import type { BandRequest } from "../../types";

const card = (children: React.ReactNode) => (
  <main className="page auth">
    <div className="authcard">
      <div className="card-top"><span /><LangSwitch /></div>
      {children}
    </div>
  </main>
);

/** /start: register your band. Sign in (or create an account), confirm the email, file the request. */
export default function StartPage() {
  const t = useT();
  const { user, ready } = useAuth();
  if (!ready) return <main className="page"><div className="wrap"><Loading /></div></main>;
  if (!user)
    return card(
      <>
        <Link to="/" className="back">← BandMate</Link>
        <h1>{t("start.title")}</h1>
        <p className="note">{t("start.intro", { host: PLATFORM_HOST })}</p>
        <div className="stack-sm">
          <Link className="btn primary block" to="/start/register">{t("start.createAccount")}</Link>
          <Link className="btn ghost block" to="/start/login">{t("start.haveAccount")}</Link>
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

const PROBLEM: Record<Exclude<SlugProblem, null>, Key> = {
  short: "slug.short",
  bad: "slug.bad",
  reserved: "slug.reserved",
  taken: "slug.taken",
};

function RequestForm({ user }: { user: User }) {
  const t = useT();
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
      setErr(code === "permission-denied" ? t("start.errDenied") : t("start.errGeneric"));
      setBusy(false);
    }
  };

  return (
    <main className="page auth">
      <div className="authcard">
        <div className="card-top">
          <Link to="/" className="back">← BandMate</Link>
          <LangSwitch />
        </div>
        <h1>{t("start.title")}</h1>
        <form className="stack" onSubmit={submit}>
          <div className="field">
            <label htmlFor="rqPerson">{t("start.yourName")}</label>
            <input id="rqPerson" required autoComplete="name" value={person} onChange={(e) => setPerson(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="rqBand">{t("start.bandName")}</label>
            <input id="rqBand" required maxLength={60} value={bandName} onChange={(e) => setBandName(e.target.value)} placeholder="Helloween" />
          </div>
          <div className="field">
            <label htmlFor="rqAddr">{t("start.address")}</label>
            <div className="addr">
              <input id="rqAddr" value={address} autoCapitalize="none" autoCorrect="off" spellCheck={false} onChange={(e) => { setEdited(true); setAddress(e.target.value.toLowerCase()); }} placeholder="helloween" />
              <span>.{PLATFORM_HOST}</span>
            </div>
            {problem ? <span className="hint err">{t(PROBLEM[problem])}</span> : address ? <span className="hint">{checking ? t("start.checking") : t("start.addrFree", { addr: `${address}.${PLATFORM_HOST}` })}</span> : <span className="hint">{t("start.addrHint")}</span>}
          </div>
          <div className="field">
            <label htmlFor="rqDom">{t("start.ownDomain")}</label>
            <input id="rqDom" value={domain} autoCapitalize="none" autoCorrect="off" spellCheck={false} onChange={(e) => setDomain(e.target.value)} placeholder={t("start.domainPh")} />
            <span className="hint">{t("start.ownDomainHint")}</span>
          </div>
          <label className="check">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>{t("start.agreeBefore")}<Link to="/terms" target="_blank" rel="noopener">{t("start.terms")}</Link>{t("start.agreeAfter")}</span>
          </label>
          {err && <p className="hint err">{err}</p>}
          <button className="btn primary block" disabled={!ok || busy}>{busy ? t("start.sending") : t("start.send")}</button>
        </form>
        <button className="btn ghost block" onClick={() => signOut(auth)}>{t("common.signOut")}</button>
      </div>
    </main>
  );
}

function Status({ req, uid }: { req: BandRequest; uid: string }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const url = bandUrl(req.bandId);
  const withdraw = () => {
    setBusy(true);
    cancelBandRequest(uid).catch(() => setBusy(false));
  };
  if (req.status === "approved")
    return card(
      <>
        <h1>{t("start.readyTitle")}</h1>
        <p className="note">{t("start.readyText", { name: req.bandName })}</p>
        <div className="stack-sm">
          <a className="btn primary block" href={bandUrl(req.bandId, "/login")}>{t("start.signInBand")}</a>
          <a className="btn ghost block" href={url}>{t("start.seePage")}</a>
          <button className="btn ghost block" onClick={() => signOut(auth)}>{t("common.signOut")}</button>
        </div>
      </>
    );
  if (req.status === "rejected")
    return card(
      <>
        <h1>{t("start.rejTitle")}</h1>
        <p className="note">{t("start.rejText", { name: req.bandName })}</p>
        <div className="stack-sm">
          <button className="btn primary block" onClick={withdraw} disabled={busy}>{t("start.newRequest")}</button>
          <button className="btn ghost block" onClick={() => signOut(auth)}>{t("common.signOut")}</button>
        </div>
      </>
    );
  return card(
    <>
      <h1>{t("start.recvTitle")}</h1>
      <p className="note">{t("start.recvText", { name: req.bandName, addr: `${req.bandId}.${PLATFORM_HOST}` })}</p>
      <div className="stack-sm">
        <button className="btn ghost block" onClick={withdraw} disabled={busy}>{t("start.withdraw")}</button>
        <button className="btn ghost block" onClick={() => signOut(auth)}>{t("common.signOut")}</button>
      </div>
    </>
  );
}
