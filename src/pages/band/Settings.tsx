import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { EmailAuthProvider, reauthenticateWithCredential, signOut, updatePassword } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "../../firebase";
import { useSettings } from "../../state/settings";
import { ROLE_LABEL, useAuth } from "../../state/auth";
import { useToast } from "../../state/toast";
import { errorText } from "../../lib/format";
import { saveDoc } from "../../lib/ops";
import { removeImage } from "../../lib/images";
import { PRESETS, onColor, themeWarnings } from "../../lib/theme";
import { SOCIAL_TYPES } from "../../components/brand";
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
  const { settings } = useSettings();
  const toast = useToast();
  const [bandName, setBandName] = useState(settings.bandName);
  const [tagline, setTagline] = useState(settings.tagline);
  const [currency, setCurrency] = useState(settings.currency);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save({ bandName: bandName.trim(), tagline: tagline.trim(), currency }, toast, "Band details saved");
  };
  return (
    <section className="card">
      <h2 className="card-h">Band</h2>
      <form className="stack" onSubmit={submit}>
        <div className="field">
          <label htmlFor="sBand">Band name</label>
          <input id="sBand" value={bandName} onChange={(e) => setBandName(e.target.value)} placeholder="Your band" />
        </div>
        <div className="field">
          <label htmlFor="sTag">Line under the name on the fan page</label>
          <input id="sTag" value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Official merch · Autumn tour 2026" />
        </div>
        <div className="field">
          <label htmlFor="sCur">Currency</label>
          <select id="sCur" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="actions">
          <button className="btn primary">Save</button>
          <Link className="btn ghost" to="/" target="_blank" rel="noopener">Open fan page</Link>
        </div>
      </form>
    </section>
  );
}

function LookSection() {
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
      <h2 className="card-h">Look &amp; feel</h2>
      <div className="field">
        <span className="label">Start from a style</span>
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
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="colors">
        {(
          [
            ["primary", "Main colour", "Buttons, prices"],
            ["bg", "Background", "Behind everything"],
            ["surface", "Cards", "Product cards"],
            ["text", "Text", "Most writing"],
          ] as [keyof Theme, string, string][]
        ).map(([k, label, hint]) => (
          <label className="color" key={k} htmlFor={`c-${k}`}>
            <input id={`c-${k}`} type="color" value={theme[k]} onChange={(e) => setColor(k, e.target.value)} />
            <span>
              <b>{label}</b>
              <small>{hint}</small>
            </span>
          </label>
        ))}
      </div>
      {warnings.map((w) => <p key={w} className="hint err">{w}</p>)}
      <div className="actions">
        <button className="btn primary" disabled={!dirty && preset === settings.preset} onClick={() => save({ theme, preset }, toast, "Colours saved")}>Save colours</button>
        {dirty && <button className="btn ghost" onClick={() => { setTheme(settings.theme); setPreset(settings.preset); }}>Undo changes</button>}
      </div>

      <hr />
      <ImageField
        label="Band logo"
        folder="logo"
        wide
        url={settings.logoUrl}
        hint="PNG with a transparent background works best. It appears faintly behind the whole app and next to the band name."
        onChange={(v) => {
          if (settings.logoPath && settings.logoPath !== v?.path) removeImage(settings.logoPath);
          save({ logoUrl: v?.url ?? null, logoPath: v?.path ?? null }, toast, v ? "Logo saved" : "Logo removed");
        }}
      />
      {settings.logoUrl && (
        <>
          <div className="field">
            <label htmlFor="sOpacity">Logo in the background: {Math.round(opacity * 100)}%</label>
            <input
              id="sOpacity"
              type="range"
              min="0"
              max="0.5"
              step="0.02"
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              onPointerUp={() => save({ logoOpacity: opacity }, toast, "Logo strength saved")}
              onKeyUp={() => save({ logoOpacity: opacity }, toast, "Logo strength saved")}
            />
            <span className="hint">0% hides it. Keep it low so product names stay readable.</span>
          </div>
          <Toggle id="sInHeader" checked={inHeader} onChange={(v) => { setInHeader(v); save({ logoInHeader: v }, toast, "Saved"); }} label="Show logo next to the band name" />
        </>
      )}
    </section>
  );
}

function TopBarSection() {
  const { settings } = useSettings();
  const toast = useToast();
  const [enabled, setEnabled] = useState(settings.topBar.enabled);
  const [email, setEmail] = useState(settings.topBar.email);
  const [links, setLinks] = useState<SocialLink[]>(settings.topBar.links.length ? settings.topBar.links : [{ type: "instagram", url: "" }]);
  const setLink = (i: number, p: Partial<SocialLink>) => setLinks((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save({ topBar: { enabled, email: email.trim(), links: links.filter((l) => l.url.trim()).map((l) => ({ type: l.type, url: l.url.trim() })) } }, toast, "Fan screen top bar saved");
  };
  return (
    <section className="card">
      <h2 className="card-h">Fan page top bar</h2>
      <form className="stack" onSubmit={submit}>
        <Toggle id="tbOn" checked={enabled} onChange={setEnabled} label="Show the top bar" hint="A strip of QR codes at the top of the fan page, so fans can follow you and email you." />
        <div className="field">
          <span className="label">Social media links</span>
          {links.map((l, i) => (
            <div className="part social-part" key={i}>
              <select value={l.type} onChange={(e) => setLink(i, { type: e.target.value })} aria-label="Network">
                {Object.entries(SOCIAL_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input value={l.url} onChange={(e) => setLink(i, { url: e.target.value })} placeholder="instagram.com/yourband" aria-label="Link" inputMode="url" />
              <button type="button" className="icon-btn" onClick={() => setLinks((ls) => ls.filter((_, j) => j !== i))} aria-label="Remove link">{Icon.x}</button>
            </div>
          ))}
          <button type="button" className="btn ghost sm" onClick={() => setLinks((ls) => [...ls, { type: "facebook", url: "" }])}>+ Add link</button>
          <span className="hint">A QR code is made from each link automatically.</span>
        </div>
        <div className="field">
          <label htmlFor="tbMail">Email address</label>
          <input id="tbMail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="booking@yourband.com" />
          <span className="hint">Shown as text and as a QR code that opens a new email.</span>
        </div>
        <button className="btn primary block">Save top bar</button>
      </form>
    </section>
  );
}

function AccountSection() {
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
    if (next.length < 8) return setErr("Use a new password of at least 8 characters.");
    setBusy(true);
    setErr("");
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, cur));
      await updatePassword(user, next);
      setCur("");
      setNext("");
      toast("Password changed");
    } catch (x) {
      setErr(errorText(x));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card">
      <h2 className="card-h">Your account</h2>
      <p className="note">
        {user?.email} · {profile ? ROLE_LABEL[profile.role] : ""}
      </p>
      <form
        className="row-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!profile) return;
          updateDoc(doc(db, "users", profile.id), { displayName: name.trim() }).catch((x) => toast(errorText(x)));
          toast("Name saved");
        }}
      >
        <input id="aName" value={name} onChange={(e) => setName(e.target.value)} aria-label="Your name" placeholder="Your name" />
        <button className="btn ghost">Save name</button>
      </form>
      <form className="stack" onSubmit={changePw}>
        <div className="two">
          <div className="field">
            <label htmlFor="aCur">Current password</label>
            <input id="aCur" type="password" autoComplete="current-password" required value={cur} onChange={(e) => setCur(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="aNew">New password</label>
            <input id="aNew" type="password" autoComplete="new-password" required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} />
          </div>
        </div>
        {err && <p className="hint err">{err}</p>}
        <button className="btn ghost block" disabled={busy}>{busy ? "Changing…" : "Change password"}</button>
      </form>
      <button className="btn ghost block" onClick={() => signOut(auth)}>Sign out</button>
    </section>
  );
}
