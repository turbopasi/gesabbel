import { create } from "zustand";
import { api, sceneRelPath } from "./api";
import { loadNormVariant, saveNormVariant, type NormVariant } from "./stats";
import { findNode } from "./tree";
import type { NodeKind, ProjectInfo } from "./types";

export type SaveState = "saved" | "dirty" | "saving" | "conflict";
export type PaneId = "left" | "right";
export type ResearchTab = "characters" | "locations" | "notes" | "timeline";

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
  /** Hauptansicht: Schreiben (Panes) oder Recherche (Personen/Orte/Notizen/Zeitstrahl). */
  view: "write" | "research";
  setView: (view: "write" | "research") => void;
  researchTab: ResearchTab;
  setResearchTab: (tab: ResearchTab) => void;
  /** Ausgewählter Eintrag pro Recherche-Tab (Notizen, Personen, Orte). */
  researchSelected: Record<string, string | null>;
  setResearchSelected: (tab: ResearchTab, id: string | null) => void;
  /** Öffnet einen Recherche-Eintrag (z. B. aus der Suche heraus). */
  openResearchItem: (tab: ResearchTab, id: string) => void;
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

  /** Szene, deren Verlauf gerade angezeigt wird (null = Modal geschlossen). */
  historyFor: string | null;
  setHistoryFor: (sceneId: string | null) => void;
  /** Export-Dialog (Phase 6). */
  exportOpen: boolean;
  setExportOpen: (open: boolean) => void;
  /** Kurzes Feedback nach manuellem Sicherungspunkt (Titelleiste). */
  snapshotNotice: string | null;
  /** Sicherungspunkt über das ganze Projekt; ohne message automatisch (still). */
  takeSnapshot: (message?: string) => Promise<void>;
  restoreVersion: (sceneId: string, commitId: string) => Promise<void>;
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
      // Letzten Stand sichern, bevor das Projekt zugeht.
      await api.snapshot("Automatischer Sicherungspunkt (Projekt geschlossen)").catch(() => {});
      await api.closeProject().catch(() => {});
      resetView(null);
      set({ focusMode: false, historyFor: null, exportOpen: false });
    },

    selectScene: async (id) => {
      set({ view: "write" });
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
      set({ view: "write" });
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

    view: "write",
    setView: (view) => {
      // Beim Verlassen der Schreibansicht offene Änderungen sichern.
      if (view === "research") void get().flushAll();
      set({ view });
    },
    researchTab: "characters",
    setResearchTab: (tab) => set({ researchTab: tab }),
    researchSelected: {},
    setResearchSelected: (tab, id) =>
      set((s) => ({ researchSelected: { ...s.researchSelected, [tab]: id } })),
    openResearchItem: (tab, id) =>
      set((s) => ({
        view: "research",
        researchTab: tab,
        researchSelected: { ...s.researchSelected, [tab]: id },
      })),

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

    historyFor: null,
    setHistoryFor: (sceneId) => set({ historyFor: sceneId }),

    exportOpen: false,
    setExportOpen: (open) => {
      // Vor dem Export offene Änderungen auf Platte bringen.
      if (open) void get().flushAll();
      set({ exportOpen: open });
    },

    snapshotNotice: null,

    takeSnapshot: async (message) => {
      if (!get().project) return;
      await get().flushAll();
      try {
        const committed = await api.snapshot(message ?? null);
        if (message) {
          set({
            snapshotNotice: committed
              ? "✓ Sicherungspunkt gesetzt"
              : "Keine Änderungen seit dem letzten Sicherungspunkt",
          });
          setTimeout(() => set({ snapshotNotice: null }), 4000);
        }
      } catch (e) {
        // Automatische Sicherungen dürfen den Schreibfluss nicht stören.
        if (message) fail(e);
      }
    },

    restoreVersion: async (sceneId, commitId) => {
      await get().flushAll();
      try {
        const content = await api.restoreVersion(commitId, sceneRelPath(sceneId));
        for (const paneId of ["left", "right"] as PaneId[]) {
          const pane = get().panes[paneId];
          if (pane.sceneId === sceneId) {
            patchPane(paneId, {
              content,
              saveState: "saved",
              loadCounter: pane.loadCounter + 1,
            });
          }
        }
        set({ historyFor: null });
      } catch (e) {
        fail(e);
      }
    },
  };
});
