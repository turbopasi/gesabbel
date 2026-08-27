import { create } from "zustand";
import { api } from "./api";
import { loadNormVariant, saveNormVariant, type NormVariant } from "./stats";
import { findNode } from "./tree";
import type { NodeKind, ProjectInfo } from "./types";

export type SaveState = "saved" | "dirty" | "saving" | "conflict";
export type PaneId = "left" | "right";

export interface Pane {
  sceneId: string | null;
  /** Kapitel-ID, wenn dieser Pane das Corkboard eines Kapitels zeigt (statt Editor). */
  corkboardId: string | null;
  /** Markdown — aktuellster Stand aus dem Editor. */
  content: string;
  saveState: SaveState;
  /** Erhöht sich, wenn Inhalt von außen neu geladen wurde → Editor remountet. */
  loadCounter: number;
}

const AUTOSAVE_MS = 2000;
const RECENTS_KEY = "schreibsoftware.recents";
const TYPEWRITER_KEY = "schreibsoftware.typewriter";

const emptyPane = (): Pane => ({
  sceneId: null,
  corkboardId: null,
  content: "",
  saveState: "saved",
  loadCounter: 0,
});

const autosaveTimers: Record<PaneId, ReturnType<typeof setTimeout> | null> = {
  left: null,
  right: null,
};

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
  panes: Record<PaneId, Pane>;
  splitOpen: boolean;
  activePane: PaneId;
  focusMode: boolean;
  typewriter: boolean;
  normVariant: NormVariant;
  /** Projektrelative Pfade, die extern (Dropbox, zweite Maschine, …) geändert wurden. */
  externalChanges: string[];
  error: string | null;

  createProject: (parentDir: string, name: string, author: string) => Promise<void>;
  openProject: (path: string) => Promise<void>;
  closeProject: () => Promise<void>;
  selectScene: (id: string) => Promise<void>;
  /** Zeigt das Corkboard eines Kapitels im aktiven Pane. */
  selectChapter: (id: string) => Promise<void>;
  updateNodeMeta: (
    id: string,
    patch: { synopsis?: string; status?: string; color?: string; tags?: string[] },
  ) => Promise<void>;
  quickNavOpen: boolean;
  setQuickNavOpen: (open: boolean) => void;
  setContent: (paneId: PaneId, content: string) => void;
  flushPane: (paneId: PaneId) => Promise<void>;
  flushAll: () => Promise<void>;
  resolveConflict: (paneId: PaneId, action: "overwrite" | "reload") => Promise<void>;
  setActivePane: (paneId: PaneId) => void;
  toggleSplit: () => Promise<void>;
  toggleFocusMode: () => void;
  setFocusMode: (on: boolean) => void;
  toggleTypewriter: () => void;
  setNormVariant: (v: NormVariant) => void;
  createNode: (parentId: string | null, kind: NodeKind, title: string) => Promise<void>;
  renameNode: (id: string, title: string) => Promise<void>;
  moveNode: (id: string, newParentId: string | null, index: number) => Promise<void>;
  deleteNode: (id: string) => Promise<void>;
  checkExternalChanges: () => Promise<void>;
  reloadProject: () => Promise<void>;
  clearError: () => void;
}

export const useStore = create<Store>((set, get) => {
  const patchPane = (paneId: PaneId, patch: Partial<Pane>) =>
    set((s) => ({ panes: { ...s.panes, [paneId]: { ...s.panes[paneId], ...patch } } }));

  const scheduleAutosave = (paneId: PaneId) => {
    const t = autosaveTimers[paneId];
    if (t) clearTimeout(t);
    autosaveTimers[paneId] = setTimeout(() => void get().flushPane(paneId), AUTOSAVE_MS);
  };

  const fail = (e: unknown) => set({ error: String(e) });

  const resetView = (project: ProjectInfo | null) =>
    set({
      project,
      panes: { left: emptyPane(), right: emptyPane() },
      splitOpen: false,
      activePane: "left" as PaneId,
      externalChanges: [],
    });

  return {
    project: null,
    panes: { left: emptyPane(), right: emptyPane() },
    splitOpen: false,
    activePane: "left",
    focusMode: false,
    typewriter: localStorage.getItem(TYPEWRITER_KEY) === "1",
    normVariant: loadNormVariant(),
    externalChanges: [],
    error: null,

    createProject: async (parentDir, name, author) => {
      try {
        const project = await api.createProject(parentDir, name, name, author);
        pushRecent(project.root);
        resetView(project);
      } catch (e) {
        fail(e);
      }
    },

    openProject: async (path) => {
      try {
        const project = await api.openProject(path);
        pushRecent(project.root);
        resetView(project);
      } catch (e) {
        fail(e);
      }
    },

    closeProject: async () => {
      await get().flushAll();
      await api.closeProject().catch(() => {});
      resetView(null);
      set({ focusMode: false });
    },

    selectScene: async (id) => {
      const paneId = get().activePane;
      const pane = get().panes[paneId];
      if (pane.sceneId === id && !pane.corkboardId) return;
      await get().flushPane(paneId);
      try {
        const content = await api.readScene(id);
        patchPane(paneId, {
          sceneId: id,
          corkboardId: null,
          content,
          saveState: "saved",
          loadCounter: pane.loadCounter + 1,
        });
      } catch (e) {
        fail(e);
      }
    },

    selectChapter: async (id) => {
      const paneId = get().activePane;
      if (get().panes[paneId].corkboardId === id) return;
      await get().flushPane(paneId);
      patchPane(paneId, {
        sceneId: null,
        corkboardId: id,
        content: "",
        saveState: "saved",
      });
    },

    updateNodeMeta: async (id, patch) => {
      try {
        set({ project: await api.updateNodeMeta(id, patch) });
      } catch (e) {
        fail(e);
      }
    },

    quickNavOpen: false,
    setQuickNavOpen: (open) => set({ quickNavOpen: open }),

    setContent: (paneId, content) => {
      patchPane(paneId, { content, saveState: "dirty" });
      scheduleAutosave(paneId);
    },

    flushPane: async (paneId) => {
      const pane = get().panes[paneId];
      if (!pane.sceneId || pane.saveState !== "dirty") return;
      const t = autosaveTimers[paneId];
      if (t) clearTimeout(t);
      const written = pane.content;
      patchPane(paneId, { saveState: "saving" });
      try {
        const result = await api.writeScene(pane.sceneId, written);
        if (result.status === "conflict") {
          patchPane(paneId, { saveState: "conflict" });
        } else {
          // Nur "saved", wenn währenddessen nicht weitergetippt wurde.
          const now = get().panes[paneId];
          patchPane(paneId, { saveState: now.content === written ? "saved" : "dirty" });
        }
      } catch (e) {
        patchPane(paneId, { saveState: "dirty" });
        fail(e);
      }
    },

    flushAll: async () => {
      await get().flushPane("left");
      await get().flushPane("right");
    },

    resolveConflict: async (paneId, action) => {
      const pane = get().panes[paneId];
      if (!pane.sceneId) return;
      try {
        if (action === "overwrite") {
          await api.writeScene(pane.sceneId, pane.content, true);
          patchPane(paneId, { saveState: "saved" });
        } else {
          const content = await api.readScene(pane.sceneId);
          patchPane(paneId, {
            content,
            saveState: "saved",
            loadCounter: pane.loadCounter + 1,
          });
        }
      } catch (e) {
        fail(e);
      }
    },

    setActivePane: (paneId) => {
      if (paneId === "right" && !get().splitOpen) return;
      set({ activePane: paneId });
    },

    toggleSplit: async () => {
      if (get().splitOpen) {
        await get().flushPane("right");
        set((s) => ({
          splitOpen: false,
          activePane: "left",
          panes: { ...s.panes, right: emptyPane() },
        }));
      } else {
        set({ splitOpen: true, activePane: "right" });
      }
    },

    toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),
    setFocusMode: (on) => set({ focusMode: on }),

    toggleTypewriter: () => {
      const next = !get().typewriter;
      localStorage.setItem(TYPEWRITER_KEY, next ? "1" : "0");
      set({ typewriter: next });
    },

    setNormVariant: (v) => {
      saveNormVariant(v);
      set({ normVariant: v });
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
        set({ project });
        // Panes leeren, deren Szene/Kapitel es nicht mehr gibt.
        for (const paneId of ["left", "right"] as PaneId[]) {
          const pane = get().panes[paneId];
          const ref = pane.sceneId ?? pane.corkboardId;
          if (ref && !findNode(project.meta.binder, ref)) {
            patchPane(paneId, emptyPane());
          }
        }
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
      await get().flushAll();
      try {
        const project = await api.openProject(root);
        set({ project, externalChanges: [] });
        // Offene Szenen neu einlesen (außer bei ungelöstem Konflikt).
        for (const paneId of ["left", "right"] as PaneId[]) {
          const pane = get().panes[paneId];
          if (pane.corkboardId && !findNode(project.meta.binder, pane.corkboardId)) {
            patchPane(paneId, emptyPane());
            continue;
          }
          if (!pane.sceneId) continue;
          if (!findNode(project.meta.binder, pane.sceneId)) {
            patchPane(paneId, emptyPane());
          } else if (pane.saveState !== "conflict") {
            const content = await api.readScene(pane.sceneId);
            patchPane(paneId, {
              content,
              saveState: "saved",
              loadCounter: pane.loadCounter + 1,
            });
          }
        }
      } catch (e) {
        fail(e);
      }
    },

    clearError: () => set({ error: null }),
  };
});
