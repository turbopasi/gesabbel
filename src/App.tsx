import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useStore, type PaneId } from "./store";
import { StartScreen } from "./components/StartScreen";
import { Binder } from "./components/Binder";
import { RichEditor } from "./components/RichEditor";
import { Corkboard } from "./components/Corkboard";
import { QuickNav } from "./components/QuickNav";
import { Research } from "./components/Research";
import { HistoryOverlay } from "./components/HistoryPanel";
import { ExportOverlay } from "./components/ExportDialog";
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

  // Globale Shortcuts: Strg+Umschalt+F Fokusmodus, Esc beendet ihn.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState();
      if (e.ctrlKey && e.shiftKey && e.code === "KeyF") {
        e.preventDefault();
        s.toggleFocusMode();
      } else if (e.ctrlKey && !e.shiftKey && e.code === "KeyK") {
        e.preventDefault();
        if (s.project) s.setQuickNavOpen(!s.quickNavOpen);
      } else if (e.key === "Escape" && s.exportOpen) {
        s.setExportOpen(false);
      } else if (e.key === "Escape" && s.historyFor) {
        s.setHistoryFor(null);
      } else if (e.key === "Escape" && s.quickNavOpen) {
        s.setQuickNavOpen(false);
      } else if (e.key === "Escape" && s.focusMode) {
        s.setFocusMode(false);
      }
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
      {project ? <MainView /> : <StartScreen />}
    </div>
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
            <button className={splitOpen ? "on" : ""} onClick={() => void toggleSplit()}>
              Split
            </button>
            <button title="Fokusmodus (Strg+Umschalt+F)" onClick={toggleFocusMode}>
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
        <button onClick={() => void closeProject()}>Projekt schließen</button>
      </header>
      {view === "research" ? (
        <Research />
      ) : (
        <div className="panes">
          <Binder />
          <PaneView paneId="left" />
          {splitOpen && <PaneView paneId="right" />}
        </div>
      )}
    </div>
  );
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
