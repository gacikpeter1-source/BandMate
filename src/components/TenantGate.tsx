import type { ReactNode } from "react";
import { useAuth } from "../state/auth";
import { useTenant } from "../state/tenant";
import { Loading } from "./ui";

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <main className="page auth">
      <div className="authcard">
        <h1>{title}</h1>
        <p className="note">{text}</p>
      </div>
    </main>
  );
}

/** Stops everything below it for an address with no band, or a paused band (BandMate admin still gets in). */
export default function TenantGate({ children }: { children: ReactNode }) {
  const { band, ready } = useTenant();
  const { isPlatform, ready: authReady } = useAuth();
  if (!ready || !authReady) return <main className="page"><div className="wrap"><Loading /></div></main>;
  if (!band) return <Notice title="Band not found" text="This address isn't set up on BandMate. Check the link you were given." />;
  if (band.status !== "active" && !isPlatform) return <Notice title="Temporarily closed" text="This merch page is paused for now. Please check back later." />;
  return <>{children}</>;
}
