import { useState, type DragEvent } from "react";
import { ask } from "@tauri-apps/plugin-dialog";
import { PANE_IDS, useStore } from "../store";
import { findParentAndIndex, isDescendant } from "../tree";
import { STATUS_LABEL, type BinderNode, type NodeStatus } from "../types";

/** ID des gerade gezogenen Nodes (modulweit, DnD läuft nie parallel). */
let draggedId: string | null = null;

type DropZone = "before" | "after" | "inside" | null;

/** Stabile Referenz — `?? []` im Selector würde eine Endlos-Render-Schleife auslösen. */
const NO_BINDER: BinderNode[] = [];

export function Binder() {
  const binder = useStore((s) => s.project?.meta.binder ?? NO_BINDER);
  const createNode = useStore((s) => s.createNode);

  return (
    <nav className="binder">
      <div className="binder-header">
        <span>Binder</span>
        <button
          title="Neues Kapitel"
          onClick={() => void createNode(null, "chapter", "Neues Kapitel")}
        >
          + Kapitel
        </button>
      </div>
      <ul className="binder-tree">
        {binder.map((node) => (
          <BinderItem key={node.id} node={node} />
        ))}
      </ul>
    </nav>
  );
}

function BinderItem({ node }: { node: BinderNode }) {
  const { selectScene, selectChapter, createNode, renameNode, deleteNode, moveNode } =
    useStore();
  const isOpen = useStore((s) =>
    PANE_IDS.some(
      (p) => s.panes[p].sceneId === node.id || s.panes[p].corkboardId === node.id,
    ),
  );
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(node.title);
  const [dropZone, setDropZone] = useState<DropZone>(null);

  async function confirmDelete() {
    const yes = await ask(
      node.kind === "chapter"
        ? `Kapitel "${node.title}" samt Inhalt löschen? (Szenen wandern in den Papierkorb des Projekts)`
        : `Szene "${node.title}" löschen? (wandert in den Papierkorb des Projekts)`,
      { title: "Löschen", kind: "warning" },
    );
    if (yes) await deleteNode(node.id);
  }

  function commitRename() {
    setEditing(false);
    const title = draft.trim();
    if (title && title !== node.title) void renameNode(node.id, title);
    else setDraft(node.title);
  }

  // --- Drag & Drop ---

  function computeZone(e: DragEvent): DropZone {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = (e.clientY - rect.top) / rect.height;
    if (node.kind === "chapter") {
      return y < 0.25 ? "before" : y > 0.75 ? "after" : "inside";
    }
    return y < 0.5 ? "before" : "after";
  }

  function canDrop(): boolean {
    const binder = useStore.getState().project?.meta.binder ?? [];
    return (
      draggedId !== null &&
      draggedId !== node.id &&
      !isDescendant(binder, draggedId, node.id)
    );
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    const zone = computeZone(e);
    setDropZone(null);
    if (!canDrop() || !draggedId) return;
    const binder = useStore.getState().project?.meta.binder ?? [];

    if (zone === "inside") {
      // Ans Ende des Kapitels anhängen (Backend klemmt den Index).
      void moveNode(draggedId, node.id, Number.MAX_SAFE_INTEGER);
      return;
    }

    const targetPos = findParentAndIndex(binder, node.id);
    const dragPos = findParentAndIndex(binder, draggedId);
    if (!targetPos || !dragPos) return;
    let index = targetPos.index;
    // Entfernen des gezogenen Nodes verschiebt Indizes im selben Parent.
    if (dragPos.parentId === targetPos.parentId && dragPos.index < targetPos.index) {
      index--;
    }
    if (zone === "after") index++;
    void moveNode(draggedId, targetPos.parentId, index);
  }

  return (
    <li className={node.kind}>
      <div
        className={`binder-row ${isOpen ? "active" : ""} ${
          dropZone ? `drop-${dropZone}` : ""
        }`}
        draggable={!editing}
        onDragStart={(e) => {
          draggedId = node.id;
          e.dataTransfer.setData("text/plain", node.id);
          e.dataTransfer.effectAllowed = "move";
          e.stopPropagation();
        }}
        onDragEnd={() => {
          draggedId = null;
        }}
        onDragOver={(e) => {
          if (!canDrop()) return;
          e.preventDefault();
          e.stopPropagation();
          setDropZone(computeZone(e));
        }}
        onDragLeave={() => setDropZone(null)}
        onDrop={onDrop}
        onClick={() => {
          if (node.kind === "scene") void selectScene(node.id);
          else void selectChapter(node.id);
        }}
        onDoubleClick={() => {
          setDraft(node.title);
          setEditing(true);
        }}
      >
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") {
                setDraft(node.title);
                setEditing(false);
              }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <>
            <span className="binder-title">
              {node.color && (
                <span className="color-dot" style={{ background: node.color }} />
              )}
              {node.kind === "chapter" ? "📁 " : "📄 "}
              {node.title}
            </span>
            <span className="binder-actions" onClick={(e) => e.stopPropagation()}>
              {node.kind === "scene" && (
                <StatusDot status={(node.status ?? "draft") as NodeStatus} />
              )}
              {node.kind === "chapter" && (
                <button
                  title="Neue Szene in diesem Kapitel"
                  onClick={() => void createNode(node.id, "scene", "Neue Szene")}
                >
                  +
                </button>
              )}
              <button title="Löschen" onClick={() => void confirmDelete()}>
                🗑
              </button>
            </span>
          </>
        )}
      </div>
      {node.children.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <BinderItem key={child.id} node={child} />
          ))}
        </ul>
      )}
    </li>
  );
}

const STATUS_CLASS: Record<NodeStatus, string> = {
  draft: "status-draft",
  revision: "status-revision",
  done: "status-done",
};

function StatusDot({ status }: { status: NodeStatus }) {
  return <span className={`status-dot ${STATUS_CLASS[status]}`} title={STATUS_LABEL[status]} />;
}
