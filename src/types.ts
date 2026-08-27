export type NodeKind = "chapter" | "scene";

export type NodeStatus = "draft" | "revision" | "done";

export interface BinderNode {
  id: string;
  kind: NodeKind;
  title: string;
  synopsis?: string;
  status?: NodeStatus;
  color?: string | null;
  tags?: string[];
  children: BinderNode[];
}

export interface ProjectMeta {
  formatVersion: number;
  title: string;
  author: string;
  created: string;
  binder: BinderNode[];
}

export interface ProjectInfo {
  root: string;
  meta: ProjectMeta;
}

export type WriteResult = { status: "ok" } | { status: "conflict" };

export const STATUS_LABEL: Record<NodeStatus, string> = {
  draft: "Entwurf",
  revision: "Überarbeitung",
  done: "Fertig",
};

export const COLOR_PRESETS = [
  "#c0392b",
  "#e67e22",
  "#e6b33f",
  "#27ae60",
  "#4a6da7",
  "#8e5aa7",
];
