import { invoke } from "@tauri-apps/api/core";
import type {
  Entity,
  EntityKind,
  NodeKind,
  NoteInfo,
  ProjectInfo,
  SearchHit,
  TimelineEvent,
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
};
