import { useEffect, useRef, useState, type ReactNode } from "react";
import { uploadImage } from "../lib/images";
import { errorText } from "../lib/format";
import { useT } from "../i18n";
import type { Photo } from "../types";

export const Icon = {
  x: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  ),
  edit: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20h4L19 9l-4-4L4 16z" />
    </svg>
  ),
  eyeOff: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 9 4.5 10 6-.4.7-1.4 2-2.8 3.3M6.3 7.6C4.4 8.9 2.9 10.8 2 12c1 1.5 5 6 10 6 1.4 0 2.7-.3 3.9-.9" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  ),
};

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const t = useT();
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    document.body.classList.add("locked");
    return () => {
      document.removeEventListener("keydown", k);
      document.body.classList.remove("locked");
    };
  }, [onClose]);
  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="grab" />
        <div className="sheet-h">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={t("common.close")}>
            {Icon.x}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Full-screen white QR so a fan's phone camera can read it under stage lights. */
export function QrFull({ src, title, sub, onClose }: { src: string | null; title: string; sub?: string; onClose: () => void }) {
  const t = useT();
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    let lock: WakeLockSentinel | null = null;
    navigator.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => {});
    return () => {
      document.removeEventListener("keydown", k);
      lock?.release().catch(() => {});
    };
  }, [onClose]);
  return (
    <button className="qrfull" onClick={onClose} aria-label={t("qr.closeAria")}>
      <span className="qrfull-title">{title}</span>
      {sub && <span className="qrfull-sub">{sub}</span>}
      {src ? (
        <img src={src} alt={t("qr.alt", { title })} />
      ) : (
        <span className="qrfull-none">{t("qr.payAtTable")}</span>
      )}
      <span className="qrfull-hint">{src ? t("qr.scan") : ""}</span>
      <span className="qrfull-close">{t("qr.tapClose")}</span>
    </button>
  );
}

export function ImageField({
  label,
  hint,
  url,
  folder,
  onChange,
  wide,
}: {
  label: string;
  hint?: string;
  url: string | null;
  folder: "qr" | "logo";
  onChange: (v: { url: string; path: string } | null) => void;
  wide?: boolean;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="field">
      <span className="label">{label}</span>
      <div className="imgfield">
        <div className={`prev ${wide ? "wide" : ""} ${folder === "qr" ? "qr" : ""}`}>
          {busy ? t("img.uploading") : url ? <img src={url} alt="" /> : t("img.none")}
        </div>
        <div className="stack-sm">
          <label className="btn ghost sm filebtn">
            {url ? t("img.replace") : t("img.upload")}
            <input
              ref={input}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              disabled={busy}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setBusy(true);
                setErr("");
                try {
                  onChange(await uploadImage(f, folder));
                } catch (x) {
                  setErr(errorText(x));
                } finally {
                  setBusy(false);
                  if (input.current) input.current.value = "";
                }
              }}
            />
          </label>
          {url && !busy && (
            <button type="button" className="btn ghost sm" onClick={() => onChange(null)}>
              {t("common.remove")}
            </button>
          )}
        </div>
      </div>
      {err ? <span className="hint err">{err}</span> : hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function Toggle({ id, checked, onChange, label, hint }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="toggle" htmlFor={id}>
      <span>
        <b>{label}</b>
        {hint && <small>{hint}</small>}
      </span>
      <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <i aria-hidden="true" />
    </label>
  );
}

/** Button that needs a second tap within 4 s, for deletes. */
export function ConfirmButton({ children, confirmText, onConfirm, className = "btn danger block" }: { children: ReactNode; confirmText: string; onConfirm: () => void; className?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(t);
  }, [armed]);
  return (
    <button type="button" className={`${className} ${armed ? "arm" : ""}`} onClick={() => (armed ? onConfirm() : setArmed(true))}>
      {armed ? confirmText : children}
    </button>
  );
}

export function Loading({ text }: { text?: string }) {
  const t = useT();
  return (
    <div className="empty">
      <h3>{text ?? t("common.loading")}</h3>
    </div>
  );
}


/** Several product photos: add, remove, and pick which one is shown first. */
export function PhotosField({
  label,
  hint,
  photos,
  onChange,
  max = 6,
}: {
  label: string;
  hint?: string;
  photos: Photo[];
  onChange: (v: Photo[]) => void;
  max?: number;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const room = max - photos.length;

  const add = async (files: File[]) => {
    setBusy(true);
    setErr("");
    const added: Photo[] = [];
    try {
      for (const f of files.slice(0, Math.max(0, room))) added.push(await uploadImage(f, "photos"));
      if (files.length > room) setErr(t("photos.limit", { max, n: Math.max(0, room) }));
    } catch (x) {
      setErr(errorText(x));
    } finally {
      if (added.length) onChange([...photos, ...added]);
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="field">
      <span className="label">{label}</span>
      <div className="photos">
        {photos.map((p, i) => (
          <div className="ph" key={p.url}>
            <img src={p.url} alt="" />
            <button type="button" className="ph-x" onClick={() => onChange(photos.filter((_, j) => j !== i))} aria-label={t("photos.removeAria", { n: i + 1 })}>
              {Icon.x}
            </button>
            {i === 0 ? (
              <span className="ph-main">{t("photos.main")}</span>
            ) : (
              <button type="button" className="ph-make" onClick={() => onChange([p, ...photos.filter((_, j) => j !== i)])}>
                {t("photos.makeMain")}
              </button>
            )}
          </div>
        ))}
        {room > 0 && (
          <label className={`ph add filebtn ${busy ? "busy" : ""}`}>
            <span>{busy ? t("img.uploading") : t("photos.add")}</span>
            <input
              ref={input}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/gif"
              disabled={busy}
              onChange={(e) => {
                const f = Array.from(e.target.files || []);
                if (f.length) add(f);
              }}
            />
          </label>
        )}
      </div>
      {err ? <span className="hint err">{err}</span> : hint && <span className="hint">{hint}</span>}
    </div>
  );
}

/** Swipeable photo strip (CSS scroll-snap) with dots, like a shop page. */
export function PhotoCarousel({ photos, alt, onOpen }: { photos: Photo[]; alt: string; onOpen?: (index: number) => void }) {
  const t = useT();
  const [i, setI] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const go = (d: number) => {
    const t = track.current;
    if (t) t.scrollBy({ left: d * t.clientWidth, behavior: "smooth" });
  };
  return (
    <div className="carousel">
      <div className="car-track" ref={track} onScroll={(e) => setI(Math.round(e.currentTarget.scrollLeft / (e.currentTarget.clientWidth || 1)))}>
        {photos.map((p, n) => (
          <button type="button" key={p.url} className="car-slide" onClick={() => onOpen?.(n)} aria-label={t("photos.slideAria", { alt, i: n + 1, total: photos.length })}>
            <img src={p.url} alt="" loading={n === 0 ? "eager" : "lazy"} draggable={false} />
          </button>
        ))}
      </div>
      {photos.length > 1 && (
        <>
          <button type="button" className="car-arrow prev" onClick={() => go(-1)} aria-label={t("photos.prev")} hidden={i === 0}>‹</button>
          <button type="button" className="car-arrow next" onClick={() => go(1)} aria-label={t("photos.next")} hidden={i >= photos.length - 1}>›</button>
          <div className="car-dots" aria-hidden="true">
            {photos.map((_, n) => <i key={n} className={n === i ? "on" : ""} />)}
          </div>
        </>
      )}
    </div>
  );
}

/** Full-screen photo viewer: swipe between photos, tap the cross or press Esc to close. */
export function PhotoViewer({ photos, start, title, onClose }: { photos: Photo[]; start: number; title: string; onClose: () => void }) {
  const t = useT();
  const track = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(start);
  useEffect(() => {
    const t = track.current;
    if (t) t.scrollLeft = start * t.clientWidth;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    document.body.classList.add("locked");
    return () => {
      document.removeEventListener("keydown", k);
      document.body.classList.remove("locked");
    };
  }, [start, onClose]);
  return (
    <div className="viewer" role="dialog" aria-label={title}>
      <div className="viewer-bar">
        <span>{title}{photos.length > 1 ? ` · ${i + 1}/${photos.length}` : ""}</span>
        <button type="button" className="icon-btn" onClick={onClose} aria-label={t("common.close")}>{Icon.x}</button>
      </div>
      <div className="viewer-track" ref={track} onScroll={(e) => setI(Math.round(e.currentTarget.scrollLeft / (e.currentTarget.clientWidth || 1)))}>
        {photos.map((p) => (
          <div className="viewer-slide" key={p.url} onClick={onClose}>
            <img src={p.url} alt="" />
          </div>
        ))}
      </div>
    </div>
  );
}
