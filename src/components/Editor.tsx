import { useStore } from "../store";

const SAVE_LABEL: Record<string, string> = {
  saved: "Gespeichert",
  dirty: "Ungespeicherte Änderungen …",
  saving: "Speichert …",
  conflict: "⚠ Konflikt",
};

export function Editor() {
  const { currentSceneId, sceneContent, saveState, setContent } = useStore();

  if (!currentSceneId) {
    return (
      <section className="editor empty">
        <p className="muted">Wähle links eine Szene aus — oder lege eine neue an.</p>
      </section>
    );
  }

  return (
    <section className="editor">
      <textarea
        value={sceneContent}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Hier schreiben …"
        spellCheck={false}
      />
      <footer className="statusbar">
        <span>{SAVE_LABEL[saveState]}</span>
      </footer>
    </section>
  );
}
