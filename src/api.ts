import { invoke } from "@tauri-apps/api/core";
import type { NodeKind, ProjectInfo, WriteResult } from "./types";

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
};
