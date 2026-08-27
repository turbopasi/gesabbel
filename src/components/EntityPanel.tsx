import { useCallback, useEffect, useState } from "react";
import { ask, open } from "@tauri-apps/plugin-dialog";
import { api } from "../api";
import { useStore } from "../store";
import { SceneLinks } from "./SceneLinks";
import type { Entity, EntityKind } from "../types";

const LABELS: Record<EntityKind, { singular: string; empty: string }> = {
  characters: { singular: "Person", empty: "Noch keine Personen angelegt." },
  locations: { singular: "Ort", empty: "Noch keine Orte angelegt." },
};

export function EntityPanel({ kind }: { kind: EntityKind }) {
  const selectedId = useStore((s) => s.researchSelected[kind] ?? null);
  const setSelected = useStore((s) => s.setResearchSelected);
  const [entities, setEntities] = useState<Entity[]>([]);

  const reload = useCallback(async () => {
    try {
      setEntities(await api.listEntities(kind));
    } catch (e) {
      useStore.setState({ error: String(e) });
    }
  }, [kind]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const selected = entities.find((e) => e.id === selectedId) ?? null;

  async function addEntity() {
    try {
      const created = await api.saveEntity(kind, {
        id: "",
        name: `Neue ${LABELS[kind].singular}`,
      });
      await reload();
      setSelected(kind, created.id);
    } catch (e) {
      useStore.setState({ error: String(e) });
    }
  }

  return (
    <div className="research-split">
      <aside className="research-list">
        <button onClick={() => void addEntity()}>+ {LABELS[kind].singular}</button>
        {entities.length === 0 && <p className="muted small">{LABELS[kind].empty}</p>}
        <ul>
          {entities.map((e) => (
            <li
              key={e.id}
              className={e.id === selectedId ? "selected" : ""}
              onClick={() => setSelected(kind, e.id)}
            >
              {e.name}
            </li>
          ))}
        </ul>
      </aside>
      {selected ? (
        <EntityDetail
          key={selected.id}
          kind={kind}
          entity={selected}
          onSaved={reload}
          onDeleted={() => {
            setSelected(kind, null);
            void reload();
          }}
        />
      ) : (
        <div className="research-detail empty">
          <p className="muted">Wähle links einen Eintrag oder lege einen neuen an.</p>
        </div>
      )}
    </div>
  );
}

function EntityDetail({
  kind,
  entity,
  onSaved,
  onDeleted,
}: {
  kind: EntityKind;
  entity: Entity;
  onSaved: () => Promise<void>;
  onDeleted: () => void;
}) {
  const [draft, setDraft] = useState<Entity>({
    ...entity,
    description: entity.description ?? "",
    fields: entity.fields ?? [],
    sceneIds: entity.sceneIds ?? [],
  });
  const [image, setImage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void api.getEntityImage(kind, entity.id).then((img) => {
      if (alive) setImage(img);
    });
    return () => {
      alive = false;
    };
  }, [kind, entity.id]);

  async function save(next: Entity) {
    setDraft(next);
    try {
      await api.saveEntity(kind, next);
      await onSaved();
    } catch (e) {
      useStore.setState({ error: String(e) });
    }
  }

  async function chooseImage() {
    const file = await open({
      title: "Bild wählen",
      filters: [{ name: "Bilder", extensions: ["png", "jpg", "jpeg", "gif", "webp"] }],
    });
    if (typeof file !== "string") return;
    try {
      await api.setEntityImage(kind, entity.id, file);
      setImage(await api.getEntityImage(kind, entity.id));
      await onSaved();
    } catch (e) {
      useStore.setState({ error: String(e) });
    }
  }

  async function confirmDelete() {
    const yes = await ask(`"${entity.name}" löschen? (wandert in den Papierkorb des Projekts)`, {
      title: "Löschen",
      kind: "warning",
    });
    if (!yes) return;
    try {
      await api.deleteEntity(kind, entity.id);
      onDeleted();
    } catch (e) {
      useStore.setState({ error: String(e) });
    }
  }

  const patchField = (i: number, patch: Partial<{ label: string; value: string }>) => {
    const fields = draft.fields!.map((f, j) => (j === i ? { ...f, ...patch } : f));
    setDraft({ ...draft, fields });
  };

  return (
    <div className="research-detail">
      <div className="detail-header">
        <input
          className="detail-name"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          onBlur={() => {
            if (draft.name.trim() && draft.name !== entity.name) void save(draft);
          }}
        />
        <button onClick={() => void confirmDelete()}>🗑 Löschen</button>
      </div>

      <div className="detail-image-row">
        {image && <img className="detail-image" src={image} alt={draft.name} />}
        <button onClick={() => void chooseImage()}>
          {image ? "Bild ersetzen …" : "Bild wählen …"}
        </button>
      </div>

      <label className="small muted">Beschreibung</label>
      <textarea
        className="detail-description"
        value={draft.description}
        placeholder="Beschreibung …"
        onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        onBlur={() => {
          if (draft.description !== (entity.description ?? "")) void save(draft);
        }}
      />

      <label className="small muted">Freie Felder</label>
      {draft.fields!.map((f, i) => (
        <div key={i} className="field-row">
          <input
            placeholder="Feld (z. B. Alter)"
            value={f.label}
            onChange={(e) => patchField(i, { label: e.target.value })}
            onBlur={() => void save(draft)}
          />
          <input
            placeholder="Wert"
            value={f.value}
            onChange={(e) => patchField(i, { value: e.target.value })}
            onBlur={() => void save(draft)}
          />
          <button
            title="Feld entfernen"
            onClick={() =>
              void save({ ...draft, fields: draft.fields!.filter((_, j) => j !== i) })
            }
          >
            ×
          </button>
        </div>
      ))}
      <button
        className="add-field"
        onClick={() =>
          setDraft({ ...draft, fields: [...draft.fields!, { label: "", value: "" }] })
        }
      >
        + Feld
      </button>

      <SceneLinks
        sceneIds={draft.sceneIds!}
        onChange={(sceneIds) => void save({ ...draft, sceneIds })}
      />
    </div>
  );
}
