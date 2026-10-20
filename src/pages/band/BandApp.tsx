import { useState, type FormEvent } from "react";
import { Route, Routes } from "react-router-dom";
import { Link, NavLink, Navigate } from "../../lib/nav";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase";
import { isStaff, useAuth } from "../../state/auth";
import { BandDataProvider, useBand } from "../../state/band";
import { useSettings } from "../../state/settings";
import { useToast } from "../../state/toast";
import { saveDoc } from "../../lib/ops";
import { errorText } from "../../lib/format";
import { LogoBackdrop } from "../../components/brand";
import { Loading, Sheet } from "../../components/ui";
import Sell from "./Sell";
import Stock from "./Stock";
import Bundles from "./Bundles";
import Sales from "./Sales";
import SettingsPage from "./Settings";
import Users from "./Users";
import VerifyEmail from "../VerifyEmail";

export default function BandApp() {
  const { user, profile, ready } = useAuth();
  if (!ready) return <main className="page"><div className="wrap"><Loading text="Signing in…" /></div></main>;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.emailVerified) return <VerifyEmail />;
  if (!profile || !isStaff(profile.role)) return <Waiting />;
  return (
    <BandDataProvider>
      <Layout />
    </BandDataProvider>
  );
}

function Waiting() {
  const { profile, user } = useAuth();
  const disabled = profile?.role === "disabled";
  return (
    <main className="page auth">
      <div className="authcard">
        <h1>{disabled ? "Account disabled" : "Waiting for approval"}</h1>
        <p className="note">
          {disabled
            ? "The admin has switched off this account. Ask them if you think this is a mistake."
            : !profile
            ? "We couldn't load your account. Check your connection and reload the page."
            : `You're signed in as ${user?.email}. The admin needs to approve you as a BandMate before you can open the merch desk. This page opens the desk by itself once you're approved.`}
        </p>
        <div className="stack-sm">
          <Link className="btn ghost block" to="/">See the fan page</Link>
          <button className="btn ghost block" onClick={() => signOut(auth)}>Sign out</button>
        </div>
      </div>
    </main>
  );
}

const TABS = [
  { to: "/band", label: "Sell", end: true, icon: <path d="M3 7h18l-2 12H5zM8 7a4 4 0 0 1 8 0" /> },
  { to: "/band/stock", label: "Stock", icon: <path d="M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8" /> },
  { to: "/band/bundles", label: "Bundles", icon: <path d="M3 8h18v13H3zM3 12h18M12 8v13M12 8c-2-4-6-4-6-1s4 1 6 1c2 0 6 2 6-1s-4-3-6 1" /> },
  { to: "/band/sales", label: "Sales", icon: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /> },
  { to: "/band/settings", label: "Settings", icon: <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4" /> },
];
const USERS_TAB = { to: "/band/users", label: "People", icon: <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7M18 14a6 6 0 0 1 4 7" /> };

function Layout() {
  const { profile } = useAuth();
  const { settings } = useSettings();
  const { band, ready, users } = useBand();
  const [gigOpen, setGigOpen] = useState(false);
  const admin = profile?.role === "admin";
  const pendingCount = users.filter((u) => u.role === "pending").length;
  const tabs = admin ? [...TABS, USERS_TAB] : TABS;

  return (
    <>
      <LogoBackdrop settings={settings} />
      <header className="top">
        <div className="top-in">
          <Link to="/band" className="band">
            {settings.logoInHeader && settings.logoUrl && <img src={settings.logoUrl} alt="" />}
            <span>{settings.bandName || "BandMate"}</span>
          </Link>
          <button className="gig" onClick={() => setGigOpen(true)}>
            <span className="dot" />
            <span>{band.gig ? <b>{band.gig}</b> : "Set tonight's gig"}</span>
          </button>
        </div>
      </header>
      <main className="page with-tabs">
        <div className="wrap">
          {!ready ? (
            <Loading />
          ) : (
            <Routes>
              <Route index element={<Sell />} />
              <Route path="stock" element={<Stock />} />
              <Route path="bundles" element={<Bundles />} />
              <Route path="sales" element={<Sales />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="users" element={admin ? <Users /> : <Navigate to="/band" replace />} />
              <Route path="*" element={<Navigate to="/band" replace />} />
            </Routes>
          )}
        </div>
      </main>
      <nav className="tabs" aria-label="Sections">
        <div className="tabs-in" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
          {tabs.map((t) => (
            <NavLink key={t.to} to={t.to} end={"end" in t} className="tab">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {t.icon}
              </svg>
              {t.label}
              {t === USERS_TAB && pendingCount > 0 && <span className="tab-badge">{pendingCount}</span>}
            </NavLink>
          ))}
        </div>
      </nav>
      {gigOpen && <GigSheet onClose={() => setGigOpen(false)} />}
    </>
  );
}

function GigSheet({ onClose }: { onClose: () => void }) {
  const { band, sales } = useBand();
  const toast = useToast();
  const [gig, setGig] = useState(band.gig);
  const recent = [...new Set(sales.map((s) => s.gig).filter(Boolean))].slice(0, 6);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    saveDoc("settings/band", { gig: gig.trim() }).catch((x) => toast(errorText(x)));
    toast(gig.trim() ? `Selling at ${gig.trim()}` : "Gig cleared");
    onClose();
  };
  return (
    <Sheet title="Tonight's gig" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <div className="field">
          <label htmlFor="gName">Where are you playing?</label>
          <input id="gName" autoFocus value={gig} onChange={(e) => setGig(e.target.value)} placeholder="Košice, Collosseum · 24 Oct" />
          <span className="hint">Every sale is tagged with this, so Sales shows takings per show.</span>
        </div>
        {recent.length > 0 && (
          <div className="sizes">
            {recent.map((g) => (
              <button type="button" key={g} className="btn ghost sm" onClick={() => setGig(g)}>
                {g}
              </button>
            ))}
          </div>
        )}
        <button className="btn primary block">Start selling here</button>
      </form>
    </Sheet>
  );
}
