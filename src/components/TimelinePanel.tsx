import { useEffect, useState } from "react";
import { ask } from "@tauri-apps/plugin-dialog";
import { api } from "../api";
import { useStore } from "../store";
import { SceneLinks } from "./SceneLinks";
import type { TimelineEvent } from "../types";

export function TimelinePanel() {
  const [events, setEvents] = useState<TimelineEvent[] | null>(null);

  useEffect(() => {
    void api
      .loadTimeline()
      .then(setEvents)
      .catch((e) => useStore.setState({ error: String(e) }));
  }, []);

  async function persist(next: TimelineEvent[]) {
    setEvents(next);
    try {
      setEvents(await api.saveTimeline(next));
    } catch (e) {
      useStore.setState({ error: String(e) });
    }
  }

  if (events === null) return <div className="timeline" />;

  async function addEvent() {
    await persist([
      ...events!,
      { id: "", title: "Neues Ereignis", when: "", description: "", sceneIds: [] },
    ]);
  }

  return (
    <div className="timeline">
      <div className="timeline-header">
        <h2>Zeitstrahl</h2>
        <button onClick={() => void addEvent()}>+ Ereignis</button>
      </div>
      {events.length === 0 && (
        <p className="muted">
          Noch keine Ereignisse. Lege chronologische Ereignisse an und verknüpfe sie mit
          Szenen.
        </p>
      )}
      <ol className="timeline-list">
        {events.map((ev, i) => (
          <EventCard
            key={ev.id || i}
            event={ev}
            first={i === 0}
            last={i === events.length - 1}
            onChange={(patch) =>
              void persist(events.map((e, j) => (j === i ? { ...e, ...patch } : e)))
            }
            onMove={(dir) => {
              const next = [...events];
              const [moved] = next.splice(i, 1);
              next.splice(i + dir, 0, moved);
              void persist(next);
            }}
            onDelete={async () => {
              const yes = await ask(`Ereignis "${ev.title}" löschen?`, {
                title: "Löschen",
                kind: "warning",
              });
              if (yes) void persist(events.filter((_, j) => j !== i));
            }}
          />
        ))}
      </ol>
    </div>
  );
}

function EventCard({
  event,
  first,
  last,
  onChange,
  onMove,
  onDelete,
}: {
  event: TimelineEvent;
  first: boolean;
  last: boolean;
  onChange: (patch: Partial<TimelineEvent>) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(event.title);
  const [when, setWhen] = useState(event.when ?? "");
  const [description, setDescription] = useState(event.description ?? "");

  return (
    <li className="timeline-event">
      <div className="timeline-marker" />
      <div className="timeline-card">
        <div className="timeline-card-header">
          <input
            className="event-when"
            placeholder="Wann? (z. B. 3. März, Tag 12 …)"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            onBlur={() => when !== (event.when ?? "") && onChange({ when })}
          />
          <span className="timeline-actions">
            <button disabled={first} title="Nach oben" onClick={() => onMove(-1)}>
              ↑
            </button>
            <button disabled={last} title="Nach unten" onClick={() => onMove(1)}>
              ↓
            </button>
            <button title="Löschen" onClick={onDelete}>
              🗑
            </button>
          </span>
        </div>
        <input
          className="event-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && title !== event.title && onChange({ title })}
        />
        <textarea
          className="event-description"
          placeholder="Was passiert? …"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() =>
            description !== (event.description ?? "") && onChange({ description })
          }
        />
        <SceneLinks
          sceneIds={event.sceneIds ?? []}
          onChange={(sceneIds) => onChange({ sceneIds })}
        />
      </div>
    </li>
  );
}
