import { useState, type DragEvent } from "react";
import { ask } from "@tauri-apps/plugin-dialog";
import { PANE_IDS, useStore } from "../store";
import { findParentAndIndex, isDescendant } from "../tree";
import {
  COLOR_LABEL,
  COLOR_PRESETS,
  STATUS_LABEL,
  type BinderNode,
  type NodeStatus,
} from "../types";
import { ContextMenu, useContextMenu, type ContextMenuItem } from "./ContextMenu";
import { Icon } from "./Icon";

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
          title="Neuer Ordner"
          onClick={() => void createNode(null, "chapter", "Ordner")}
        >
          <Icon name="plus" size={14} />
          Ordner
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
  const {
    selectScene,
    selectChapter,
    createNode,
    renameNode,
    duplicateNode,
    deleteNode,
    moveNode,
    updateNodeMeta,
    setCollapsed,
    toggleCollapsed,
  } = useStore();
  const collapsed = useStore((s) => s.collapsedIds.includes(node.id));
  const isOpen = useStore((s) =>
    PANE_IDS.some(
      (p) => s.panes[p].sceneId === node.id || s.panes[p].corkboardId === node.id,
    ),
  );
  // Im Fluss-Modus sind die übrigen Szenen des Kapitels mit offen — schwächer
  // markiert als die ausgewählte.
  const inFlow = useStore((s) =>
    PANE_IDS.some((p) => s.panes[p].sceneId !== node.id && s.panes[p].flowIds.includes(node.id)),
  );
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(node.title);
  const [dropZone, setDropZone] = useState<DropZone>(null);
  const { menu, open: openMenu, close: closeMenu } = useContextMenu();

  function startRename() {
    setDraft(node.title);
    setEditing(true);
  }

  /** Neues Dokument im Ordner — der klappt dafür auf, sonst landet es unsichtbar. */
  async function addDocument() {
    setCollapsed(node.id, false);
    await createNode(node.id, "scene", "Dokument");
  }

  /** Einträge des Rechtsklick-Menüs — Status und Farbe nur für Dokumente,
   *  passend zu den Karteikarten des Corkboards. */
  function menuItems(): ContextMenuItem[] {
    const items: ContextMenuItem[] = [];
    if (node.kind === "chapter") {
      items.push({
        label: "Neues Dokument",
        icon: "plus",
        onSelect: () => void addDocument(),
      });
      if (node.children.length > 0) {
        items.push({
          label: collapsed ? "Ausklappen" : "Einklappen",
          icon: collapsed ? "chevron-down" : "chevron-right",
          onSelect: () => toggleCollapsed(node.id),
        });
      }
    }
    items.push(
      { label: "Umbenennen", icon: "pencil", onSelect: startRename },
      { label: "Duplizieren", icon: "copy", onSelect: () => void duplicateNode(node.id) },
    );
    if (node.kind === "scene") {
      const status = node.status ?? "draft";
      items.push(
        { kind: "separator" },
        {
          kind: "submenu",
          label: "Status",
          mark: <span className={`status-dot ${STATUS_CLASS[status]}`} />,
          items: (Object.keys(STATUS_LABEL) as NodeStatus[]).map((s) => ({
            label: STATUS_LABEL[s],
            mark: <span className={`status-dot ${STATUS_CLASS[s]}`} />,
            checked: s === status,
            onSelect: () => void updateNodeMeta(node.id, { status: s }),
          })),
        },
        {
          kind: "submenu",
          label: "Farbe",
          icon: "palette",
          items: [
            ...COLOR_PRESETS.map((c) => ({
              label: COLOR_LABEL[c] ?? c,
              mark: <span className="color-dot" style={{ background: c }} />,
              checked: node.color === c,
              onSelect: () => void updateNodeMeta(node.id, { color: c }),
            })),
            {
              label: "Keine Farbe",
              icon: "x" as const,
              checked: !node.color,
              onSelect: () => void updateNodeMeta(node.id, { color: "" }),
            },
          ],
        },
      );
    }
    items.push(
      { kind: "separator" },
      { label: "Löschen", icon: "trash-2", danger: true, onSelect: () => void confirmDelete() },
    );
    return items;
  }

  async function confirmDelete() {
    const yes = await ask(
      node.kind === "chapter"
        ? `Ordner "${node.title}" samt Inhalt löschen? (Dokumente wandern in den Papierkorb des Projekts)`
        : `Dokument "${node.title}" löschen? (wandert in den Papierkorb des Projekts)`,
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
      // Ans Ende des Kapitels anhängen (Backend klemmt den Index) und
      // aufklappen, damit sichtbar wird, wo das Gezogene gelandet ist.
      setCollapsed(node.id, false);
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
        className={`binder-row ${isOpen ? "active" : ""} ${inFlow ? "in-flow" : ""} ${
          dropZone ? `drop-${dropZone}` : ""
        } ${menu ? "menu-open" : ""}`}
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
        onClick={(e) => {
          // e.detail zählt die Klicks: bei 2 kommt gleich onDoubleClick (Umbenennen) —
          // dann nicht schon per Einzelklick die Szene/den Fluss neu laden, sonst
          // kann der Reload dem gerade geöffneten Umbenennen-Feld den Fokus rauben.
          if (e.detail > 1) return;
          if (node.kind === "scene") void selectScene(node.id);
          else void selectChapter(node.id);
        }}
        onDoubleClick={startRename}
        // Beim Umbenennen gehört der Rechtsklick dem Textfeld (Ausschneiden,
        // Einfügen …), nicht dem Node.
        onContextMenu={(e) => !editing && openMenu(e, menuItems())}
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
            {/* Feste Spalte, damit Ordner mit und ohne Inhalt sowie Dokumente
                bündig stehen. */}
            <span className="binder-disclosure" onClick={(e) => e.stopPropagation()}>
              {node.kind === "chapter" && node.children.length > 0 && (
                <button
                  title={collapsed ? "Ausklappen" : "Einklappen"}
                  aria-expanded={!collapsed}
                  onClick={() => toggleCollapsed(node.id)}
                >
                  <Icon name={collapsed ? "chevron-right" : "chevron-down"} size={12} />
                </button>
              )}
            </span>
            <span className="binder-title">
              {node.color && (
                <span className="color-dot" style={{ background: node.color }} />
              )}
              <Icon name={node.kind === "chapter" ? "folder" : "file-text"} size={14} />
              {node.title}
            </span>
            <span className="binder-actions" onClick={(e) => e.stopPropagation()}>
              {node.kind === "scene" && (
                <StatusDot status={(node.status ?? "draft") as NodeStatus} />
              )}
              {node.kind === "chapter" && (
                <button
                  title="Neues Dokument in diesem Ordner"
                  onClick={() => void addDocument()}
                >
                  <Icon name="plus" size={14} />
                </button>
              )}
              <button title="Löschen" onClick={() => void confirmDelete()}>
                <Icon name="trash-2" size={14} />
              </button>
            </span>
          </>
        )}
      </div>
      {menu && <ContextMenu {...menu} onClose={closeMenu} />}
      {node.children.length > 0 && !collapsed && (
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
