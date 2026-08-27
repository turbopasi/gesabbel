import { useCallback, useEffect, useRef, useState } from "react";
import { ask } from "@tauri-apps/plugin-dialog";
import { api } from "../api";
import { useStore } from "../store";
import type { NoteInfo } from "../types";

export function NotesPanel() {
  const selectedId = useStore((s) => s.researchSelected["notes"] ?? null);
  const setSelected = useStore((s) => s.setResearchSelected);
  const [notes, setNotes] = useState<NoteInfo[]>([]);

  const reload = useCallback(async () => {
    try {
      setNotes(await api.listNotes());
    } catch (e) {
      useStore.setState({ error: String(e) });
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function addNote() {
    try {
      const list = await api.createNote("Neue Notiz");
      setNotes(list);
      const created = list[list.length - 1];
      if (created) setSelected("notes", created.id);
    } catch (e) {
      useStore.setState({ error: String(e) });
    }
  }

  async function removeNote(note: NoteInfo) {
    const yes = await ask(`Notiz "${note.title}" löschen? (wandert in den Papierkorb)`, {
      title: "Löschen",
      kind: "warning",
    });
    if (!yes) return;
    try {
      setNotes(await api.deleteNote(note.id));
      if (selectedId === note.id) setSelected("notes", null);
    } catch (e) {
      useStore.setState({ error: String(e) });
    }
  }

  const selected = notes.find((n) => n.id === selectedId) ?? null;

  return (
    <div className="research-split">
      <aside className="research-list">
        <button onClick={() => void addNote()}>+ Notiz</button>
        {notes.length === 0 && <p className="muted small">Noch keine Notizen.</p>}
        <ul>
          {notes.map((n) => (
            <NoteRow
              key={n.id}
              note={n}
              selected={n.id === selectedId}
              onSelect={() => setSelected("notes", n.id)}
              onRename={async (title) => {
                setNotes(await api.renameNote(n.id, title));
              }}
              onDelete={() => void removeNote(n)}
            />
          ))}
        </ul>
      </aside>
      {selected ? (
        <NoteEditor key={selected.id} note={selected} />
      ) : (
        <div className="research-detail empty">
          <p className="muted">Wähle links eine Notiz oder lege eine neue an.</p>
        </div>
      )}
    </div>
  );
}

function NoteRow({
  note,
  selected,
  onSelect,
  onRename,
  onDelete,
}: {
  note: NoteInfo;
  selected: boolean;
  onSelect: () => void;
  onRename: (title: string) => Promise<void>;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.title);

  function commit() {
    setEditing(false);
    const title = draft.trim();
    if (title && title !== note.title) void onRename(title);
    else setDraft(note.title);
  }

  return (
    <li className={selected ? "selected" : ""} onClick={onSelect} onDoubleClick={() => setEditing(true)}>
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(note.title);
              setEditing(false);
            }
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <>
          <span>{note.title}</span>
          <button
            className="row-delete"
            title="Löschen"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            🗑
          </button>
        </>
      )}
    </li>
  );
}

const AUTOSAVE_MS = 2000;

function NoteEditor({ note }: { note: NoteInfo }) {
  const [content, setContent] = useState<string | null>(null);
  const [status, setStatus] = useState<"saved" | "dirty" | "conflict">("saved");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef("");

  useEffect(() => {
    let alive = true;
    void api
      .readNote(note.id)
      .then((c) => {
        if (alive) {
          latest.current = c;
          setContent(c);
        }
      })
      .catch((e) => useStore.setState({ error: String(e) }));
    return () => {
      alive = false;
      if (timer.current) clearTimeout(timer.current);
      // Beim Verlassen ungespeicherte Änderungen sichern (force: bewusst simpel).
      void flushRef.current?.();
    };
  }, [note.id]);

  const flushRef = useRef<null | (() => Promise<void>)>(null);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    try {
      const result = await api.writeNote(note.id, latest.current);
      if (result.status === "conflict") setStatus("conflict");
      else setStatus("saved");
    } catch (e) {
      useStore.setState({ error: String(e) });
    }
  }, [note.id]);
  flushRef.current = flush;

  if (content === null) return <div className="research-detail" />;

  return (
    <div className="research-detail note-editor">
      {status === "conflict" && (
        <div className="banner warning">
          <span>Diese Notiz wurde außerhalb der App verändert.</span>
          <button
            onClick={async () => {
              const c = await api.readNote(note.id);
              latest.current = c;
              setContent(c);
              setStatus("saved");
            }}
          >
            Externe Version laden
          </button>
          <button
            onClick={async () => {
              await api.writeNote(note.id, latest.current, true);
              setStatus("saved");
            }}
          >
            Eigene Version behalten
          </button>
        </div>
      )}
      <textarea
        className="note-content"
        value={content}
        placeholder="Notiz (Markdown) …"
        onChange={(e) => {
          setContent(e.target.value);
          latest.current = e.target.value;
          setStatus("dirty");
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => void flush(), AUTOSAVE_MS);
        }}
        onBlur={() => {
          if (status === "dirty") void flush();
        }}
      />
      <footer className="statusbar">
        <span>
          {status === "saved" ? "Gespeichert" : status === "dirty" ? "Ungespeichert …" : "⚠ Konflikt"}
        </span>
      </footer>
    </div>
  );
}
