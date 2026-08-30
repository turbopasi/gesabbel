import type { BinderNode } from "./types";

export function findNode(nodes: BinderNode[], id: string): BinderNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findNode(n.children, id);
    if (found) return found;
  }
  return null;
}

/** Parent-ID (null = Wurzelebene) und Index eines Nodes. */
export function findParentAndIndex(
  nodes: BinderNode[],
  id: string,
  parentId: string | null = null,
): { parentId: string | null; index: number } | null {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === id) return { parentId, index: i };
    const found = findParentAndIndex(nodes[i].children, id, nodes[i].id);
    if (found) return found;
  }
  return null;
}

export function isDescendant(nodes: BinderNode[], ancestorId: string, id: string): boolean {
  const ancestor = findNode(nodes, ancestorId);
  return ancestor ? findNode(ancestor.children, id) !== null : false;
}

/** IDs aller Szenen des Binders in Manuskript-Reihenfolge. */
export function collectSceneIds(nodes: BinderNode[]): string[] {
  return nodes.flatMap((n) =>
    n.kind === "scene" ? [n.id, ...collectSceneIds(n.children)] : collectSceneIds(n.children),
  );
}

/** Szenen des Flusses, zu dem `id` gehört: alle Szenen unter demselben
 *  Kapitel (bzw. auf der Wurzelebene) in Manuskript-Reihenfolge. */
export function flowSceneIds(nodes: BinderNode[], id: string): string[] {
  const parent = findParentAndIndex(nodes, id);
  if (!parent) return [];
  const siblings = parent.parentId
    ? (findNode(nodes, parent.parentId)?.children ?? [])
    : nodes;
  return collectSceneIds(siblings);
}

/** Alle Nodes flach, mit Pfad aus Kapitel-Titeln (für Schnellnavigation). */
export function flattenTree(
  nodes: BinderNode[],
  path: string[] = [],
): { node: BinderNode; path: string[] }[] {
  return nodes.flatMap((n) => [
    { node: n, path },
    ...flattenTree(n.children, [...path, n.title]),
  ]);
}
