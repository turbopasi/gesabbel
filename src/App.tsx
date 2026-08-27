import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useStore } from "./store";
import { StartScreen } from "./components/StartScreen";
import { Binder } from "./components/Binder";
import { Editor } from "./components/Editor";
import "./App.css";

function App() {
  const project = useStore((s) => s.project);
  const error = useStore((s) => s.error);
  const clearError = useStore((s) => s.clearError);

  // Externe Änderungen beim Fokussieren prüfen; beim Defokussieren speichern.
  useEffect(() => {
    const unlisten = getCurrentWindow().onFocusChanged(({ payload: focused }) => {
      const s = useStore.getState();
      if (focused) void s.checkExternalChanges();
      else void s.flushSave();
    });
    return () => {
      void unlisten.then((f) => f());
    };
  }, []);

  return (
    <>
      {error && (
        <div className="banner error">
          <span>{error}</span>
          <button onClick={clearError}>OK</button>
        </div>
      )}
      <ConflictBanner />
      <ExternalChangesBanner />
      {project ? <MainView /> : <StartScreen />}
    </>
  );
}

function MainView() {
  const project = useStore((s) => s.project)!;
  const closeProject = useStore((s) => s.closeProject);

  return (
    <div className="main-layout">
      <header className="titlebar">
        <span className="project-title">{project.meta.title}</span>
        <span className="muted small">{project.root}</span>
        <button onClick={() => void closeProject()}>Projekt schließen</button>
      </header>
      <div className="panes">
        <Binder />
        <Editor />
      </div>
    </div>
  );
}

/** Aktuelle Szene wurde extern verändert, während lokal ungespeicherte Änderungen bestehen. */
function ConflictBanner() {
  const saveState = useStore((s) => s.saveState);
  const resolveConflict = useStore((s) => s.resolveConflict);
  if (saveState !== "conflict") return null;

  return (
    <div className="banner warning">
      <span>
        Diese Szene wurde außerhalb der App verändert (z. B. durch Sync). Wie möchtest du
        fortfahren?
      </span>
      <button onClick={() => void resolveConflict("reload")}>
        Externe Version laden (eigene Änderungen verwerfen)
      </button>
      <button onClick={() => void resolveConflict("overwrite")}>
        Eigene Version behalten (extern überschreiben)
      </button>
    </div>
  );
}

/** Projektdateien wurden extern verändert (ohne lokalen Schreibkonflikt). */
function ExternalChangesBanner() {
  const externalChanges = useStore((s) => s.externalChanges);
  const saveState = useStore((s) => s.saveState);
  const reloadProject = useStore((s) => s.reloadProject);
  if (externalChanges.length === 0 || saveState === "conflict") return null;

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
