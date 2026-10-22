import { Route, Routes, useParams } from "react-router-dom";
import { Navigate } from "./lib/nav";
import { doc } from "firebase/firestore";
import { db, firebaseConfigured } from "./firebase";
import { isPlatformHost, subdomainBandId } from "./lib/host";
import { useLiveDoc } from "./lib/live";
import { AuthProvider } from "./state/auth";
import { SettingsProvider } from "./state/settings";
import { TenantProvider } from "./state/tenant";
import { ToastProvider } from "./state/toast";
import TenantGate from "./components/TenantGate";
import { Loading } from "./components/ui";
import PublicPage from "./pages/PublicPage";
import { Login, Register } from "./pages/AuthPages";
import BandApp from "./pages/band/BandApp";
import PlatformHome from "./pages/platform/PlatformHome";
import PlatformConsole from "./pages/platform/PlatformConsole";

export default function App() {
  if (!firebaseConfigured) {
    return (
      <main className="page">
        <div className="wrap">
          <div className="empty">
            <h3>Firebase isn't connected yet</h3>
            <p>Add the VITE_FIREBASE_* values from your Firebase project to .env.local (or to Vercel's environment variables) and reload. See README step 3.</p>
          </div>
        </div>
      </main>
    );
  }
  // A band's own address (bandname.yourapp.com, its own domain) shows just that band.
  if (!isPlatformHost()) return <HostBand host={window.location.hostname} />;
  // The BandMate address: platform pages, and every band at /b/<bandId>.
  return (
    <Routes>
      <Route path="/b/:bandId/*" element={<PathBand />} />
      <Route path="/*" element={<PlatformApp />} />
    </Routes>
  );
}

/** Wraps a band's pages with everything that is per band: tenant, sign-in, settings. */
function BandShell({ bandId, base }: { bandId: string; base: string }) {
  return (
    <TenantProvider bandId={bandId} base={base}>
      <AuthProvider>
        <SettingsProvider>
          <ToastProvider>
            <TenantGate>
              <BandRoutes />
            </TenantGate>
          </ToastProvider>
        </SettingsProvider>
      </AuthProvider>
    </TenantProvider>
  );
}

function PathBand() {
  const { bandId = "" } = useParams();
  return <BandShell key={bandId} bandId={bandId} base={`/b/${bandId}`} />;
}

function HostBand({ host }: { host: string }) {
  const d = useLiveDoc<{ bandId: string }>(() => doc(db, "domains", host), `domain-${host}`);
  if (!d.ready) return <main className="page"><div className="wrap"><Loading /></div></main>;
  // An address listed in `domains` wins; otherwise <bandId>.bandmate.shop opens that band.
  const bandId = d.data?.bandId || subdomainBandId(host);
  if (!bandId)
    return (
      <main className="page auth">
        <div className="authcard">
          <h1>Address not set up</h1>
          <p className="note">{host} isn't connected to a band on BandMate yet.</p>
        </div>
      </main>
    );
  return <BandShell bandId={bandId} base="" />;
}

function BandRoutes() {
  return (
    <Routes>
      <Route path="/" element={<PublicPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/band/*" element={<BandApp />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function PlatformApp() {
  return (
    <TenantProvider bandId="" base="">
      <AuthProvider>
        <SettingsProvider>
          <ToastProvider>
            <Routes>
              <Route path="/" element={<PlatformHome />} />
              <Route path="/platform/login" element={<Login platform />} />
              <Route path="/platform" element={<PlatformConsole />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ToastProvider>
        </SettingsProvider>
      </AuthProvider>
    </TenantProvider>
  );
}
