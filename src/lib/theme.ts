import type { Theme } from "../types";
import { tr, type Key } from "../i18n";

export const PRESETS: Record<string, { label: Key; theme: Theme }> = {
  stage: { label: "theme.stage", theme: { primary: "#FF5A1F", bg: "#121311", surface: "#1D201C", text: "#F1F2EE" } },
  metal: { label: "theme.metal", theme: { primary: "#D01C2B", bg: "#090909", surface: "#171717", text: "#E9E9E9" } },
  punk: { label: "theme.punk", theme: { primary: "#E4006D", bg: "#FFEF3A", surface: "#FFFFFF", text: "#111111" } },
  indie: { label: "theme.indie", theme: { primary: "#2F55A4", bg: "#EEE9DF", surface: "#FFFFFF", text: "#1D2130" } },
  folk: { label: "theme.folk", theme: { primary: "#5E7F2E", bg: "#ECE4D2", surface: "#FAF6EC", text: "#2A291F" } },
  synth: { label: "theme.synth", theme: { primary: "#14D2FF", bg: "#160B2E", surface: "#241543", text: "#F3EEFF" } },
};

function rgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function luminance(hex: string) {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/** Black or white, whichever reads better on the given colour. */
export const onColor = (hex: string) => (contrast(hex, "#111111") >= contrast(hex, "#FFFFFF") ? "#111111" : "#FFFFFF");

export function applyTheme(t: Theme) {
  const s = document.documentElement.style;
  s.setProperty("--bg", t.bg);
  s.setProperty("--surface", t.surface);
  s.setProperty("--text", t.text);
  s.setProperty("--primary", t.primary);
  s.setProperty("--on-primary", onColor(t.primary));
  s.setProperty("color-scheme", luminance(t.bg) < 0.4 ? "dark" : "light");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t.bg);
}

/** Warn when the band's colours make text hard to read. */
export function themeWarnings(t: Theme) {
  const w: string[] = [];
  if (contrast(t.text, t.bg) < 4.5) w.push(tr("theme.warnBg"));
  if (contrast(t.text, t.surface) < 4.5) w.push(tr("theme.warnCards"));
  return w;
}
