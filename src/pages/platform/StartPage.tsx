import { useEffect, useState, type FormEvent } from "react";
import { createUserWithEmailAndPassword, signOut, updateProfile, type User } from "firebase/auth";
import { auth } from "../../firebase";
import { Link } from "../../lib/nav";
import { PLATFORM_HOST, bandUrl } from "../../lib/host";
import { useLiveDoc } from "../../lib/live";
import { activeBands, fetchMyBands, type MyBand } from "../../lib/memberships";
import { cancelBandRequest, fileBandRequest, isBandIdTaken, requestDoc, slugFormatProblem, slugify, type SlugProblem } from "../../lib/platform";
import { useAuth } from "../../state/auth";
import { errorText } from "../../lib/format";
import { sendVerification } from "../../lib/verify";
import { PAID_CHECKOUT_ENABLED, PLAN_LIMITS, PRICE_PAID } from "../../lib/plans";
import { PlanTable } from "../../components/plans";
import { useT, type Key } from "../../i18n";
import LangSwitch from "../../components/LangSwitch";
import { Loading, Sheet } from "../../components/ui";
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
  const { user, ready } = useAuth();
  if (!ready) return <main className="page"><div className="wrap"><Loading /></div></main>;
  if (!user) return <SignupForm />;
  if (!user.emailVerified) return <VerifyEmail />;
  return <Founder user={user} />;
}

function Founder({ user }: { user: User }) {
  const req = useLiveDoc<BandRequest>(() => requestDoc(user.uid), `request-${user.uid}`);
  // One email, one band: someone who already works in a band can't register another.
  // If the lookup fails we let them through; the operator checks again before approving.
  const [mine, setMine] = useState<MyBand[] | "failed" | null>(null);
  useEffect(() => {
    let stale = false;
    fetchMyBands(user.email || "")
      .then((b) => !stale && setMine(b))
      .catch(() => !stale && setMine("failed"));
    return () => {
      stale = true;
    };
  }, [user.email]);
  // The sign-up form keeps what was typed until the email is confirmed, then files the request by itself.
  const [draft, setDraft] = useState(() => readDraft(user.uid));
  const [filing, setFiling] = useState(false);
  const canFile = req.ready && !!mine && !req.data && !!draft && !(mine !== "failed" && activeBands(mine)[0]);
  useEffect(() => {
    if (!canFile || !draft || filing) return;
    setFiling(true);
    fileBandRequest({ uid: user.uid, email: (user.email || "").toLowerCase(), displayName: draft.person, bandName: draft.bandName, bandId: draft.bandId })
      .then(() => clearDraft())
      .catch(() => {
        // e.g. the address was taken meanwhile: let the person fix it in the normal form
        clearDraft();
        setDraft(null);
      })
      .finally(() => setFiling(false));
  }, [canFile]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!req.ready || !mine || (canFile && draft)) return <main className="page"><div className="wrap"><Loading /></div></main>;
  if (req.data) return <Status req={req.data} uid={user.uid} />;
  const already = mine === "failed" ? undefined : activeBands(mine)[0];
  if (already) return <AlreadyInBand email={user.email || ""} band={already} />;
  return <RequestForm user={user} />;
}

interface Draft { uid: string; person: string; bandName: string; bandId: string }
const DRAFT_KEY = "bandmate-start-draft";
function readDraft(uid: string): Draft | null {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null") as Draft | null;
    return d && d.uid === uid ? d : null;
  } catch {
    return null;
  }
}
const saveDraft = (d: Draft) => {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    /* private mode: the person fills the short form after confirming instead */
  }
};
function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* nothing to clear */
  }
}

function AlreadyInBand({ email, band }: { email: string; band: MyBand }) {
  const t = useT();
  return card(
    <>
      <h1>{t("start.alreadyTitle")}</h1>
      <p className="note">{t("start.alreadyText", { email, name: band.name })}</p>
      <div className="stack-sm">
        <Link className="btn primary block" to={`/b/${band.bandId}/band`}>{t("start.openBand")}</Link>
        <button className="btn ghost block" onClick={() => signOut(auth)}>{t("common.signOut")}</button>
      </div>
    </>
  );
}

const PROBLEM: Record<Exclude<SlugProblem, null>, Key> = {
  short: "slug.short",
  bad: "slug.bad",
  reserved: "slug.reserved",
  taken: "slug.taken",
};

/** The fields both forms share: band name, its address (checked live), the plan, the terms. */
function useBandFields(initial?: { bandName?: string; bandId?: string }) {
  const t = useT();
  const [bandName, setBandName] = useState(initial?.bandName || "");
  const [address, setAddress] = useState(initial?.bandId || "");
  const [edited, setEdited] = useState(!!initial?.bandId);
  const [agree, setAgree] = useState(false);
  const [compare, setCompare] = useState(false);
  const [problem, setProblem] = useState<SlugProblem>(null);
  const [checking, setChecking] = useState(false);

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
    const timer = setTimeout(async () => {
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
      clearTimeout(timer);
      setChecking(false);
    };
  }, [address]);

  const ok = bandName.trim().length >= 2 && !!address && !problem && !checking && agree;

  const fields = (
    <>
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
        <span className="label">{t("start.plan")}</span>
        <div className="plans-pick">
          <label className="plan-opt sel">
            <input type="radio" name="plan" checked readOnly />
            <b>{t("plan.free")}</b>
            <small>{t("start.planFreeLine", { users: PLAN_LIMITS.free.users, items: PLAN_LIMITS.free.items, mb: PLAN_LIMITS.free.mb })}</small>
            <small>{t("start.planFreeApproval")}</small>
          </label>
          <label className={`plan-opt ${PAID_CHECKOUT_ENABLED ? "" : "off"}`}>
            <input type="radio" name="plan" disabled={!PAID_CHECKOUT_ENABLED} />
            <b>{t("plan.paid")} · {t("plan.pricePaid", { price: PRICE_PAID })}</b>
            <small>{t("start.planPaidLine", { users: PLAN_LIMITS.paid.users, items: PLAN_LIMITS.paid.items, mb: PLAN_LIMITS.paid.mb })}</small>
            {!PAID_CHECKOUT_ENABLED && <small className="pt-soon">{t("plan.soon")}</small>}
          </label>
        </div>
        <button type="button" className="linkbtn" onClick={() => setCompare(true)}>{t("plan.compare")}</button>
      </div>
      <label className="check">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span>{t("start.agreeBefore")}<Link to="/terms" target="_blank" rel="noopener">{t("start.terms")}</Link>{t("start.agreeAfter")}</span>
      </label>
      {compare && (
        <Sheet title={t("plan.compare")} onClose={() => setCompare(false)}>
          <PlanTable />
          <button className="btn ghost block" onClick={() => setCompare(false)}>{t("common.close")}</button>
        </Sheet>
      )}
    </>
  );
  return { bandName, address, ok, fields };
}

/** /start for someone not signed in: everything in one form. The band email is also the login. */
function SignupForm() {
  const t = useT();
  const f = useBandFields();
  const [person, setPerson] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const ok = f.ok && person.trim().length >= 2 && !!email.trim() && pw.length >= 8;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ok) return;
    setBusy(true);
    setErr("");
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), pw);
      saveDraft({ uid: cred.user.uid, person: person.trim(), bandName: f.bandName.trim(), bandId: f.address });
      await updateProfile(cred.user, { displayName: person.trim() }).catch(() => {});
      // If sending fails the next screen has a "Send again" button, so it is not fatal.
      await sendVerification(cred.user).catch(() => {});
    } catch (x) {
      setErr(errorText(x));
      setBusy(false);
    }
  };

  return card(
    <>
      <Link to="/" className="back">← BandMate</Link>
      <h1>{t("start.title")}</h1>
      <p className="note">{t("start.intro2", { host: PLATFORM_HOST })}</p>
      <form className="stack" onSubmit={submit}>
        <div className="field">
          <label htmlFor="suPerson">{t("start.yourName")}</label>
          <input id="suPerson" required autoComplete="name" value={person} onChange={(e) => setPerson(e.target.value)} />
        </div>
        {f.fields}
        <div className="field">
          <label htmlFor="suEmail">{t("start.bandEmail")}</label>
          <input id="suEmail" type="email" required autoComplete="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="band@example.com" />
          <span className="hint">{t("start.bandEmailHint")}</span>
        </div>
        <div className="field">
          <label htmlFor="suPw">{t("login.password")}</label>
          <input id="suPw" type="password" required autoComplete="new-password" minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} />
          <span className="hint">{t("reg.pwHint")}</span>
        </div>
        {err && <p className="hint err">{err}</p>}
        <button className="btn primary block" disabled={!ok || busy}>{busy ? t("start.sending") : t("start.createAndSend")}</button>
      </form>
      <p className="note center">
        {t("start.haveAccountQ")} <Link to="/start/login">{t("login.signIn")}</Link>
      </p>
    </>
  );
}

/** A signed-in, confirmed account that has no request yet (e.g. confirmed on another device). */
function RequestForm({ user }: { user: User }) {
  const t = useT();
  const [person, setPerson] = useState(user.displayName || "");
  const f = useBandFields();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const ok = f.ok && person.trim().length >= 2;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ok) return;
    setBusy(true);
    setErr("");
    try {
      await fileBandRequest({ uid: user.uid, email: (user.email || "").toLowerCase(), displayName: person.trim(), bandName: f.bandName, bandId: f.address });
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
          {f.fields}
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
