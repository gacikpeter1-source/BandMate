import { useEffect, useRef, useState, type ReactNode } from "react";
import { uploadImage } from "../lib/images";
import { errorText } from "../lib/format";

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
          <button className="icon-btn" onClick={onClose} aria-label="Close">
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
    <button className="qrfull" onClick={onClose} aria-label="Close QR code">
      <span className="qrfull-title">{title}</span>
      {sub && <span className="qrfull-sub">{sub}</span>}
      {src ? (
        <img src={src} alt={`Payment QR code for ${title}`} />
      ) : (
        <span className="qrfull-none">Pay at the merch table</span>
      )}
      <span className="qrfull-hint">{src ? "Scan with your banking or payment app" : ""}</span>
      <span className="qrfull-close">Tap anywhere to close</span>
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
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="field">
      <span className="label">{label}</span>
      <div className="imgfield">
        <div className={`prev ${wide ? "wide" : ""} ${folder === "qr" ? "qr" : ""}`}>
          {busy ? "Uploading…" : url ? <img src={url} alt="" /> : "No picture yet"}
        </div>
        <div className="stack-sm">
          <label className="btn ghost sm filebtn">
            {url ? "Replace picture" : "Upload picture"}
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
              Remove
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

export function Loading({ text = "Opening the merch box…" }: { text?: string }) {
  return (
    <div className="empty">
      <h3>{text}</h3>
    </div>
  );
}
