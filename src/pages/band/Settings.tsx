import { useEffect, useState, type FormEvent } from "react";
import { Link } from "../../lib/nav";
import { EmailAuthProvider, reauthenticateWithCredential, signOut, updatePassword } from "firebase/auth";
import { setDoc } from "firebase/firestore";
import { auth } from "../../firebase";
import { bandDoc } from "../../lib/scope";
import { useSettings } from "../../state/settings";
import { roleLabel, useAuth } from "../../state/auth";
import { useToast } from "../../state/toast";
import { errorText } from "../../lib/format";
import { saveDoc } from "../../lib/ops";
import { removeImage } from "../../lib/images";
import { PRESETS, onColor, themeWarnings } from "../../lib/theme";
import { SOCIAL_TYPE_IDS, socialLabel } from "../../components/brand";
import LangSwitch from "../../components/LangSwitch";
import { useT, type Key } from "../../i18n";
import { Icon, ImageField, Toggle } from "../../components/ui";
import type { PublicSettings, SocialLink, Theme } from "../../types";

const CURRENCIES = ["€", "Kč", "zł", "Ft", "£", "$", "kr", "CHF"];

export default function SettingsPage() {
  return (
    <div className="flow">
      <BandSection />
      <LookSection />
      <TopBarSection />
      <AccountSection />
    </div>
  );
}

function save(data: Partial<PublicSettings>, toast: (m: string) => void, msg: string) {
  saveDoc("settings/public", data).catch((e) => toast(errorText(e)));
  toast(msg);
}

function BandSection() {
  const t = useT();
  const { settings } = useSettings();
  const toast = useToast();
  const [bandName, setBandName] = useState(settings.bandName);
  const [tagline, setTagline] = useState(settings.tagline);
  const [currency, setCurrency] = useState(settings.currency);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save({ bandName: bandName.trim(), tagline: tagline.trim(), currency }, toast, t("set.bandSaved"));
  };
  return (
    <section className="card">
      <h2 className="card-h">{t("set.band")}</h2>
      <form className="stack" onSubmit={submit}>
        <div className="field">
          <label htmlFor="sBand">{t("set.bandName")}</label>
          <input id="sBand" value={bandName} onChange={(e) => setBandName(e.target.value)} placeholder={t("set.bandNamePh")} />
        </div>
        <div className="field">
          <label htmlFor="sTag">{t("set.tagline")}</label>
          <input id="sTag" value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder={t("set.taglinePh")} />
        </div>
        <div className="field">
          <label htmlFor="sCur">{t("set.currency")}</label>
          <select id="sCur" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="actions">
          <button className="btn primary">{t("common.save")}</button>
          <Link className="btn ghost" to="/" target="_blank" rel="noopener">{t("set.openFan")}</Link>
        </div>
      </form>
    </section>
  );
}

function LookSection() {
  const t = useT();
  const { settings, previewTheme } = useSettings();
  const toast = useToast();
  const [preset, setPreset] = useState(settings.preset);
  const [theme, setTheme] = useState<Theme>(settings.theme);
  const [opacity, setOpacity] = useState(settings.logoOpacity);
  const [inHeader, setInHeader] = useState(settings.logoInHeader);
  const dirty = JSON.stringify(theme) !== JSON.stringify(settings.theme);

  // Show the colours live while editing; go back to the saved ones when leaving.
  useEffect(() => {
    previewTheme(dirty ? theme : null);
  }, [theme, dirty]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => previewTheme(null), []); // eslint-disable-line react-hooks/exhaustive-deps

  const warnings = themeWarnings(theme);
  const setColor = (k: keyof Theme, v: string) => {
    setTheme((t) => ({ ...t, [k]: v }));
    setPreset("custom");
  };

  return (
    <section className="card">
      <h2 className="card-h">{t("set.look")}</h2>
      <div className="field">
        <span className="label">{t("set.startStyle")}</span>
        <div className="presets">
          {Object.entries(PRESETS).map(([k, p]) => (
            <button
              key={k}
              type="button"
              className={`preset ${preset === k ? "sel" : ""}`}
              style={{ background: p.theme.bg, color: p.theme.text, borderColor: preset === k ? p.theme.primary : undefined }}
              onClick={() => {
                setPreset(k);
                setTheme(p.theme);
              }}
            >
              <i style={{ background: p.theme.primary, color: onColor(p.theme.primary) }}>Aa</i>
              {t(p.label)}
            </button>
          ))}
        </div>
      </div>
      <div className="colors">
        {(
          [
            ["primary", "set.cPrimary", "set.cPrimaryHint"],
            ["bg", "set.cBg", "set.cBgHint"],
            ["surface", "set.cSurface", "set.cSurfaceHint"],
            ["text", "set.cText", "set.cTextHint"],
          ] as [keyof Theme, Key, Key][]
        ).map(([k, label, hint]) => (
          <label className="color" key={k} htmlFor={`c-${k}`}>
            <input id={`c-${k}`} type="color" value={theme[k]} onChange={(e) => setColor(k, e.target.value)} />
            <span>
              <b>{t(label)}</b>
              <small>{t(hint)}</small>
            </span>
          </label>
        ))}
      </div>
      {warnings.map((w) => <p key={w} className="hint err">{w}</p>)}
      <div className="actions">
        <button className="btn primary" disabled={!dirty && preset === settings.preset} onClick={() => save({ theme, preset }, toast, t("set.coloursSaved"))}>{t("set.saveColours")}</button>
        {dirty && <button className="btn ghost" onClick={() => { setTheme(settings.theme); setPreset(settings.preset); }}>{t("set.undoChanges")}</button>}
      </div>

      <hr />
      <ImageField
        label={t("set.logo")}
        folder="logo"
        wide
        url={settings.logoUrl}
        hint={t("set.logoHint")}
        onChange={(v) => {
          if (settings.logoPath && settings.logoPath !== v?.path) removeImage(settings.logoPath);
          save({ logoUrl: v?.url ?? null, logoPath: v?.path ?? null }, toast, v ? t("set.logoSaved") : t("set.logoRemoved"));
        }}
      />
      {settings.logoUrl && (
        <>
          <div className="field">
            <label htmlFor="sOpacity">{t("set.logoOpacity", { pct: Math.round(opacity * 100) })}</label>
            <input
              id="sOpacity"
              type="range"
              min="0"
              max="0.5"
              step="0.02"
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              onPointerUp={() => save({ logoOpacity: opacity }, toast, t("set.logoStrengthSaved"))}
              onKeyUp={() => save({ logoOpacity: opacity }, toast, t("set.logoStrengthSaved"))}
            />
            <span className="hint">{t("set.logoOpacityHint")}</span>
          </div>
          <Toggle id="sInHeader" checked={inHeader} onChange={(v) => { setInHeader(v); save({ logoInHeader: v }, toast, t("set.saved")); }} label={t("set.showLogoHeader")} />
        </>
      )}
    </section>
  );
}

function TopBarSection() {
  const t = useT();
  const { settings } = useSettings();
  const toast = useToast();
  const [enabled, setEnabled] = useState(settings.topBar.enabled);
  const [email, setEmail] = useState(settings.topBar.email);
  const [links, setLinks] = useState<SocialLink[]>(settings.topBar.links.length ? settings.topBar.links : [{ type: "instagram", url: "" }]);
  const setLink = (i: number, p: Partial<SocialLink>) => setLinks((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save({ topBar: { enabled, email: email.trim(), links: links.filter((l) => l.url.trim()).map((l) => ({ type: l.type, url: l.url.trim() })) } }, toast, t("set.topbarSaved"));
  };
  return (
    <section className="card">
      <h2 className="card-h">{t("set.topbar")}</h2>
      <form className="stack" onSubmit={submit}>
        <Toggle id="tbOn" checked={enabled} onChange={setEnabled} label={t("set.tbShow")} hint={t("set.tbShowHint")} />
        <div className="field">
          <span className="label">{t("set.social")}</span>
          {links.map((l, i) => (
            <div className="part social-part" key={i}>
              <select value={l.type} onChange={(e) => setLink(i, { type: e.target.value })} aria-label={t("set.network")}>
                {SOCIAL_TYPE_IDS.map((k) => <option key={k} value={k}>{socialLabel(k)}</option>)}
              </select>
              <input value={l.url} onChange={(e) => setLink(i, { url: e.target.value })} placeholder={t("set.linkPh")} aria-label={t("set.linkAria")} inputMode="url" />
              <button type="button" className="icon-btn" onClick={() => setLinks((ls) => ls.filter((_, j) => j !== i))} aria-label={t("set.removeLink")}>{Icon.x}</button>
            </div>
          ))}
          <button type="button" className="btn ghost sm" onClick={() => setLinks((ls) => [...ls, { type: "facebook", url: "" }])}>{t("set.addLink")}</button>
          <span className="hint">{t("set.qrAuto")}</span>
        </div>
        <div className="field">
          <label htmlFor="tbMail">{t("set.email")}</label>
          <input id="tbMail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("set.emailPh")} />
          <span className="hint">{t("set.emailHint")}</span>
        </div>
        <button className="btn primary block">{t("set.saveTopbar")}</button>
      </form>
    </section>
  );
}

function AccountSection() {
  const t = useT();
  const { profile, user } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(profile?.displayName ?? "");
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const changePw = async (e: FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;
    if (next.length < 8) return setErr(t("set.newPwShort"));
    setBusy(true);
    setErr("");
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, cur));
      await updatePassword(user, next);
      setCur("");
      setNext("");
      toast(t("set.pwChanged"));
    } catch (x) {
      setErr(errorText(x));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card">
      <h2 className="card-h">{t("set.account")}</h2>
      <p className="note">
        {user?.email} · {profile ? roleLabel(profile.role) : ""}
      </p>
      <div className="field">
        <span className="label">{t("set.language")}</span>
        <div><LangSwitch /></div>
      </div>
      <form
        className="row-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!profile) return;
          setDoc(bandDoc("members", profile.id), { displayName: name.trim() }, { merge: true }).catch((x) => toast(errorText(x)));
          toast(t("set.nameSaved"));
        }}
      >
        <input id="aName" value={name} onChange={(e) => setName(e.target.value)} aria-label={t("set.namePh")} placeholder={t("set.namePh")} />
        <button className="btn ghost">{t("set.saveName")}</button>
      </form>
      <form className="stack" onSubmit={changePw}>
        <div className="two">
          <div className="field">
            <label htmlFor="aCur">{t("set.curPw")}</label>
            <input id="aCur" type="password" autoComplete="current-password" required value={cur} onChange={(e) => setCur(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="aNew">{t("set.newPw")}</label>
            <input id="aNew" type="password" autoComplete="new-password" required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} />
          </div>
        </div>
        {err && <p className="hint err">{err}</p>}
        <button className="btn ghost block" disabled={busy}>{busy ? t("set.changing") : t("set.changePw")}</button>
      </form>
      <button className="btn ghost block" onClick={() => signOut(auth)}>{t("common.signOut")}</button>
    </section>
  );
}
