import { Link } from "../../lib/nav";
import { TERMS_VERSION } from "../../lib/platform";
import { useT, type Key } from "../../i18n";
import LangSwitch from "../../components/LangSwitch";

const SECTIONS: [Key, Key][] = [
  ["terms.serviceH", "terms.serviceT"],
  ["terms.accountH", "terms.accountT"],
  ["terms.paymentsH", "terms.paymentsT"],
  ["terms.contentH", "terms.contentT"],
  ["terms.dataH", "terms.dataT"],
  ["terms.endH", "terms.endT"],
];

/** PLACEHOLDER text (src/i18n/en.ts + sk.ts, keys terms.*). Have it reviewed and replaced before real customers
 *  sign up, and change TERMS_VERSION (src/lib/platform.ts) whenever it changes, so each request records
 *  what was agreed to. */
export default function TermsPage() {
  const t = useT();
  return (
    <main className="page">
      <div className="wrap">
        <div className="card-top">
          <Link to="/start" className="back">{t("terms.back")}</Link>
          <LangSwitch />
        </div>
        <h1>{t("terms.title")}</h1>
        <p className="note">{t("terms.version", { v: TERMS_VERSION })}</p>
        {SECTIONS.map(([h, body]) => (
          <section className="card" key={h}>
            <h2 className="card-h">{t(h)}</h2>
            <p>{t(body)}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
