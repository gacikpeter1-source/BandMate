import { Link } from "../../lib/nav";
import { TERMS_VERSION } from "../../lib/platform";

/** PLACEHOLDER text. Have it reviewed and replaced before real customers sign up, and change
 *  TERMS_VERSION (src/lib/platform.ts) whenever it changes, so each request records what was agreed to. */
export default function TermsPage() {
  return (
    <main className="page">
      <div className="wrap">
        <Link to="/start" className="back">← Back</Link>
        <h1>Terms of service</h1>
        <p className="note">Version {TERMS_VERSION}. Draft text, to be replaced by the final terms.</p>
        <section className="card">
          <h2 className="card-h">The service</h2>
          <p>BandMate gives each band its own merch page: a product list with photos, stock counts, a sales desk for your team, and payment QR codes you upload yourself.</p>
        </section>
        <section className="card">
          <h2 className="card-h">Your account and team</h2>
          <p>You are responsible for the people you approve to your team and for keeping your login private. Everyone must confirm their email address.</p>
        </section>
        <section className="card">
          <h2 className="card-h">Payments</h2>
          <p>Customers pay the band directly using the payment QR codes the band uploads. BandMate does not take part in those payments and is not responsible for them.</p>
        </section>
        <section className="card">
          <h2 className="card-h">Your content</h2>
          <p>You own your photos, texts and product data and are responsible for having the right to use them. Do not upload anything unlawful or misleading.</p>
        </section>
        <section className="card">
          <h2 className="card-h">Data</h2>
          <p>We store your band's data (products, stock, sales, team members' names and email addresses) to run the service. Your band's data is separated from other bands' data.</p>
        </section>
        <section className="card">
          <h2 className="card-h">Availability, changes and ending</h2>
          <p>We aim to keep the service running but cannot promise it will never be interrupted. Pricing and these terms may change with notice. Either side may end the service; we can pause a band page that breaks these terms.</p>
        </section>
      </div>
    </main>
  );
}
