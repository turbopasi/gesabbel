import { useEffect, useState } from "react";
import { api } from "../api";
import { useStore, type PaneId, type PaneResearchKind } from "../store";
import { DocBackdrop } from "./DocBackdrop";
import { EntityDoc } from "./EntityDoc";
import { DocEditor } from "./DocEditor";
import { MentionsBar } from "./MentionsBar";
import type { Entity, EntityKind, NoteInfo } from "../types";

export const RESEARCH_KIND_LABELS: Record<PaneResearchKind, { singular: string; plural: string }> = {
  characters: { singular: "Person", plural: "Personen" },
  locations: { singular: "Ort", plural: "Orte" },
  notes: { singular: "Notiz", plural: "Notizen" },
};

/** Pane-Inhalt für Recherche: das Detail zum in der Sidebar gewählten Eintrag. */
export function ResearchPane({ paneId }: { paneId: PaneId }) {
  const kind = useStore((s) => s.panes[paneId].researchKind)!;
  const researchId = useStore((s) => s.panes[paneId].researchId);
  const isActive = useStore((s) => s.activePane === paneId && s.layoutMode !== "single");
  const setActivePane = useStore((s) => s.setActivePane);
  const setPaneResearchId = useStore((s) => s.setPaneResearchId);
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
  const itemCount = kind === "notes" ? notes.length : entities.length;

  const selectedEntity = kind !== "notes" ? entities.find((e) => e.id === researchId) : null;
  const selectedNote = kind === "notes" ? notes.find((n) => n.id === researchId) : null;

  return (
    <section
      className={`editor research-pane ${isActive ? "pane-active" : ""}`}
      onFocusCapture={() => setActivePane(paneId)}
      onMouseDownCapture={() => setActivePane(paneId)}
    >
      <DocBackdrop />
      {selectedEntity ? (
        <EntityDoc
          key={selectedEntity.id}
          kind={kind as EntityKind}
          entity={selectedEntity}
          paneId={paneId}
          onDeleted={() => setPaneResearchId(paneId, null)}
        />
      ) : selectedNote ? (
        <div className="entity-doc">
          <DocEditor
            key={selectedNote.id}
            docKey={`note:${selectedNote.id}`}
            paneId={paneId}
            read={() => api.readNote(selectedNote.id)}
            write={(content, force) => api.writeNote(selectedNote.id, content, force)}
          />
          <MentionsBar tagKind="note" id={selectedNote.id} paneId={paneId} />
        </div>
      ) : (
        <div className="research-detail empty">
          <p className="muted">
            {itemCount === 0
              ? `Noch keine ${labels.plural} angelegt.`
              : "Wähle in der Sidebar ein Dokument oder ein Modul für diesen Bereich aus."}
          </p>
        </div>
      )}
    </section>
  );
}
