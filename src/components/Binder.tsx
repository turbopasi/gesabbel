import { useState } from "react";
import { ask } from "@tauri-apps/plugin-dialog";
import { useStore } from "../store";
import type { BinderNode } from "../types";

export function Binder() {
  const binder = useStore((s) => s.project?.meta.binder ?? []);
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
  const { currentSceneId, selectScene, createNode, renameNode, deleteNode } = useStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(node.title);

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

  return (
    <li className={node.kind}>
      <div
        className={`binder-row ${node.id === currentSceneId ? "active" : ""}`}
        onClick={() => {
          if (node.kind === "scene") void selectScene(node.id);
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
              {node.kind === "chapter" ? "📁 " : "📄 "}
              {node.title}
            </span>
            <span className="binder-actions" onClick={(e) => e.stopPropagation()}>
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
