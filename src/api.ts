import { invoke } from "@tauri-apps/api/core";
import type {
  Entity,
  EntityKind,
  ExportFormat,
  ExportTemplate,
  NodeKind,
  NoteInfo,
  ProjectInfo,
  SearchHit,
  TimelineEvent,
  VersionInfo,
  WriteResult,
} from "./types";

export const api = {
  createProject: (parentDir: string, name: string, title: string, author: string) =>
    invoke<ProjectInfo>("create_project", { parentDir, name, title, author }),
  openProject: (path: string) => invoke<ProjectInfo>("open_project", { path }),
  closeProject: () => invoke<void>("close_project"),
  readScene: (id: string) => invoke<string>("read_scene", { id }),
  writeScene: (id: string, content: string, force = false) =>
    invoke<WriteResult>("write_scene", { id, content, force }),
  createNode: (parentId: string | null, kind: NodeKind, title: string) =>
    invoke<ProjectInfo>("create_node", { parentId, kind, title }),
  renameNode: (id: string, title: string) =>
    invoke<ProjectInfo>("rename_node", { id, title }),
  moveNode: (id: string, newParentId: string | null, index: number) =>
    invoke<ProjectInfo>("move_node", { id, newParentId, index }),
  updateNodeMeta: (
    id: string,
    patch: {
      synopsis?: string;
      status?: string;
      /** "" löscht die Farbe. */
      color?: string;
      tags?: string[];
      /** Kartenbild (rel. Pfad unter images/); "" entfernt es. */
      image?: string;
    },
  ) => invoke<ProjectInfo>("update_node_meta", { id, ...patch }),
  deleteNode: (id: string) => invoke<ProjectInfo>("delete_node", { id }),
  checkExternalChanges: () => invoke<string[]>("check_external_changes"),

  listEntities: (kind: EntityKind) => invoke<Entity[]>("list_entities", { kind }),
  saveEntity: (kind: EntityKind, entity: Entity) =>
    invoke<Entity>("save_entity", { kind, entity }),
  deleteEntity: (kind: EntityKind, id: string) =>
    invoke<void>("delete_entity", { kind, id }),
  setEntityImage: (kind: EntityKind, id: string, sourcePath: string) =>
    invoke<Entity>("set_entity_image", { kind, id, sourcePath }),
  getEntityImage: (kind: EntityKind, id: string) =>
    invoke<string | null>("get_entity_image", { kind, id }),

  /** Patcht nur Name und/oder Szenen-Verknüpfungen (liest den Rest von Platte). */
  updateEntityMeta: (
    kind: EntityKind,
    id: string,
    patch: { name?: string; sceneIds?: string[] },
  ) => invoke<Entity>("update_entity_meta", { kind, id, ...patch }),
  readEntityDoc: (kind: EntityKind, id: string) =>
    invoke<string>("read_entity_doc", { kind, id }),
  writeEntityDoc: (kind: EntityKind, id: string, content: string, force = false) =>
    invoke<WriteResult>("write_entity_doc", { kind, id, content, force }),

  /** Speichert ein eingefügtes Bild unter images/; liefert den relativen Pfad. */
  saveDocImage: (dataBase64: string, ext: string) =>
    invoke<string>("save_doc_image", { dataBase64, ext }),
  /** Kopiert eine Bilddatei (Dateidialog) nach images/; liefert den relativen Pfad. */
  importDocImage: (sourcePath: string) =>
    invoke<string>("import_doc_image", { sourcePath }),
  /** Dokument-Bild als data-URL (null, wenn die Datei fehlt). */
  readDocImage: (rel: string) => invoke<string | null>("read_doc_image", { rel }),

  listNotes: () => invoke<NoteInfo[]>("list_notes"),
  createNote: (title: string) => invoke<NoteInfo[]>("create_note", { title }),
  renameNote: (id: string, title: string) =>
    invoke<NoteInfo[]>("rename_note", { id, title }),
  deleteNote: (id: string) => invoke<NoteInfo[]>("delete_note", { id }),
  readNote: (id: string) => invoke<string>("read_note", { id }),
  writeNote: (id: string, content: string, force = false) =>
    invoke<WriteResult>("write_note", { id, content, force }),

  loadTimeline: () => invoke<TimelineEvent[]>("load_timeline"),
  saveTimeline: (events: TimelineEvent[]) =>
    invoke<TimelineEvent[]>("save_timeline", { events }),

  searchProject: (query: string) => invoke<SearchHit[]>("search_project", { query }),

  /** Sicherungspunkt über das ganze Projekt; true = es gab etwas zu sichern. */
  snapshot: (message: string | null = null) => invoke<boolean>("snapshot", { message }),
  listHistory: (rel: string) => invoke<VersionInfo[]>("list_history", { rel }),
  getVersion: (commitId: string, rel: string) =>
    invoke<string>("get_version", { commitId, rel }),
  /** Stellt eine Version wieder her und liefert den Inhalt zurück. */
  restoreVersion: (commitId: string, rel: string) =>
    invoke<string>("restore_version", { commitId, rel }),

  listExportTemplates: () => invoke<ExportTemplate[]>("list_export_templates"),
  saveExportTemplate: (template: ExportTemplate) =>
    invoke<ExportTemplate[]>("save_export_template", { template }),
  deleteExportTemplate: (id: string) =>
    invoke<ExportTemplate[]>("delete_export_template", { id }),
  /** Exportiert die ausgewählten Binder-Teile; liefert den finalen Dateipfad. */
  exportProject: (
    format: ExportFormat,
    template: ExportTemplate,
    includeIds: string[],
    outPath: string,
  ) => invoke<string>("export_project", { format, template, includeIds, outPath }),

  /** App-weite Einstellungen (Phase 7); Schema gehört dem Frontend. */
  loadSettings: () => invoke<unknown>("load_settings"),
  saveSettings: (settings: unknown) => invoke<void>("save_settings", { settings }),
};

/** Projektrelativer Pfad einer Szenendatei (muss zum Rust-Backend passen). */
export const sceneRelPath = (id: string) => `manuscript/${id}.md`;
