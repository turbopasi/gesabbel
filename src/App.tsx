import { useEffect, type MouseEvent as ReactMouseEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useStore, type PaneId } from "./store";
import { eventToCombo, SHORTCUT_ACTIONS } from "./settings";
import { StartScreen } from "./components/StartScreen";
import { Binder } from "./components/Binder";
import { RichEditor } from "./components/RichEditor";
import { Corkboard } from "./components/Corkboard";
import { QuickNav } from "./components/QuickNav";
import { Research } from "./components/Research";
import { HistoryOverlay } from "./components/HistoryPanel";
import { ExportOverlay } from "./components/ExportDialog";
import { SettingsOverlay } from "./components/SettingsDialog";
import "./App.css";

function App() {
  const project = useStore((s) => s.project);
  const focusMode = useStore((s) => s.focusMode);
  const error = useStore((s) => s.error);
  const clearError = useStore((s) => s.clearError);

  // Externe Änderungen beim Fokussieren prüfen; beim Defokussieren speichern.
  useEffect(() => {
    const unlisten = getCurrentWindow().onFocusChanged(({ payload: focused }) => {
      const s = useStore.getState();
      if (focused) void s.checkExternalChanges();
      else void s.flushAll();
    });
    return () => {
      void unlisten.then((f) => f());
    };
  }, []);

  // Gespeicherte Einstellungen (Theme, Editor, Layout, Kürzel) einmalig laden.
  useEffect(() => {
    void useStore.getState().initSettings();
  }, []);

  // Globale Shortcuts — Belegung kommt aus den Einstellungen (Phase 7).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState();
      if (e.key === "Escape") {
        if (s.settingsOpen) s.setSettingsOpen(false);
        else if (s.exportOpen) s.setExportOpen(false);
        else if (s.historyFor) s.setHistoryFor(null);
        else if (s.quickNavOpen) s.setQuickNavOpen(false);
        else if (s.focusMode) s.setFocusMode(false);
        return;
      }
      // Bereits verarbeitete Events (z. B. Editor-Befehle) nicht doppelt auslösen.
      if (e.defaultPrevented) return;
      const combo = eventToCombo(e);
      if (!combo) return;
      // Kürzel ohne Strg/Alt nicht beim Tippen in Feldern auslösen.
      if (!e.ctrlKey && !e.altKey && isTypingTarget(e.target)) return;
      const actionId = SHORTCUT_ACTIONS.find((a) => s.settings.shortcuts[a.id] === combo)?.id;
      if (!actionId) return;

      const actions: Record<string, () => void> = {
        focusMode: () => s.toggleFocusMode(),
        quickNav: () => {
          if (s.project) s.setQuickNavOpen(!s.quickNavOpen);
        },
        toggleSplit: () => {
          if (s.project && s.view === "write") void s.toggleSplit();
        },
        toggleBinder: () =>
          s.updateSettings({
            layout: { ...s.settings.layout, binderVisible: !s.settings.layout.binderVisible },
          }),
        snapshot: () => {
          if (s.project) void s.takeSnapshot("Manueller Sicherungspunkt");
        },
        export: () => {
          if (s.project) s.setExportOpen(true);
        },
        settings: () => s.setSettingsOpen(!s.settingsOpen),
      };
      e.preventDefault();
      actions[actionId]?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Ebene C: automatischer Sicherungspunkt alle 10 Minuten (Backend
  // committet nur, wenn sich seit dem letzten tatsächlich etwas geändert hat).
  useEffect(() => {
    const timer = setInterval(() => void useStore.getState().takeSnapshot(), 10 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={`app ${focusMode ? "focus-mode" : ""}`}>
      {error && (
        <div className="banner error">
          <span>{error}</span>
          <button onClick={clearError}>OK</button>
        </div>
      )}
      <ConflictBanner paneId="left" />
      <ConflictBanner paneId="right" />
      <ExternalChangesBanner />
      <QuickNav />
      <HistoryOverlay />
      <ExportOverlay />
      <SettingsOverlay />
      {project ? (
        <MainView />
      ) : (
        <>
          <StartScreen />
          <button
            className="settings-float"
            title="Einstellungen (Strg+,)"
            onClick={() => useStore.getState().setSettingsOpen(true)}
          >
            ⚙ Einstellungen
          </button>
        </>
      )}
    </div>
  );
}

/** true, wenn das Event aus einem Eingabefeld/Editor stammt. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  );
}

function MainView() {
  const project = useStore((s) => s.project)!;
  const splitOpen = useStore((s) => s.splitOpen);
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const closeProject = useStore((s) => s.closeProject);
  const toggleSplit = useStore((s) => s.toggleSplit);
  const toggleFocusMode = useStore((s) => s.toggleFocusMode);
  const takeSnapshot = useStore((s) => s.takeSnapshot);
  const snapshotNotice = useStore((s) => s.snapshotNotice);
  const setExportOpen = useStore((s) => s.setExportOpen);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const binderVisible = useStore((s) => s.settings.layout.binderVisible);
  const binderPosition = useStore((s) => s.settings.layout.binderPosition);
  const updateSettings = useStore((s) => s.updateSettings);

  const toggleBinder = () => {
    const lay = useStore.getState().settings.layout;
    updateSettings({ layout: { ...lay, binderVisible: !lay.binderVisible } });
  };

  return (
    <div className="main-layout">
      <header className="titlebar">
        <span className="project-title">{project.meta.title}</span>
        <span className="muted small">{project.root}</span>
        <button
          className={view === "research" ? "on" : ""}
          title="Personen, Orte, Notizen, Zeitstrahl"
          onClick={() => setView(view === "research" ? "write" : "research")}
        >
          Recherche
        </button>
        {view === "write" && (
          <>
            <button
              className={binderVisible ? "on" : ""}
              title="Binder ein-/ausblenden"
              onClick={toggleBinder}
            >
              Binder
            </button>
            <button className={splitOpen ? "on" : ""} onClick={() => void toggleSplit()}>
              Split
            </button>
            <button title="Fokusmodus" onClick={toggleFocusMode}>
              Fokus
            </button>
          </>
        )}
        <button
          title="Manuskript als DOCX, PDF, ePub, Markdown oder Text exportieren"
          onClick={() => setExportOpen(true)}
        >
          Exportieren
        </button>
        {snapshotNotice && <span className="small snapshot-notice">{snapshotNotice}</span>}
        <button
          title="Aktuellen Stand des ganzen Projekts im Verlauf sichern"
          onClick={() => void takeSnapshot("Manueller Sicherungspunkt")}
        >
          Sicherungspunkt
        </button>
        <button title="Einstellungen (Strg+,)" onClick={() => setSettingsOpen(true)}>
          ⚙
        </button>
        <button onClick={() => void closeProject()}>Projekt schließen</button>
      </header>
      {view === "research" ? (
        <Research />
      ) : (
        <div className="panes">
          {binderVisible && binderPosition === "left" && (
            <>
              <Binder />
              <BinderResizer side="left" />
            </>
          )}
          <PaneView paneId="left" />
          {splitOpen && <PaneView paneId="right" />}
          {binderVisible && binderPosition === "right" && (
            <>
              <BinderResizer side="right" />
              <Binder />
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Trennsteg zum Verstellen der Binder-Breite per Drag. */
function BinderResizer({ side }: { side: "left" | "right" }) {
  const onMouseDown = (e: ReactMouseEvent) => {
    e.preventDefault();
    const move = (ev: MouseEvent) => {
      const raw = side === "left" ? ev.clientX : window.innerWidth - ev.clientX;
      const width = Math.min(500, Math.max(160, Math.round(raw)));
      const s = useStore.getState();
      s.updateSettings({ layout: { ...s.settings.layout, binderWidth: width } });
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };
  return <div className="pane-resizer" onMouseDown={onMouseDown} />;
}

/** Zeigt je nach Pane-Zustand Corkboard (Kapitel gewählt) oder Editor. */
function PaneView({ paneId }: { paneId: PaneId }) {
  const corkboardId = useStore((s) => s.panes[paneId].corkboardId);
  const isActive = useStore((s) => s.activePane === paneId && s.splitOpen);
  const setActivePane = useStore((s) => s.setActivePane);

  if (corkboardId) {
    return (
      <section
        className={`editor ${isActive ? "pane-active" : ""}`}
        onMouseDownCapture={() => setActivePane(paneId)}
      >
        <Corkboard chapterId={corkboardId} />
      </section>
    );
  }
  return <RichEditor paneId={paneId} />;
}

/** Szene in diesem Pane wurde extern verändert, während lokal ungespeicherte Änderungen bestehen. */
function ConflictBanner({ paneId }: { paneId: PaneId }) {
  const saveState = useStore((s) => s.panes[paneId].saveState);
  const splitOpen = useStore((s) => s.splitOpen);
  const resolveConflict = useStore((s) => s.resolveConflict);
  if (saveState !== "conflict") return null;

  const where = splitOpen ? (paneId === "left" ? " (linker Editor)" : " (rechter Editor)") : "";
  return (
    <div className="banner warning">
      <span>
        Diese Szene{where} wurde außerhalb der App verändert (z. B. durch Sync). Wie möchtest
        du fortfahren?
      </span>
      <button onClick={() => void resolveConflict(paneId, "reload")}>
        Externe Version laden (eigene Änderungen verwerfen)
      </button>
      <button onClick={() => void resolveConflict(paneId, "overwrite")}>
        Eigene Version behalten (extern überschreiben)
      </button>
    </div>
  );
}

/** Projektdateien wurden extern verändert (ohne lokalen Schreibkonflikt). */
function ExternalChangesBanner() {
  const externalChanges = useStore((s) => s.externalChanges);
  const anyConflict = useStore(
    (s) => s.panes.left.saveState === "conflict" || s.panes.right.saveState === "conflict",
  );
  const reloadProject = useStore((s) => s.reloadProject);
  if (externalChanges.length === 0 || anyConflict) return null;

  return (
    <div className="banner warning">
      <span>
        {externalChanges.length === 1
          ? `Eine Projektdatei wurde außerhalb der App verändert (${externalChanges[0]}).`
          : `${externalChanges.length} Projektdateien wurden außerhalb der App verändert.`}
      </span>
      <button onClick={() => void reloadProject()}>Projekt neu laden</button>
    </div>
  );
}

export default App;
