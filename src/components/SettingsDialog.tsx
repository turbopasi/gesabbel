import { useEffect, useState } from "react";
import {
  COLOR_FIELDS,
  DARK_COLORS,
  FONT_OPTIONS,
  LIGHT_COLORS,
  SHORTCUT_ACTIONS,
  THEME_OPTIONS,
  eventToCombo,
  formatCombo,
  type AppSettings,
  type ThemeId,
} from "../settings";
import { useStore } from "../store";

type Tab = "appearance" | "editor" | "layout" | "shortcuts";

const TABS: { id: Tab; label: string }[] = [
  { id: "appearance", label: "Darstellung" },
  { id: "editor", label: "Editor" },
  { id: "layout", label: "Layout" },
  { id: "shortcuts", label: "Tastaturkürzel" },
];

export function SettingsOverlay() {
  const open = useStore((s) => s.settingsOpen);
  if (!open) return null;
  return <SettingsDialog />;
}

function SettingsDialog() {
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const [tab, setTab] = useState<Tab>("appearance");

  return (
    <div className="quicknav-overlay" onMouseDown={() => setSettingsOpen(false)}>
      <div className="history settings-dialog" onMouseDown={(e) => e.stopPropagation()}>
        <div className="history-header">
          <strong>Einstellungen</strong>
          <span className="spacer" />
          <button onClick={() => setSettingsOpen(false)}>Schließen</button>
        </div>
        <div className="settings-body">
          <nav className="settings-tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={tab === t.id ? "on" : ""}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <div className="settings-content">
            {tab === "appearance" && <AppearanceTab />}
            {tab === "editor" && <EditorTab />}
            {tab === "layout" && <LayoutTab />}
            {tab === "shortcuts" && <ShortcutsTab />}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Kleine Helfer: aktuelle Einstellungen + Patch-Funktion. */
function useSettings() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  return { settings, updateSettings };
}

// ---------------------------------------------------------------------------
// Darstellung
// ---------------------------------------------------------------------------

function AppearanceTab() {
  const { settings, updateSettings } = useSettings();

  const pickTheme = (theme: ThemeId) => updateSettings({ theme });

  return (
    <>
      <h3>Theme</h3>
      <div className="theme-grid">
        {THEME_OPTIONS.map((t) => (
          <button
            key={t.id}
            className={settings.theme === t.id ? "on" : ""}
            onClick={() => pickTheme(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {settings.theme === "custom" && <CustomThemeEditor />}
    </>
  );
}

function CustomThemeEditor() {
  const { settings, updateSettings } = useSettings();

  const setColor = (key: keyof AppSettings["customTheme"], value: string) =>
    updateSettings({ customTheme: { ...settings.customTheme, [key]: value } });

  return (
    <fieldset className="export-template">
      <legend>Eigenes Theme</legend>
      <div className="row" style={{ justifyContent: "flex-start" }}>
        <button onClick={() => updateSettings({ customTheme: { ...LIGHT_COLORS } })}>
          Von Hell übernehmen
        </button>
        <button onClick={() => updateSettings({ customTheme: { ...DARK_COLORS } })}>
          Von Dunkel übernehmen
        </button>
      </div>
      {COLOR_FIELDS.map((f) => (
        <label key={f.key} className="settings-row">
          <span>{f.label}</span>
          <input
            type="color"
            value={settings.customTheme[f.key]}
            onChange={(e) => setColor(f.key, e.target.value)}
          />
          <code className="muted small">{settings.customTheme[f.key]}</code>
        </label>
      ))}
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

function EditorTab() {
  const { settings, updateSettings } = useSettings();
  const ed = settings.editor;
  const patch = (p: Partial<AppSettings["editor"]>) =>
    updateSettings({ editor: { ...ed, ...p } });

  return (
    <>
      <h3>Schreib-Editor</h3>
      <label className="settings-row">
        <span>Schriftart</span>
        <select value={ed.fontFamily} onChange={(e) => patch({ fontFamily: e.target.value })}>
          {FONT_OPTIONS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </label>
      <label className="settings-row">
        <span>Schriftgröße</span>
        <input
          type="number"
          min={12}
          max={28}
          value={ed.fontSize}
          onChange={(e) => patch({ fontSize: clamp(e.target.valueAsNumber, 12, 28, 17) })}
        />
        <span className="muted small">px</span>
      </label>
      <label className="settings-row">
        <span>Zeilenabstand</span>
        <input
          type="number"
          min={1.2}
          max={2.6}
          step={0.1}
          value={ed.lineHeight}
          onChange={(e) => patch({ lineHeight: clamp(e.target.valueAsNumber, 1.2, 2.6, 1.7) })}
        />
      </label>
      <label className="settings-row">
        <span>Textbreite</span>
        <input
          type="number"
          min={28}
          max={80}
          value={ed.textWidth}
          onChange={(e) => patch({ textWidth: clamp(e.target.valueAsNumber, 28, 80, 48) })}
        />
        <span className="muted small">rem (≈ Zeichen pro Zeile × 0,6)</span>
      </label>
      <label className="settings-row">
        <span>Cursor-Stil</span>
        <select
          value={ed.cursorStyle}
          onChange={(e) => patch({ cursorStyle: e.target.value as "standard" | "accent" })}
        >
          <option value="standard">Standard (Textfarbe)</option>
          <option value="accent">Akzentfarbe</option>
        </select>
      </label>
      <p className="muted small">
        Diese Einstellungen wirken auf den Schreib-Editor und die Notizen — nicht auf den
        Export (dort gelten die Formatierungsvorlagen).
      </p>
    </>
  );
}

function clamp(v: number, min: number, max: number, fallback: number): number {
  if (Number.isNaN(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

function LayoutTab() {
  const { settings, updateSettings } = useSettings();
  const lay = settings.layout;
  const patch = (p: Partial<AppSettings["layout"]>) =>
    updateSettings({ layout: { ...lay, ...p } });

  return (
    <>
      <h3>Panels</h3>
      <label className="settings-row">
        <input
          type="checkbox"
          checked={lay.binderVisible}
          onChange={(e) => patch({ binderVisible: e.target.checked })}
        />
        <span>Binder (Kapitel-/Szenenliste) anzeigen</span>
      </label>
      <label className="settings-row">
        <span>Binder-Position</span>
        <select
          value={lay.binderPosition}
          onChange={(e) => patch({ binderPosition: e.target.value as "left" | "right" })}
        >
          <option value="left">Links</option>
          <option value="right">Rechts</option>
        </select>
      </label>
      <label className="settings-row">
        <span>Binder-Breite</span>
        <input
          type="number"
          min={160}
          max={500}
          value={lay.binderWidth}
          onChange={(e) => patch({ binderWidth: clamp(e.target.valueAsNumber, 160, 500, 250) })}
        />
        <span className="muted small">px — auch per Ziehen am Trennsteg verstellbar</span>
      </label>
    </>
  );
}

// ---------------------------------------------------------------------------
// Tastaturkürzel
// ---------------------------------------------------------------------------

function ShortcutsTab() {
  const { settings, updateSettings } = useSettings();
  /** Aktion, für die gerade ein neues Kürzel aufgenommen wird. */
  const [recording, setRecording] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);

  useEffect(() => {
    if (!recording) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setRecording(null);
        return;
      }
      const combo = eventToCombo(e);
      if (!combo) return; // reine Modifier-Taste — weiter warten
      const s = useStore.getState().settings;
      const taken = SHORTCUT_ACTIONS.find(
        (a) => a.id !== recording && s.shortcuts[a.id] === combo,
      );
      if (taken) {
        setConflict(`${formatCombo(combo)} ist bereits mit „${taken.label}“ belegt.`);
        return;
      }
      updateSettings({ shortcuts: { ...s.shortcuts, [recording]: combo } });
      setConflict(null);
      setRecording(null);
    };
    // capture: true, damit die globalen App-Shortcuts nicht mitfeuern.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [recording, updateSettings]);

  const reset = (id: string) => {
    const def = SHORTCUT_ACTIONS.find((a) => a.id === id)!.default;
    updateSettings({ shortcuts: { ...settings.shortcuts, [id]: def } });
    setConflict(null);
  };

  return (
    <>
      <h3>Tastaturkürzel</h3>
      {conflict && <p className="shortcut-conflict">{conflict}</p>}
      <table className="shortcut-table">
        <tbody>
          {SHORTCUT_ACTIONS.map((a) => {
            const combo = settings.shortcuts[a.id] ?? a.default;
            const isRecording = recording === a.id;
            return (
              <tr key={a.id}>
                <td>{a.label}</td>
                <td>
                  {isRecording ? (
                    <em className="muted">Taste drücken … (Esc bricht ab)</em>
                  ) : (
                    <kbd>{formatCombo(combo)}</kbd>
                  )}
                </td>
                <td className="shortcut-actions">
                  <button
                    onClick={() => {
                      setConflict(null);
                      setRecording(isRecording ? null : a.id);
                    }}
                  >
                    {isRecording ? "Abbrechen" : "Ändern"}
                  </button>
                  {combo !== a.default && (
                    <button onClick={() => reset(a.id)}>Zurücksetzen</button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="muted small">
        Kürzel gelten app-weit. Innerhalb des Editors haben Textbefehle (z. B. Strg+B für
        Fett) Vorrang.
      </p>
    </>
  );
}
