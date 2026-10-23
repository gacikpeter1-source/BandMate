import type { ReactNode } from "react";
import { useT } from "../i18n";
import { useAuth } from "../state/auth";
import { useTenant } from "../state/tenant";
import { Loading } from "./ui";
import LangSwitch from "./LangSwitch";

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <main className="page auth">
      <div className="authcard">
        <div className="card-top"><span /><LangSwitch /></div>
        <h1>{title}</h1>
        <p className="note">{text}</p>
      </div>
    </main>
  );
}

/** Stops everything below it for an address with no band, or a paused band (BandMate admin still gets in). */
export default function TenantGate({ children }: { children: ReactNode }) {
  const t = useT();
  const { band, ready } = useTenant();
  const { isPlatform, ready: authReady } = useAuth();
  if (!ready || !authReady) return <main className="page"><div className="wrap"><Loading /></div></main>;
  if (!band) return <Notice title={t("gate.notFoundTitle")} text={t("gate.notFoundText")} />;
  if (band.status !== "active" && !isPlatform) return <Notice title={t("gate.pausedTitle")} text={t("gate.pausedText")} />;
  return <>{children}</>;
}
