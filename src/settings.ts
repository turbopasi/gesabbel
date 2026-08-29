// Zentrale App-Einstellungen (Phase 7): Schema, Defaults, Themes, Shortcuts.
// Persistiert werden sie app-weit über das Rust-Backend (settings.json im
// App-Config-Verzeichnis) — siehe src-tauri/src/settings.rs.

export type ThemeId = "system" | "light" | "dark" | "sepia" | "midnight" | "custom";

export interface ThemeColors {
  bg: string;
  text: string;
  panel: string;
  border: string;
  accent: string;
  accentText: string;
  card: string;
  /** Markierungsfarbe des Autors: Textauswahl, Fundstellen, Hervorhebungen.
   *  Bewusst getrennt vom Akzent — der Akzent gehört der App, das hier dem
   *  Schreibenden. */
  highlight: string;
}

export interface EditorSettings {
  fontFamily: string;
  /** Schriftgröße in px. */
  fontSize: number;
  lineHeight: number;
  /** Maximale Textbreite in rem. */
  textWidth: number;
  cursorStyle: "standard" | "accent";
  /** Grundausrichtung aller Absätze ohne explizite Ausrichtung. */
  defaultAlignment: "left" | "justify";
  /** Automatische Silbentrennung (wichtig für sauberen Blocksatz). */
  hyphenation: boolean;
}

export interface LayoutSettings {
  binderVisible: boolean;
  /** Binder-Breite in px (auch per Drag am Trennsteg verstellbar). */
  binderWidth: number;
  binderPosition: "left" | "right";
  /** Planungsleiste (Personen/Orte/Notizen/Module) — zweite Sidebar neben dem
   *  Binder. Schlüssel heißen weiter research*, damit gespeicherte
   *  Einstellungen bestehender Projekte gültig bleiben. */
  researchVisible: boolean;
  researchWidth: number;
  researchPosition: "left" | "right";
}

export interface AppSettings {
  theme: ThemeId;
  customTheme: ThemeColors;
  editor: EditorSettings;
  layout: LayoutSettings;
  /** Aktions-ID → Kürzel (kanonisch, z. B. "Ctrl+Shift+F"). "" = kein Kürzel. */
  shortcuts: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Themes
// ---------------------------------------------------------------------------

/** `preview` speist die drei Farbpunkte auf den Theme-Knöpfen: Fläche, Papier,
 *  Akzent — genau die drei Töne, an denen man ein Theme wiedererkennt. */
export const THEME_OPTIONS: { id: ThemeId; label: string; preview: [string, string, string] }[] = [
  { id: "system", label: "System", preview: ["#faf6ef", "#141310", "#2f5d50"] },
  { id: "light", label: "Papier", preview: ["#faf6ef", "#fffdf9", "#2f5d50"] },
  { id: "dark", label: "Nachtpapier", preview: ["#141310", "#1b1a16", "#3e7566"] },
  { id: "sepia", label: "Sepia", preview: ["#f0e7d5", "#fdf8ec", "#7e561f"] },
  { id: "midnight", label: "Mitternacht", preview: ["#0f1420", "#1a2235", "#5f89c9"] },
  { id: "custom", label: "Eigenes Theme", preview: ["#faf6ef", "#fffdf9", "#b07d34"] },
];

/** Helles Standard-Theme („Papier") — zugleich Ausgangspunkt für eigene Themes.
 *  Die Werte müssen mit :root[data-theme="light"] in styles/tokens.css
 *  übereinstimmen; von hier aus werden sie beim Übernehmen kopiert. */
export const LIGHT_COLORS: ThemeColors = {
  bg: "#faf6ef",
  text: "#2a2620",
  panel: "#f2ede3",
  border: "#dcd3c3",
  accent: "#2f5d50",
  accentText: "#fffdf9",
  card: "#fffdf9",
  highlight: "#b07d34",
};

export const DARK_COLORS: ThemeColors = {
  bg: "#141310",
  text: "#e4ded1",
  panel: "#1b1a16",
  border: "#2e2c26",
  accent: "#3e7566",
  accentText: "#f5f0e6",
  card: "#1b1a16",
  highlight: "#d8b378",
};

export const COLOR_FIELDS: { key: keyof ThemeColors; label: string }[] = [
  { key: "bg", label: "Hintergrund" },
  { key: "text", label: "Text" },
  { key: "panel", label: "Leisten & Seitenbereiche" },
  { key: "border", label: "Rahmen & Trennlinien" },
  { key: "accent", label: "Akzentfarbe" },
  { key: "accentText", label: "Text auf Akzentfarbe" },
  { key: "card", label: "Karten & Manuskriptseite" },
  { key: "highlight", label: "Markierungen & Fundstellen" },
];

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

export const FONT_OPTIONS: { label: string; value: string }[] = [
  // Literata, IBM Plex Sans und IBM Plex Mono liegen lokal in public/fonts.
  { label: "Literata (Serife)", value: '"Literata", Charter, Georgia, serif' },
  { label: "Georgia (Serife)", value: 'Georgia, "Times New Roman", serif' },
  { label: "Times New Roman", value: '"Times New Roman", Times, serif' },
  { label: "Garamond", value: 'Garamond, "EB Garamond", Georgia, serif' },
  { label: "IBM Plex Sans (serifenlos)", value: '"IBM Plex Sans", "Segoe UI", sans-serif' },
  { label: "Serifenlos (System)", value: 'system-ui, "Segoe UI", Roboto, sans-serif' },
  { label: "IBM Plex Mono", value: '"IBM Plex Mono", ui-monospace, monospace' },
  { label: "Schreibmaschine (Monospace)", value: '"Courier New", ui-monospace, monospace' },
];

// ---------------------------------------------------------------------------
// Tastaturkürzel
// ---------------------------------------------------------------------------

export interface ShortcutAction {
  id: string;
  label: string;
  default: string;
}

export const SHORTCUT_ACTIONS: ShortcutAction[] = [
  { id: "focusMode", label: "Fokusmodus umschalten", default: "Ctrl+Shift+F" },
  { id: "quickNav", label: "Schnellnavigation", default: "Ctrl+K" },
  { id: "toggleSplit", label: "Split-Layout wechseln", default: "Ctrl+Shift+S" },
  { id: "toggleBinder", label: "Binder ein-/ausblenden", default: "Ctrl+Shift+B" },
  { id: "toggleResearchSidebar", label: "Planungsleiste ein-/ausblenden", default: "Ctrl+Shift+R" },
  { id: "snapshot", label: "Sicherungspunkt setzen", default: "Ctrl+S" },
  { id: "export", label: "Export-Dialog öffnen", default: "Ctrl+Shift+E" },
  { id: "settings", label: "Einstellungen öffnen", default: "Ctrl+," },
];

/** Baut aus einem KeyboardEvent das kanonische Kürzel ("Ctrl+Shift+F") — oder null. */
export function eventToCombo(e: KeyboardEvent): string | null {
  const key = normalizeKey(e);
  if (!key) return null;
  const parts: string[] = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  parts.push(key);
  return parts.join("+");
}

function normalizeKey(e: KeyboardEvent): string | null {
  // Reine Modifier-Tasten sind kein Kürzel.
  if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return null;
  // e.code ist layoutunabhängig für Buchstaben/Ziffern ("KeyF" → "F").
  if (/^Key[A-Z]$/.test(e.code)) return e.code.slice(3);
  if (/^Digit[0-9]$/.test(e.code)) return e.code.slice(5);
  if (/^F([1-9]|1[0-2])$/.test(e.key)) return e.key;
  if (e.key === " ") return "Space";
  if (e.key.length === 1) return e.key === "," ? "," : e.key.toUpperCase();
  return e.key; // "Enter", "Tab", "ArrowUp", …
}

/** Anzeige mit deutschen Modifier-Namen ("Strg+Umschalt+F"). */
export function formatCombo(combo: string): string {
  if (!combo) return "—";
  return combo
    .split("+")
    .map((p) => (p === "Ctrl" ? "Strg" : p === "Shift" ? "Umschalt" : p === "Space" ? "Leertaste" : p))
    .join("+");
}

// ---------------------------------------------------------------------------
// Defaults, Merge, Anwendung
// ---------------------------------------------------------------------------

export function defaultSettings(): AppSettings {
  return {
    theme: "system",
    customTheme: { ...LIGHT_COLORS },
    editor: {
      fontFamily: FONT_OPTIONS[0].value,
      // 18px auf ~34em Satzbreite: das Maß, bei dem eine Zeile in einem Blick
      // erfasst wird, ohne dass das Auge am Zeilenende zurückspringen muss.
      fontSize: 18,
      lineHeight: 1.75,
      textWidth: 38,
      cursorStyle: "standard",
      defaultAlignment: "left",
      hyphenation: true,
    },
    layout: {
      binderVisible: true,
      binderWidth: 250,
      binderPosition: "left",
      researchVisible: false,
      researchWidth: 250,
      researchPosition: "right",
    },
    shortcuts: Object.fromEntries(SHORTCUT_ACTIONS.map((a) => [a.id, a.default])),
  };
}

/** Geladenes JSON (unbekannter Herkunft) defensiv über die Defaults legen. */
export function mergeSettings(loaded: unknown): AppSettings {
  const d = defaultSettings();
  if (!loaded || typeof loaded !== "object") return d;
  const l = loaded as Partial<AppSettings>;
  return {
    theme: THEME_OPTIONS.some((t) => t.id === l.theme) ? (l.theme as ThemeId) : d.theme,
    customTheme: { ...d.customTheme, ...(l.customTheme ?? {}) },
    editor: { ...d.editor, ...(l.editor ?? {}) },
    layout: { ...d.layout, ...(l.layout ?? {}) },
    // Defaults zuerst: neue Aktionen bekommen ihr Standard-Kürzel.
    shortcuts: { ...d.shortcuts, ...(l.shortcuts ?? {}) },
  };
}

/** Wahrgenommene Helligkeit eines #rrggbb-Werts — reicht, um „hell oder
 *  dunkel?" zu entscheiden. */
function isDark(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
}

const COLOR_VARS: Record<keyof ThemeColors, string> = {
  bg: "--bg",
  text: "--text",
  panel: "--panel",
  border: "--border",
  accent: "--accent",
  accentText: "--accent-text",
  card: "--card",
  highlight: "--highlight",
};

/** Überträgt die Einstellungen auf CSS-Variablen bzw. das data-theme-Attribut. */
export function applySettings(s: AppSettings) {
  const root = document.documentElement;

  if (s.theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", s.theme);

  // Eigenes Theme: Farben inline setzen; sonst Inline-Overrides entfernen,
  // damit die Stylesheet-Themes greifen.
  for (const key of Object.keys(COLOR_VARS) as (keyof ThemeColors)[]) {
    if (s.theme === "custom") root.style.setProperty(COLOR_VARS[key], s.customTheme[key]);
    else root.style.removeProperty(COLOR_VARS[key]);
  }

  // Nur bei eigenen Themes muss die App raten, ob sie hell oder dunkel ist:
  // Betriebssystem-Elemente (Auswahllisten, Bildlaufleisten, Farbwähler)
  // richten sich nach color-scheme, nicht nach unseren Variablen.
  if (s.theme === "custom") {
    root.style.setProperty("--scheme", isDark(s.customTheme.bg) ? "dark" : "light");
  } else {
    root.style.removeProperty("--scheme");
  }

  root.style.setProperty("--editor-font", s.editor.fontFamily);
  root.style.setProperty("--editor-size", `${s.editor.fontSize}px`);
  root.style.setProperty("--editor-lineheight", String(s.editor.lineHeight));
  root.style.setProperty("--editor-width", `${s.editor.textWidth}rem`);
  root.style.setProperty(
    "--caret",
    s.editor.cursorStyle === "accent" ? "var(--accent)" : "currentColor",
  );
  root.style.setProperty("--editor-align", s.editor.defaultAlignment);
  root.style.setProperty("--editor-hyphens", s.editor.hyphenation ? "auto" : "manual");
  root.style.setProperty("--binder-width", `${s.layout.binderWidth}px`);
  root.style.setProperty("--research-width", `${s.layout.researchWidth}px`);
}
