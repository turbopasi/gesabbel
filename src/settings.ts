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
}

export interface EditorSettings {
  fontFamily: string;
  /** Schriftgröße in px. */
  fontSize: number;
  lineHeight: number;
  /** Maximale Textbreite in rem. */
  textWidth: number;
  cursorStyle: "standard" | "accent";
}

export interface LayoutSettings {
  binderVisible: boolean;
  /** Binder-Breite in px (auch per Drag am Trennsteg verstellbar). */
  binderWidth: number;
  binderPosition: "left" | "right";
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

export const THEME_OPTIONS: { id: ThemeId; label: string }[] = [
  { id: "system", label: "System" },
  { id: "light", label: "Hell" },
  { id: "dark", label: "Dunkel" },
  { id: "sepia", label: "Sepia" },
  { id: "midnight", label: "Mitternacht" },
  { id: "custom", label: "Eigenes Theme" },
];

/** Helles Standard-Theme — dient auch als Ausgangspunkt für eigene Themes. */
export const LIGHT_COLORS: ThemeColors = {
  bg: "#f6f6f6",
  text: "#1a1a1a",
  panel: "#ececec",
  border: "#d5d5d5",
  accent: "#4a6da7",
  accentText: "#ffffff",
  card: "#fffdf5",
};

export const DARK_COLORS: ThemeColors = {
  bg: "#1e1e1e",
  text: "#f0f0f0",
  panel: "#252526",
  border: "#3a3a3a",
  accent: "#5d84c4",
  accentText: "#ffffff",
  card: "#2d2d2d",
};

export const COLOR_FIELDS: { key: keyof ThemeColors; label: string }[] = [
  { key: "bg", label: "Hintergrund" },
  { key: "text", label: "Text" },
  { key: "panel", label: "Leisten & Seitenbereiche" },
  { key: "border", label: "Rahmen & Trennlinien" },
  { key: "accent", label: "Akzentfarbe" },
  { key: "accentText", label: "Text auf Akzentfarbe" },
  { key: "card", label: "Karteikarten" },
];

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

export const FONT_OPTIONS: { label: string; value: string }[] = [
  { label: "Georgia (Serife)", value: 'Georgia, "Times New Roman", serif' },
  { label: "Times New Roman", value: '"Times New Roman", Times, serif' },
  { label: "Garamond", value: 'Garamond, "EB Garamond", Georgia, serif' },
  { label: "Serifenlos (System)", value: 'system-ui, "Segoe UI", Roboto, sans-serif' },
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
  { id: "toggleSplit", label: "Split-Ansicht umschalten", default: "Ctrl+Shift+S" },
  { id: "toggleBinder", label: "Binder ein-/ausblenden", default: "Ctrl+Shift+B" },
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
      fontSize: 17,
      lineHeight: 1.7,
      textWidth: 48,
      cursorStyle: "standard",
    },
    layout: { binderVisible: true, binderWidth: 250, binderPosition: "left" },
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

const COLOR_VARS: Record<keyof ThemeColors, string> = {
  bg: "--bg",
  text: "--text",
  panel: "--panel",
  border: "--border",
  accent: "--accent",
  accentText: "--accent-text",
  card: "--card",
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

  root.style.setProperty("--editor-font", s.editor.fontFamily);
  root.style.setProperty("--editor-size", `${s.editor.fontSize}px`);
  root.style.setProperty("--editor-lineheight", String(s.editor.lineHeight));
  root.style.setProperty("--editor-width", `${s.editor.textWidth}rem`);
  root.style.setProperty(
    "--caret",
    s.editor.cursorStyle === "accent" ? "var(--accent)" : "currentColor",
  );
  root.style.setProperty("--binder-width", `${s.layout.binderWidth}px`);
}
