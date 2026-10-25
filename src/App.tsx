import { Route, Routes, useParams } from "react-router-dom";
import { Navigate } from "./lib/nav";
import { doc } from "firebase/firestore";
import { db, firebaseConfigured } from "./firebase";
import { isPlatformHost, subdomainBandId } from "./lib/host";
import { useLiveDoc } from "./lib/live";
import { AuthProvider } from "./state/auth";
import { SettingsProvider } from "./state/settings";
import { TenantProvider } from "./state/tenant";
import { useT } from "./i18n";
import LangSwitch from "./components/LangSwitch";
import { ToastProvider } from "./state/toast";
import TenantGate from "./components/TenantGate";
import { Loading } from "./components/ui";
import PublicPage from "./pages/PublicPage";
import { Login } from "./pages/AuthPages";
import Accept from "./pages/band/Accept";
import BandApp from "./pages/band/BandApp";
import PlatformHome from "./pages/platform/PlatformHome";
import PlatformConsole from "./pages/platform/PlatformConsole";
import StartPage from "./pages/platform/StartPage";
import TermsPage from "./pages/platform/TermsPage";

export default function App() {
  const t = useT();
  if (!firebaseConfigured) {
    return (
      <main className="page">
        <div className="wrap">
          <div className="empty">
            <h3>{t("setup.title")}</h3>
            <p>{t("setup.text")}</p>
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
  const t = useT();
  const d = useLiveDoc<{ bandId: string }>(() => doc(db, "domains", host), `domain-${host}`);
  if (!d.ready) return <main className="page"><div className="wrap"><Loading /></div></main>;
  // An address listed in `domains` wins; otherwise <bandId>.bandmate.shop opens that band.
  const bandId = d.data?.bandId || subdomainBandId(host);
  if (!bandId)
    return (
      <main className="page auth">
        <div className="authcard">
          <div className="card-top"><span /><LangSwitch /></div>
          <h1>{t("host.title")}</h1>
          <p className="note">{t("host.text", { host })}</p>
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
      <Route path="/accept" element={<Accept />} />
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
              <Route path="/start" element={<StartPage />} />
              <Route path="/start/login" element={<Login variant="customer" />} />
              <Route path="/start/register" element={<Navigate to="/start" replace />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/platform/login" element={<Login variant="operator" />} />
              <Route path="/platform" element={<PlatformConsole />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ToastProvider>
        </SettingsProvider>
      </AuthProvider>
    </TenantProvider>
  );
}
