// Zeitstrahl: mehrere Handlungsstränge nebeneinander. Die Reihenfolge im
// events-Array ist die Chronologie — es gibt bewusst kein Datum, damit auch
// erfundene Kalender funktionieren; das Feld „Wann?" bleibt Freitext.
// Jeder Strang trägt eine Farbe aus der Palette des Binders, und die Ansicht
// kippt zwischen Spalten (Zeit läuft nach unten) und Zeilen (nach rechts).
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { ask } from "@tauri-apps/plugin-dialog";
import { api } from "../api";
import { useStore } from "../store";
import { SceneLinks } from "./SceneLinks";
import {
  ContextMenu,
  openBelow,
  useContextMenu,
  type ContextMenuItem,
} from "./ContextMenu";
import { colorSubmenu } from "./NodeActions";
import {
  COLOR_PRESETS,
  type Timeline,
  type TimelineEvent,
  type TimelineOrientation,
  type TimelineTrack,
} from "../types";
import { Icon } from "./Icon";

// Das gerade gezogene Ereignis — wie im Korkbrett außerhalb von React: der
// Zustand gehört zur Mausgeste, nicht zum Bild.
let draggedEventId: string | null = null;

/** Ereignisse nach Strängen, in der Reihenfolge der Stränge. */
function groupByTrack(
  tracks: TimelineTrack[],
  events: TimelineEvent[],
): Map<string, TimelineEvent[]> {
  const groups = new Map<string, TimelineEvent[]>(tracks.map((t) => [t.id, []]));
  const first = tracks[0]?.id ?? "";
  for (const ev of events) {
    const key = groups.has(ev.trackId ?? "") ? ev.trackId! : first;
    groups.get(key)?.push(ev);
  }
  return groups;
}

/** Aus den Gruppen wieder ein flaches Array — Strang für Strang. */
function flatten(tracks: TimelineTrack[], groups: Map<string, TimelineEvent[]>) {
  return tracks.flatMap((t) => groups.get(t.id) ?? []);
}

export function TimelinePanel() {
  // Der Zeitstrahl gehört zum Projekt: beim Wechsel neu laden, sonst zeigt das
  // Panel die Ereignisse des vorigen Projekts.
  const projectRoot = useStore((s) => s.project?.root);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const { menu, openAt, close: closeMenu } = useContextMenu();

  useEffect(() => {
    let cancelled = false;
    setTimeline(null);
    void api
      .loadTimeline()
      .then((tl) => !cancelled && setTimeline(tl))
      .catch((e) => useStore.setState({ error: String(e) }));
    return () => {
      cancelled = true;
    };
  }, [projectRoot]);

  const tracks = timeline?.tracks ?? [];
  const groups = useMemo(
    () => groupByTrack(tracks, timeline?.events ?? []),
    [tracks, timeline?.events],
  );

  if (timeline === null) return <div className="timeline" />;

  const orientation: TimelineOrientation =
    timeline.orientation === "rows" ? "rows" : "columns";

  async function persist(next: Timeline) {
    setTimeline(next);
    try {
      // Die Antwort trägt die vom Backend vergebenen IDs.
      setTimeline(await api.saveTimeline(next));
    } catch (e) {
      useStore.setState({ error: String(e) });
    }
  }

  /** Nur die Gruppen ändern, die Strangreihenfolge bleibt. */
  function persistGroups(next: Map<string, TimelineEvent[]>, nextTracks = tracks) {
    void persist({ ...timeline!, tracks: nextTracks, events: flatten(nextTracks, next) });
  }

  function addTrack() {
    const track: TimelineTrack = {
      id: "",
      name: `Strang ${tracks.length + 1}`,
      // Reihum durch die Palette, damit neue Stränge sich gleich unterscheiden.
      color: COLOR_PRESETS[tracks.length % COLOR_PRESETS.length],
    };
    void persist({ ...timeline!, tracks: [...tracks, track] });
  }

  function patchTrack(id: string, patch: Partial<TimelineTrack>) {
    void persist({
      ...timeline!,
      tracks: tracks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    });
  }

  function moveTrack(index: number, dir: -1 | 1) {
    const next = [...tracks];
    const [moved] = next.splice(index, 1);
    next.splice(index + dir, 0, moved);
    persistGroups(groups, next);
  }

  async function deleteTrack(track: TimelineTrack) {
    const count = groups.get(track.id)?.length ?? 0;
    const yes = await ask(
      count === 0
        ? `Strang "${track.name}" löschen?`
        : `Strang "${track.name}" mit ${count} Ereignis${count === 1 ? "" : "sen"} löschen?`,
      { title: "Löschen", kind: "warning" },
    );
    if (!yes) return;
    const nextTracks = tracks.filter((t) => t.id !== track.id);
    const nextGroups = new Map(groups);
    nextGroups.delete(track.id);
    persistGroups(nextGroups, nextTracks);
  }

  function addEvent(trackId: string) {
    const next = new Map(groups);
    next.set(trackId, [
      ...(next.get(trackId) ?? []),
      { id: "", title: "Neues Ereignis", when: "", description: "", sceneIds: [], trackId },
    ]);
    persistGroups(next);
  }

  function patchEvent(id: string, patch: Partial<TimelineEvent>) {
    void persist({
      ...timeline!,
      events: timeline!.events.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    });
  }

  function deleteEvent(id: string) {
    void persist({ ...timeline!, events: timeline!.events.filter((e) => e.id !== id) });
  }

  function moveEvent(trackId: string, index: number, dir: -1 | 1) {
    const list = [...(groups.get(trackId) ?? [])];
    const [moved] = list.splice(index, 1);
    list.splice(index + dir, 0, moved);
    const next = new Map(groups);
    next.set(trackId, list);
    persistGroups(next);
  }

  /** Ziehen: `beforeId` ist das Ereignis, vor dem eingefügt wird — null hängt
   *  ans Ende des Strangs. Funktioniert auch über Strangrenzen hinweg. */
  function dropEvent(dragId: string, trackId: string, beforeId: string | null) {
    if (dragId === beforeId) return;
    const source = timeline!.events.find((e) => e.id === dragId);
    if (!source) return;
    const next = groupByTrack(
      tracks,
      timeline!.events.filter((e) => e.id !== dragId),
    );
    const list = [...(next.get(trackId) ?? [])];
    const at = beforeId ? list.findIndex((e) => e.id === beforeId) : -1;
    list.splice(at < 0 ? list.length : at, 0, { ...source, trackId });
    next.set(trackId, list);
    persistGroups(next);
  }

  function trackMenu(track: TimelineTrack, index: number): ContextMenuItem[] {
    return [
      colorSubmenu(track.color, (color) => patchTrack(track.id, { color })),
      { kind: "separator" },
      {
        label: orientation === "columns" ? "Nach links" : "Nach oben",
        icon: orientation === "columns" ? "arrow-left" : "arrow-up",
        disabled: index === 0,
        onSelect: () => moveTrack(index, -1),
      },
      {
        label: orientation === "columns" ? "Nach rechts" : "Nach unten",
        icon: orientation === "columns" ? "arrow-right" : "arrow-down",
        disabled: index === tracks.length - 1,
        onSelect: () => moveTrack(index, 1),
      },
      { kind: "separator" },
      {
        label: "Strang löschen",
        icon: "trash-2",
        danger: true,
        // Ein Zeitstrahl ohne Strang wäre kein Zeitstrahl mehr.
        disabled: tracks.length === 1,
        onSelect: () => void deleteTrack(track),
      },
    ];
  }

  return (
    <div className="timeline">
      <div className="timeline-header">
        <h2>Zeitstrahl</h2>
        <div className="timeline-header-actions">
          <span className="timeline-orientation">
            <button
              className={orientation === "columns" ? "active" : ""}
              title="Stränge nebeneinander (Zeit läuft nach unten)"
              onClick={() => void persist({ ...timeline, orientation: "columns" })}
            >
              <Icon name="columns-2" size={14} />
            </button>
            <button
              className={orientation === "rows" ? "active" : ""}
              title="Stränge untereinander (Zeit läuft nach rechts)"
              onClick={() => void persist({ ...timeline, orientation: "rows" })}
            >
              <Icon name="rows-2" size={14} />
            </button>
          </span>
          <button onClick={addTrack}>
            <Icon name="plus" size={14} />
            Strang
          </button>
        </div>
      </div>
      <div className={`timeline-board ${orientation}`}>
        {tracks.map((track, i) => (
          <TrackLane
            key={track.id || i}
            track={track}
            events={groups.get(track.id) ?? []}
            orientation={orientation}
            onRename={(name) => patchTrack(track.id, { name })}
            onMenu={(e) => openBelow(e, trackMenu(track, i), openAt)}
            onAdd={() => addEvent(track.id)}
            onPatchEvent={patchEvent}
            onDeleteEvent={deleteEvent}
            onMoveEvent={(index, dir) => moveEvent(track.id, index, dir)}
            onDrop={(beforeId) =>
              draggedEventId && dropEvent(draggedEventId, track.id, beforeId)
            }
          />
        ))}
      </div>
      {menu && <ContextMenu {...menu} onClose={closeMenu} />}
    </div>
  );
}

function TrackLane({
  track,
  events,
  orientation,
  onRename,
  onMenu,
  onAdd,
  onPatchEvent,
  onDeleteEvent,
  onMoveEvent,
  onDrop,
}: {
  track: TimelineTrack;
  events: TimelineEvent[];
  orientation: TimelineOrientation;
  onRename: (name: string) => void;
  onMenu: (e: ReactMouseEvent<HTMLElement>) => void;
  onAdd: () => void;
  onPatchEvent: (id: string, patch: Partial<TimelineEvent>) => void;
  onDeleteEvent: (id: string) => void;
  onMoveEvent: (index: number, dir: -1 | 1) => void;
  onDrop: (beforeId: string | null) => void;
}) {
  const [name, setName] = useState(track.name);
  const [dropEnd, setDropEnd] = useState(false);
  const color = track.color || "var(--accent)";

  return (
    <section className="timeline-track" style={{ "--track": color } as CSSProperties}>
      <div className="timeline-track-header">
        <span className="color-dot" style={{ background: color }} />
        <input
          className="track-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== track.name && onRename(name.trim())}
        />
        <span className="timeline-actions">
          <button title="Ereignis anlegen" onClick={onAdd}>
            <Icon name="plus" size={14} />
          </button>
          <button title="Strang" onClick={onMenu}>
            <Icon name="ellipsis" size={14} />
          </button>
        </span>
      </div>
      <ol
        className={`timeline-list ${dropEnd ? "drop-end" : ""}`}
        // Freier Platz unter (bzw. neben) den Karten hängt ans Ende an — so
        // lässt sich ein Ereignis auch in einen leeren Strang ziehen.
        onDragOver={(e) => {
          if (!draggedEventId) return;
          e.preventDefault();
          setDropEnd(true);
        }}
        onDragLeave={() => setDropEnd(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDropEnd(false);
          onDrop(null);
        }}
      >
        {events.map((ev, i) => (
          <EventCard
            key={ev.id || i}
            event={ev}
            orientation={orientation}
            first={i === 0}
            last={i === events.length - 1}
            onChange={(patch) => onPatchEvent(ev.id, patch)}
            onMove={(dir) => onMoveEvent(i, dir)}
            onDelete={async () => {
              const yes = await ask(`Ereignis "${ev.title}" löschen?`, {
                title: "Löschen",
                kind: "warning",
              });
              if (yes) onDeleteEvent(ev.id);
            }}
            onDrop={(before) => onDrop(before ? ev.id : (events[i + 1]?.id ?? null))}
          />
        ))}
        {events.length === 0 && (
          <li className="timeline-track-empty muted">Noch keine Ereignisse.</li>
        )}
      </ol>
    </section>
  );
}

function EventCard({
  event,
  orientation,
  first,
  last,
  onChange,
  onMove,
  onDelete,
  onDrop,
}: {
  event: TimelineEvent;
  orientation: TimelineOrientation;
  first: boolean;
  last: boolean;
  onChange: (patch: Partial<TimelineEvent>) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
  onDrop: (before: boolean) => void;
}) {
  const [title, setTitle] = useState(event.title);
  const [when, setWhen] = useState(event.when ?? "");
  const [description, setDescription] = useState(event.description ?? "");
  const [dropSide, setDropSide] = useState<"before" | "after" | null>(null);
  // Beim Schreiben nicht ziehen — sonst reißt die Textauswahl die Karte mit.
  const [editing, setEditing] = useState(false);

  /** Vor oder hinter der Karte? In Spalten zählt oben/unten, in Zeilen links/rechts. */
  function side(e: ReactDragEvent): "before" | "after" {
    const r = e.currentTarget.getBoundingClientRect();
    return orientation === "columns"
      ? e.clientY < r.top + r.height / 2
        ? "before"
        : "after"
      : e.clientX < r.left + r.width / 2
        ? "before"
        : "after";
  }

  return (
    <li
      className={`timeline-event ${dropSide ? `drop-${dropSide}` : ""}`}
      draggable={!editing}
      onDragStart={(e) => {
        draggedEventId = event.id;
        e.dataTransfer.setData("text/plain", event.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={() => {
        draggedEventId = null;
      }}
      onDragOver={(e) => {
        if (!draggedEventId || draggedEventId === event.id) return;
        e.preventDefault();
        e.stopPropagation();
        setDropSide(side(e));
      }}
      onDragLeave={() => setDropSide(null)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const before = side(e) === "before";
        setDropSide(null);
        onDrop(before);
      }}
    >
      <div className="timeline-marker" />
      <div className="timeline-card">
        <div className="timeline-card-header">
          <input
            className="event-when"
            placeholder="Wann? (z. B. 3. März, Tag 12 …)"
            value={when}
            onFocus={() => setEditing(true)}
            onChange={(e) => setWhen(e.target.value)}
            onBlur={() => {
              setEditing(false);
              if (when !== (event.when ?? "")) onChange({ when });
            }}
          />
          <span className="timeline-actions">
            <button
              disabled={first}
              title={orientation === "columns" ? "Nach oben" : "Nach links"}
              onClick={() => onMove(-1)}
            >
              <Icon name={orientation === "columns" ? "arrow-up" : "arrow-left"} size={14} />
            </button>
            <button
              disabled={last}
              title={orientation === "columns" ? "Nach unten" : "Nach rechts"}
              onClick={() => onMove(1)}
            >
              <Icon
                name={orientation === "columns" ? "arrow-down" : "arrow-right"}
                size={14}
              />
            </button>
            <button title="Löschen" onClick={onDelete}>
              <Icon name="trash-2" size={14} />
            </button>
          </span>
        </div>
        <input
          className="event-title"
          value={title}
          onFocus={() => setEditing(true)}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            setEditing(false);
            if (title.trim() && title !== event.title) onChange({ title });
          }}
        />
        <textarea
          className="event-description"
          placeholder="Was passiert? …"
          value={description}
          onFocus={() => setEditing(true)}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => {
            setEditing(false);
            if (description !== (event.description ?? "")) onChange({ description });
          }}
        />
        <SceneLinks
          sceneIds={event.sceneIds ?? []}
          onChange={(sceneIds) => onChange({ sceneIds })}
        />
      </div>
    </li>
  );
}
