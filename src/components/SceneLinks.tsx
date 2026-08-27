import { useStore } from "../store";
import { findNode, flattenTree } from "../tree";
import type { BinderNode } from "../types";

const NO_BINDER: BinderNode[] = [];

/** Chips verknüpfter Szenen + Dropdown zum Hinzufügen (Personen, Orte, Ereignisse). */
export function SceneLinks({
  sceneIds,
  onChange,
}: {
  sceneIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const binder = useStore((s) => s.project?.meta.binder ?? NO_BINDER);
  const selectScene = useStore((s) => s.selectScene);

  const allScenes = flattenTree(binder).filter(({ node }) => node.kind === "scene");
  const available = allScenes.filter(({ node }) => !sceneIds.includes(node.id));

  return (
    <div className="scene-links">
      <span className="small muted">Verknüpfte Szenen:</span>
      <div className="chips">
        {sceneIds.map((id) => {
          const node = findNode(binder, id);
          return (
            <span key={id} className="chip">
              <button
                className="chip-label"
                title="Szene öffnen"
                onClick={() => void selectScene(id)}
              >
                {node?.title ?? id}
              </button>
              <button
                className="chip-remove"
                title="Verknüpfung entfernen"
                onClick={() => onChange(sceneIds.filter((s) => s !== id))}
              >
                ×
              </button>
            </span>
          );
        })}
        {available.length > 0 && (
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) onChange([...sceneIds, e.target.value]);
            }}
          >
            <option value="">+ Szene verknüpfen …</option>
            {available.map(({ node, path }) => (
              <option key={node.id} value={node.id}>
                {path.length > 0 ? `${path.join(" › ")} › ` : ""}
                {node.title}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
