import { useEffect, useState } from "react";
import { api } from "../api";
import { useStore, type PaneId, type PaneResearchKind } from "../store";
import { EntityDoc } from "./EntityDoc";
import { DocEditor } from "./DocEditor";
import type { Entity, EntityKind, NoteInfo } from "../types";

export const RESEARCH_KIND_LABELS: Record<PaneResearchKind, { singular: string; plural: string }> = {
  characters: { singular: "Person", plural: "Personen" },
  locations: { singular: "Ort", plural: "Orte" },
  notes: { singular: "Notiz", plural: "Notizen" },
};

/** Pane-Inhalt für Recherche: Kopfzeile mit Auswahl, darunter das Detail. */
export function ResearchPane({ paneId }: { paneId: PaneId }) {
  const kind = useStore((s) => s.panes[paneId].researchKind)!;
  const researchId = useStore((s) => s.panes[paneId].researchId);
  const isActive = useStore((s) => s.activePane === paneId && s.layoutMode !== "single");
  const setActivePane = useStore((s) => s.setActivePane);
  const setPaneResearchId = useStore((s) => s.setPaneResearchId);
  const touchResearch = useStore((s) => s.touchResearch);
  const researchVersion = useStore((s) => s.researchVersion);

  const [entities, setEntities] = useState<Entity[]>([]);
  const [notes, setNotes] = useState<NoteInfo[]>([]);

  useEffect(() => {
    let alive = true;
    const load =
      kind === "notes"
        ? api.listNotes().then((l) => alive && setNotes(l))
        : api.listEntities(kind as EntityKind).then((l) => alive && setEntities(l));
    void load.catch((e) => useStore.setState({ error: String(e) }));
    return () => {
      alive = false;
    };
  }, [kind, researchVersion]);

  const labels = RESEARCH_KIND_LABELS[kind];
  const items: { id: string; name: string }[] =
    kind === "notes"
      ? notes.map((n) => ({ id: n.id, name: n.title }))
      : entities.map((e) => ({ id: e.id, name: e.name }));

  async function addItem() {
    try {
      if (kind === "notes") {
        const list = await api.createNote("Neue Notiz");
        const created = list[list.length - 1];
        touchResearch();
        if (created) setPaneResearchId(paneId, created.id);
      } else {
        const created = await api.saveEntity(kind as EntityKind, {
          id: "",
          name: `Neue ${labels.singular}`,
        });
        touchResearch();
        setPaneResearchId(paneId, created.id);
      }
    } catch (e) {
      useStore.setState({ error: String(e) });
    }
  }

  const selectedEntity = kind !== "notes" ? entities.find((e) => e.id === researchId) : null;
  const selectedNote = kind === "notes" ? notes.find((n) => n.id === researchId) : null;

  return (
    <section
      className={`editor research-pane ${isActive ? "pane-active" : ""}`}
      onFocusCapture={() => setActivePane(paneId)}
      onMouseDownCapture={() => setActivePane(paneId)}
    >
      <div className="research-pane-header">
        <span className="muted small">{labels.plural}</span>
        <select
          value={researchId ?? ""}
          onChange={(e) => setPaneResearchId(paneId, e.target.value || null)}
        >
          <option value="">— auswählen —</option>
          {items.map((it) => (
            <option key={it.id} value={it.id}>
              {it.name}
            </option>
          ))}
        </select>
        <button title={`Neue ${labels.singular} anlegen`} onClick={() => void addItem()}>
          + Neu
        </button>
      </div>
      {selectedEntity ? (
        <EntityDoc
          key={selectedEntity.id}
          kind={kind as EntityKind}
          entity={selectedEntity}
          onDeleted={() => setPaneResearchId(paneId, null)}
        />
      ) : selectedNote ? (
        <DocEditor
          key={selectedNote.id}
          docKey={`note:${selectedNote.id}`}
          read={() => api.readNote(selectedNote.id)}
          write={(content, force) => api.writeNote(selectedNote.id, content, force)}
        />
      ) : (
        <div className="research-detail empty">
          <p className="muted">
            {items.length === 0
              ? `Noch keine ${labels.plural} angelegt.`
              : `Wähle oben ${kind === "notes" ? "eine" : kind === "characters" ? "eine" : "einen"} ${labels.singular} aus.`}
          </p>
        </div>
      )}
    </section>
  );
}
