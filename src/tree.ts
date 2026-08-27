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
