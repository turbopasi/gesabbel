// Was man mit einem Binder-Knoten tun kann und was sein Zustand anzeigt:
// Statusanzeige, die Menüeinträge für Status und Farbe, die Rückfrage vor dem
// Löschen. Binder und Corkboard teilen sich das — beide zeigen dieselben
// Knoten, und ihre Menüs sollen nicht auseinanderlaufen.
import { ask } from "@tauri-apps/plugin-dialog";
import { useStore } from "../store";
import {
  COLOR_LABEL,
  COLOR_PRESETS,
  STATUS_LABEL,
  type BinderNode,
  type NodeStatus,
} from "../types";
import type { ContextMenuItem } from "./ContextMenu";

const STATUS_CLASS: Record<NodeStatus, string> = {
  draft: "status-draft",
  revision: "status-revision",
  done: "status-done",
};

/** Fehlender Status heißt „Entwurf" — so hält es auch das Backend. */
export const statusOf = (node: BinderNode): NodeStatus =>
  (node.status ?? "draft") as NodeStatus;

/** Punkt für dichte Zeilen (Binder): nur Farbe, Name im Tooltip. */
export function StatusDot({ status }: { status: NodeStatus }) {
  return (
    <span className={`status-dot ${STATUS_CLASS[status]}`} title={STATUS_LABEL[status]} />
  );
}

/** Pille für die Karteikarte: dort ist Platz, das Wort auszuschreiben. */
export function StatusPill({ status }: { status: NodeStatus }) {
  return <span className={`status-pill ${STATUS_CLASS[status]}`}>{STATUS_LABEL[status]}</span>;
}

export function statusMenuItem(node: BinderNode): ContextMenuItem {
  const status = statusOf(node);
  return {
    kind: "submenu",
    label: "Status",
    mark: <StatusDot status={status} />,
    items: (Object.keys(STATUS_LABEL) as NodeStatus[]).map((s) => ({
      label: STATUS_LABEL[s],
      mark: <StatusDot status={s} />,
      checked: s === status,
      onSelect: () => void useStore.getState().updateNodeMeta(node.id, { status: s }),
    })),
  };
}

export function colorMenuItem(node: BinderNode): ContextMenuItem {
  return {
    kind: "submenu",
    label: "Farbe",
    icon: "palette",
    items: [
      ...COLOR_PRESETS.map((c) => ({
        label: COLOR_LABEL[c] ?? c,
        mark: <span className="color-dot" style={{ background: c }} />,
        checked: node.color === c,
        onSelect: () => void useStore.getState().updateNodeMeta(node.id, { color: c }),
      })),
      {
        label: "Keine Farbe",
        icon: "x" as const,
        checked: !node.color,
        onSelect: () => void useStore.getState().updateNodeMeta(node.id, { color: "" }),
      },
    ],
  };
}

/** Rückfrage vor dem Löschen — der Wortlaut steht nur hier. */
export async function confirmDeleteNode(node: BinderNode) {
  const yes = await ask(
    node.kind === "chapter"
      ? `Ordner "${node.title}" samt Inhalt löschen? (Dokumente wandern in den Papierkorb des Projekts)`
      : `Dokument "${node.title}" löschen? (wandert in den Papierkorb des Projekts)`,
    { title: "Löschen", kind: "warning" },
  );
  if (yes) await useStore.getState().deleteNode(node.id);
}
