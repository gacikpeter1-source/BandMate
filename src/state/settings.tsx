import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { doc } from "firebase/firestore";
import { db } from "../firebase";
import { useLiveDoc } from "../lib/live";
import { PRESETS, applyTheme } from "../lib/theme";
import type { PublicSettings, Theme } from "../types";

export const DEFAULT_SETTINGS: PublicSettings = {
  bandName: "",
  tagline: "",
  currency: "€",
  preset: "stage",
  theme: PRESETS.stage.theme,
  logoUrl: null,
  logoPath: null,
  logoOpacity: 0.12,
  logoInHeader: true,
  topBar: { enabled: false, email: "", links: [] },
};

interface SettingsState {
  settings: PublicSettings;
  ready: boolean;
  /** Temporarily show colours while editing them; null goes back to the saved ones. */
  previewTheme: (t: Theme | null) => void;
}

const Ctx = createContext<SettingsState>({ settings: DEFAULT_SETTINGS, ready: false, previewTheme: () => {} });

export function SettingsProvider({ children }: { children: ReactNode }) {
  const live = useLiveDoc<Partial<PublicSettings>>(() => doc(db, "settings", "public"), "settings-public");
  const [preview, setPreview] = useState<Theme | null>(null);
  const d = live.data || {};
  const settings: PublicSettings = {
    ...DEFAULT_SETTINGS,
    ...d,
    theme: { ...DEFAULT_SETTINGS.theme, ...(d.theme || {}) },
    topBar: { ...DEFAULT_SETTINGS.topBar, ...(d.topBar || {}) },
  };
  const t = preview || settings.theme;
  const themeKey = `${t.primary}${t.bg}${t.surface}${t.text}`;

  useEffect(() => applyTheme(t), [themeKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    document.title = settings.bandName ? `${settings.bandName} · Merch` : "BandMate";
  }, [settings.bandName]);

  return <Ctx.Provider value={{ settings, ready: live.ready, previewTheme: setPreview }}>{children}</Ctx.Provider>;
}

export const useSettings = () => useContext(Ctx);
