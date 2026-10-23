// Translations. Pages call `const t = useT()` and `t("key", { name })`; code outside React uses `tr(...)`.
// The language is the visitor's choice (saved on the device), else Slovak if their browser prefers Slovak,
// else English. Adding a language later = a new file next to sk.ts plus one line in DICT/LANGS.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { auth } from "../firebase";
import { en, type Key } from "./en";
import { sk } from "./sk";

export type Lang = "en" | "sk";
export type { Key };
export type Vars = Record<string, string | number>;

export const LANGS: { id: Lang; label: string; name: string }[] = [
  { id: "en", label: "EN", name: "English" },
  { id: "sk", label: "SK", name: "Slovenčina" },
];
const DICT: Record<Lang, Record<Key, string>> = { en, sk };
const STORE = "bandmate-lang";

function detect(): Lang {
  try {
    const saved = localStorage.getItem(STORE);
    if (saved === "en" || saved === "sk") return saved;
  } catch {
    /* private mode: fall through to the browser's own preference */
  }
  const prefs = (navigator.languages?.length ? navigator.languages : [navigator.language]).map((l) => (l || "").toLowerCase());
  for (const l of prefs) {
    if (l.startsWith("sk")) return "sk";
    if (l.startsWith("en")) return "en";
  }
  return "en";
}

let current: Lang = detect();

/** "one|other" (English) or "one|few|many" (Slovak: 1 | 2-4 | 5+ and 0) chosen by the count `n`. */
function pick(msg: string, n: number | undefined, lang: Lang) {
  if (n === undefined || !msg.includes("|")) return msg;
  const forms = msg.split("|");
  const i = lang === "sk" ? (n === 1 ? 0 : n >= 2 && n <= 4 ? 1 : 2) : n === 1 ? 0 : 1;
  return forms[Math.min(i, forms.length - 1)];
}

export function tr(key: Key, vars?: Vars, lang: Lang = current): string {
  const msg = pick(DICT[lang][key] ?? en[key], typeof vars?.n === "number" ? vars.n : undefined, lang);
  return vars ? msg.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? "")) : msg;
}

export const currentLang = () => current;
/** Locale for dates and numbers in the current language. */
export const currentLocale = () => (current === "sk" ? "sk-SK" : "en-GB");

interface LangState {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: Key, vars?: Vars) => string;
}
const Ctx = createContext<LangState>({ lang: "en", setLang: () => {}, t: (k, v) => tr(k, v, "en") });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(current);
  current = lang; // before children render, so helpers outside React use the same language
  useEffect(() => {
    document.documentElement.lang = lang;
    auth.languageCode = lang; // Firebase's confirmation / reset emails follow the same language
  }, [lang]);
  const setLang = useCallback((l: Lang) => {
    try {
      localStorage.setItem(STORE, l);
    } catch {
      /* not saved, still applies for this visit */
    }
    setLangState(l);
  }, []);
  const t = useCallback((key: Key, vars?: Vars) => tr(key, vars, lang), [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useT = () => useContext(Ctx).t;
export const useLang = () => useContext(Ctx);
