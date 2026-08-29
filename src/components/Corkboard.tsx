import { useState, type ClipboardEvent, type DragEvent } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { api } from "../api";
import { useStore } from "../store";
import { findNode, findParentAndIndex } from "../tree";
import { saveClipboardImage, useDocImage } from "./DocImage";
import {
  COLOR_PRESETS,
  STATUS_LABEL,
  type BinderNode,
  type NodeStatus,
} from "../types";

/** ID der gerade gezogenen Karte (modulweit, DnD läuft nie parallel). */
let draggedCardId: string | null = null;

export function Corkboard({ chapterId }: { chapterId: string }) {
  const chapter = useStore((s) =>
    s.project ? findNode(s.project.meta.binder, chapterId) : null,
  );
  const createNode = useStore((s) => s.createNode);
  const moveNode = useStore((s) => s.moveNode);

  if (!chapter) return null;

  function onBoardDrop(e: DragEvent) {
    // Drop auf freie Fläche: ans Ende anhängen.
    e.preventDefault();
    if (draggedCardId) {
      void moveNode(draggedCardId, chapterId, Number.MAX_SAFE_INTEGER);
    }
  }

  return (
    <div
      className="corkboard"
      onDragOver={(e) => {
        if (draggedCardId) e.preventDefault();
      }}
      onDrop={onBoardDrop}
    >
      <div className="corkboard-header">
        <h2>{chapter.title}</h2>
        <button onClick={() => void createNode(chapterId, "scene", "Neue Szene")}>
          + Szene
        </button>
      </div>
      {chapter.children.length === 0 ? (
        <p className="muted">Dieses Kapitel ist noch leer.</p>
      ) : (
        <div className="cards">
          {chapter.children.map((child) => (
            <Card key={child.id} node={child} parentId={chapterId} />
          ))}
        </div>
      )}
    </div>
  );
}

function Card({ node, parentId }: { node: BinderNode; parentId: string }) {
  const { selectScene, selectChapter, updateNodeMeta, moveNode } = useStore();
  const [synopsisDraft, setSynopsisDraft] = useState<string | null>(null);
  const [dropSide, setDropSide] = useState<"before" | "after" | null>(null);
  const [showMeta, setShowMeta] = useState(false);

  const status = (node.status ?? "draft") as NodeStatus;

  function commitSynopsis() {
    if (synopsisDraft !== null && synopsisDraft !== (node.synopsis ?? "")) {
      void updateNodeMeta(node.id, { synopsis: synopsisDraft });
    }
    setSynopsisDraft(null);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    const side = computeSide(e);
    setDropSide(null);
    if (!draggedCardId || draggedCardId === node.id) return;
    const binder = useStore.getState().project?.meta.binder ?? [];
    const targetPos = findParentAndIndex(binder, node.id);
    const dragPos = findParentAndIndex(binder, draggedCardId);
    if (!targetPos || !dragPos) return;
    let index = targetPos.index;
    if (dragPos.parentId === targetPos.parentId && dragPos.index < targetPos.index) {
      index--;
    }
    if (side === "after") index++;
    void moveNode(draggedCardId, parentId, index);
  }

  function computeSide(e: DragEvent): "before" | "after" {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return e.clientX - rect.left < rect.width / 2 ? "before" : "after";
  }

  async function chooseImage() {
    const file = await open({
      title: "Kartenbild wählen",
      filters: [{ name: "Bilder", extensions: ["png", "jpg", "jpeg", "gif", "webp"] }],
    });
    if (typeof file !== "string") return;
    try {
      const rel = await api.importDocImage(file);
      await updateNodeMeta(node.id, { image: rel });
    } catch (e) {
      useStore.setState({ error: String(e) });
    }
  }

  function onPaste(e: ClipboardEvent) {
    // Screenshot/Bild in der Zwischenablage → als Kartenbild übernehmen.
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
    const file = item?.getAsFile();
    if (!file) return;
    e.preventDefault();
    void (async () => {
      try {
        const rel = await saveClipboardImage(file);
        await updateNodeMeta(node.id, { image: rel });
      } catch (err) {
        useStore.setState({ error: String(err) });
      }
    })();
  }

  return (
    <div
      className={`card ${dropSide ? `drop-${dropSide}` : ""}`}
      tabIndex={0}
      onPaste={onPaste}
      draggable={synopsisDraft === null}
      onDragStart={(e) => {
        draggedCardId = node.id;
        e.dataTransfer.setData("text/plain", node.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={() => {
        draggedCardId = null;
      }}
      onDragOver={(e) => {
        if (!draggedCardId || draggedCardId === node.id) return;
        e.preventDefault();
        e.stopPropagation();
        setDropSide(computeSide(e));
      }}
      onDragLeave={() => setDropSide(null)}
      onDrop={onDrop}
      style={node.color ? { borderTopColor: node.color } : undefined}
    >
      <div
        className="card-title"
        title="Doppelklick: öffnen"
        onDoubleClick={() => {
          if (node.kind === "scene") void selectScene(node.id);
          else void selectChapter(node.id);
        }}
      >
        {node.kind === "chapter" ? "📁 " : ""}
        {node.title}
      </div>

      {node.image && <CardImage rel={node.image} />}

      <textarea
        className="card-synopsis"
        placeholder="Synopsis …"
        value={synopsisDraft ?? node.synopsis ?? ""}
        onFocus={() => setSynopsisDraft(node.synopsis ?? "")}
        onChange={(e) => setSynopsisDraft(e.target.value)}
        onBlur={commitSynopsis}
      />

      <div className="card-footer">
        <select
          value={status}
          onChange={(e) => void updateNodeMeta(node.id, { status: e.target.value })}
          title="Status"
        >
          {(Object.keys(STATUS_LABEL) as NodeStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <button
          title="Kartenbild wählen … (oder Karte anklicken und Screenshot mit Strg+V einfügen)"
          onClick={() => void chooseImage()}
        >
          🖼
        </button>
        <button
          className={showMeta ? "on" : ""}
          title="Farbe & Tags"
          onClick={() => setShowMeta(!showMeta)}
        >
          ⋯
        </button>
      </div>

      {showMeta && (
        <div className="card-meta">
          <div className="swatches">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c}
                className={`swatch ${node.color === c ? "on" : ""}`}
                style={{ background: c }}
                title={c}
                onClick={() => void updateNodeMeta(node.id, { color: c })}
              />
            ))}
            <button
              className="swatch none"
              title="Keine Farbe"
              onClick={() => void updateNodeMeta(node.id, { color: "" })}
            >
              ×
            </button>
          </div>
          <input
            placeholder="Tags (kommagetrennt)"
            defaultValue={(node.tags ?? []).join(", ")}
            onBlur={(e) => {
              const tags = e.target.value
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean);
              void updateNodeMeta(node.id, { tags });
            }}
          />
          {node.image && (
            <button onClick={() => void updateNodeMeta(node.id, { image: "" })}>
              🖼 Bild entfernen
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function CardImage({ rel }: { rel: string }) {
  const url = useDocImage(rel);
  if (!url) return null;
  return <img className="card-image" src={url} alt="" draggable={false} />;
}
