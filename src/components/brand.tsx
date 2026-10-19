import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { PublicSettings, SocialLink } from "../types";
import { QrFull } from "./ui";

export const SOCIAL_TYPES: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
  spotify: "Spotify",
  bandcamp: "Bandcamp",
  website: "Website",
  other: "Link",
};

export function normaliseUrl(u: string) {
  const t = u.trim();
  if (!t) return "";
  return /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`;
}

function useQr(text: string) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!text) return setSrc(null);
    QRCode.toDataURL(text, { margin: 1, width: 360, errorCorrectionLevel: "M", color: { dark: "#111111", light: "#ffffff" } })
      .then(setSrc)
      .catch(() => setSrc(null));
  }, [text]);
  return src;
}

function SocialQr({ link, onOpen }: { link: SocialLink & { label: string; text: string }; onOpen: (src: string, title: string, sub: string) => void }) {
  const src = useQr(link.text);
  if (!src) return null;
  return (
    <button className="social" onClick={() => onOpen(src, link.label, link.url)}>
      <img src={src} alt="" />
      <span>{link.label}</span>
    </button>
  );
}

/** The optional strip of social-media QR codes and email on the fan screen. */
export function TopBar({ settings }: { settings: PublicSettings }) {
  const [open, setOpen] = useState<{ src: string; title: string; sub: string } | null>(null);
  const tb = settings.topBar;
  if (!tb.enabled) return null;
  const links = tb.links
    .filter((l) => l.url.trim())
    .map((l) => ({ ...l, label: SOCIAL_TYPES[l.type] || "Link", text: normaliseUrl(l.url) }));
  if (tb.email.trim()) links.push({ type: "email", url: tb.email.trim(), label: "Email", text: `mailto:${tb.email.trim()}` });
  if (!links.length) return null;
  return (
    <>
      <div className="topbar">
        <div className="topbar-in">
          <span className="topbar-lbl">Follow us</span>
          <div className="topbar-row">
            {links.map((l, i) => (
              <SocialQr key={i} link={l} onOpen={(src, title, sub) => setOpen({ src, title, sub })} />
            ))}
          </div>
          {tb.email.trim() && <span className="topbar-mail">{tb.email.trim()}</span>}
        </div>
      </div>
      {open && <QrFull src={open.src} title={open.title} sub={open.sub} onClose={() => setOpen(null)} />}
    </>
  );
}

export function LogoBackdrop({ settings }: { settings: PublicSettings }) {
  if (!settings.logoUrl || settings.logoOpacity <= 0) return null;
  return <div className="backdrop" style={{ backgroundImage: `url("${settings.logoUrl}")`, opacity: settings.logoOpacity }} aria-hidden="true" />;
}
