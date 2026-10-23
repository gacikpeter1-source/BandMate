import { LANGS, useLang } from "../i18n";

/** Small EN | SK switch. Put it top-right of any screen. */
export default function LangSwitch() {
  const { lang, setLang, t } = useLang();
  return (
    <div className="lang" role="group" aria-label={t("lang.aria")}>
      {LANGS.map((l) => (
        <button key={l.id} type="button" aria-pressed={lang === l.id} lang={l.id} title={l.name} onClick={() => setLang(l.id)}>
          {l.label}
        </button>
      ))}
    </div>
  );
}
