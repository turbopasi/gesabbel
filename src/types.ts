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
  /** Kartenbild fürs Corkboard: projektrelativer Pfad unter images/. */
  image?: string | null;
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

export type EntityKind = "characters" | "locations";

export interface EntityField {
  label: string;
  value: string;
}

export interface Entity {
  id: string;
  name: string;
  description?: string;
  fields?: EntityField[];
  sceneIds?: string[];
  image?: string | null;
}

export interface NoteInfo {
  id: string;
  title: string;
}

export interface TimelineEvent {
  id: string;
  title: string;
  when?: string;
  description?: string;
  sceneIds?: string[];
}

export interface SearchHit {
  kind: "scene" | "note" | "character" | "location" | "event";
  id: string;
  title: string;
  snippet: string;
}

export interface VersionInfo {
  commitId: string;
  timestampMs: number;
  message: string;
}

export type ExportFormat = "docx" | "pdf" | "epub" | "markdown" | "txt";

export interface ExportTemplate {
  id: string;
  name: string;
  builtIn?: boolean;
  /** "times" | "georgia" | "arial" | "courier" */
  font: string;
  fontSizePt: number;
  lineSpacing: number;
  marginsMm: { top: number; bottom: number; left: number; right: number };
  /** Kopfzeile mit Platzhaltern {titel} {autor} {seite}; leer = keine. */
  header: string;
  sceneSeparator: string;
  chapterStartNewPage: boolean;
  includeSceneTitles: boolean;
}

export const EXPORT_FORMAT_LABEL: Record<ExportFormat, string> = {
  docx: "Word (DOCX)",
  pdf: "PDF",
  epub: "ePub (E-Book)",
  markdown: "Markdown",
  txt: "Reiner Text (TXT)",
};

export const EXPORT_FONT_LABEL: Record<string, string> = {
  times: "Times New Roman",
  georgia: "Georgia",
  arial: "Arial",
  courier: "Courier New",
};

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
