import { create } from "zustand";
import { api } from "./api";
import type { NodeKind, ProjectInfo } from "./types";

export type SaveState = "saved" | "dirty" | "saving" | "conflict";

const AUTOSAVE_MS = 2000;
const RECENTS_KEY = "schreibsoftware.recents";

let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

export function loadRecents(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function pushRecent(path: string) {
  const recents = [path, ...loadRecents().filter((p) => p !== path)].slice(0, 8);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(recents));
}

interface Store {
  project: ProjectInfo | null;
  currentSceneId: string | null;
  sceneContent: string;
  saveState: SaveState;
  /** Projektrelative Pfade, die extern (Dropbox, zweite Maschine, …) geändert wurden. */
  externalChanges: string[];
  error: string | null;

  createProject: (parentDir: string, name: string, author: string) => Promise<void>;
  openProject: (path: string) => Promise<void>;
  closeProject: () => Promise<void>;
  selectScene: (id: string) => Promise<void>;
  setContent: (content: string) => void;
  flushSave: () => Promise<void>;
  resolveConflict: (action: "overwrite" | "reload") => Promise<void>;
  createNode: (parentId: string | null, kind: NodeKind, title: string) => Promise<void>;
  renameNode: (id: string, title: string) => Promise<void>;
  moveNode: (id: string, newParentId: string | null, index: number) => Promise<void>;
  deleteNode: (id: string) => Promise<void>;
  checkExternalChanges: () => Promise<void>;
  reloadProject: () => Promise<void>;
  clearError: () => void;
}

export const useStore = create<Store>((set, get) => {
  const scheduleAutosave = () => {
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => void get().flushSave(), AUTOSAVE_MS);
  };

  const fail = (e: unknown) => set({ error: String(e) });

  return {
    project: null,
    currentSceneId: null,
    sceneContent: "",
    saveState: "saved",
    externalChanges: [],
    error: null,

    createProject: async (parentDir, name, author) => {
      try {
        const project = await api.createProject(parentDir, name, name, author);
        pushRecent(project.root);
        set({ project, currentSceneId: null, sceneContent: "", saveState: "saved" });
      } catch (e) {
        fail(e);
      }
    },

    openProject: async (path) => {
      try {
        const project = await api.openProject(path);
        pushRecent(project.root);
        set({
          project,
          currentSceneId: null,
          sceneContent: "",
          saveState: "saved",
          externalChanges: [],
        });
      } catch (e) {
        fail(e);
      }
    },

    closeProject: async () => {
      await get().flushSave();
      await api.closeProject().catch(() => {});
      set({ project: null, currentSceneId: null, sceneContent: "", saveState: "saved" });
    },

    selectScene: async (id) => {
      const { currentSceneId, flushSave } = get();
      if (id === currentSceneId) return;
      await flushSave();
      try {
        const content = await api.readScene(id);
        set({ currentSceneId: id, sceneContent: content, saveState: "saved" });
      } catch (e) {
        fail(e);
      }
    },

    setContent: (content) => {
      set({ sceneContent: content, saveState: "dirty" });
      scheduleAutosave();
    },

    flushSave: async () => {
      const { currentSceneId, sceneContent, saveState } = get();
      if (!currentSceneId || saveState !== "dirty") return;
      if (autosaveTimer) clearTimeout(autosaveTimer);
      set({ saveState: "saving" });
      try {
        const result = await api.writeScene(currentSceneId, sceneContent);
        if (result.status === "conflict") {
          set({ saveState: "conflict" });
        } else {
          // Nur "saved", wenn währenddessen nicht weitergetippt wurde.
          if (get().sceneContent === sceneContent) set({ saveState: "saved" });
          else set({ saveState: "dirty" });
        }
      } catch (e) {
        set({ saveState: "dirty" });
        fail(e);
      }
    },

    resolveConflict: async (action) => {
      const { currentSceneId, sceneContent } = get();
      if (!currentSceneId) return;
      try {
        if (action === "overwrite") {
          await api.writeScene(currentSceneId, sceneContent, true);
          set({ saveState: "saved" });
        } else {
          const content = await api.readScene(currentSceneId);
          set({ sceneContent: content, saveState: "saved" });
        }
      } catch (e) {
        fail(e);
      }
    },

    createNode: async (parentId, kind, title) => {
      try {
        set({ project: await api.createNode(parentId, kind, title) });
      } catch (e) {
        fail(e);
      }
    },

    renameNode: async (id, title) => {
      try {
        set({ project: await api.renameNode(id, title) });
      } catch (e) {
        fail(e);
      }
    },

    moveNode: async (id, newParentId, index) => {
      try {
        set({ project: await api.moveNode(id, newParentId, index) });
      } catch (e) {
        fail(e);
      }
    },

    deleteNode: async (id) => {
      try {
        const project = await api.deleteNode(id);
        const current = get().currentSceneId;
        const gone = current !== null && !findInProject(project, current);
        set({
          project,
          ...(gone ? { currentSceneId: null, sceneContent: "", saveState: "saved" as const } : {}),
        });
      } catch (e) {
        fail(e);
      }
    },

    checkExternalChanges: async () => {
      if (!get().project) return;
      try {
        set({ externalChanges: await api.checkExternalChanges() });
      } catch {
        // still: Fokus-Check darf nie stören
      }
    },

    reloadProject: async () => {
      const root = get().project?.root;
      if (!root) return;
      await get().openProject(root);
    },

    clearError: () => set({ error: null }),
  };
});

function findInProject(project: ProjectInfo, id: string): boolean {
  const walk = (nodes: { id: string; children: any[] }[]): boolean =>
    nodes.some((n) => n.id === id || walk(n.children));
  return walk(project.meta.binder);
}
