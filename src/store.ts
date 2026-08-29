import { create } from "zustand";
import { api, sceneRelPath } from "./api";
import { clearPlanTagAvatars } from "./components/planTagInfo";
import {
  applySettings,
  defaultSettings,
  mergeSettings,
  type AppSettings,
} from "./settings";
import { loadNormVariant, saveNormVariant, type NormVariant } from "./stats";
import { findNode } from "./tree";
import type { NodeKind, ProjectInfo } from "./types";

export type SaveState = "saved" | "dirty" | "saving" | "conflict";
export type PaneId = "leftTop" | "leftBottom" | "rightTop" | "rightBottom";
/** Recherche-Inhalte, die in einem Pane angezeigt werden können. */
export type PaneResearchKind = "characters" | "locations" | "notes";

export const PANE_IDS: PaneId[] = ["leftTop", "leftBottom", "rightTop", "rightBottom"];

export type LayoutMode = "single" | "cols" | "leftSplit" | "rightSplit" | "grid";

export const LAYOUT_MODES: LayoutMode[] = ["single", "cols", "leftSplit", "rightSplit", "grid"];

export const PANES_FOR_MODE: Record<LayoutMode, PaneId[]> = {
  single: ["leftTop"],
  cols: ["leftTop", "rightTop"],
  leftSplit: ["leftTop", "leftBottom", "rightTop"],
  rightSplit: ["leftTop", "rightTop", "rightBottom"],
  grid: PANE_IDS,
};

/** Auswählbares Ziel für Planungs-Tags (Person, Ort, Notiz). */
export interface PlanIndexEntry {
  id: string;
  name: string;
  /** Person/Ort mit hinterlegtem Bild — für die Vorschau beim Überfahren. */
  hasImage: boolean;
}

export type PlanIndex = Record<PaneResearchKind, PlanIndexEntry[]>;

const emptyPlanIndex = (): PlanIndex => ({ characters: [], locations: [], notes: [] });

export interface Pane {
  sceneId: string | null;
  /** Kapitel-ID, wenn dieser Pane das Corkboard eines Kapitels zeigt (statt Editor). */
  corkboardId: string | null;
  /** Recherche-Inhalt (Person/Ort/Notiz) statt Editor. */
  researchKind: PaneResearchKind | null;
  /** Ausgewähltes Recherche-Item dieses Panes. */
  researchId: string | null;
  /** Zeigt den Zeitstrahl über dem sonstigen Inhalt dieses Panes.
   *  Bewusst kein Ersatz für sceneId/corkboardId: Ausschalten kehrt zurück. */
  timeline: boolean;
  /** Markdown — aktuellster Stand aus dem Editor. */
  content: string;
  saveState: SaveState;
  /** Erhöht sich, wenn Inhalt von außen neu geladen wurde → Editor remountet. */
  loadCounter: number;
}

const AUTOSAVE_MS = 2000;
const RECENTS_KEY = "gesabbel.recents";
const TYPEWRITER_KEY = "gesabbel.typewriter";

const emptyPane = (): Pane => ({
  sceneId: null,
  corkboardId: null,
  researchKind: null,
  researchId: null,
  timeline: false,
  content: "",
  saveState: "saved",
  loadCounter: 0,
});

const emptyPanes = (): Record<PaneId, Pane> =>
  Object.fromEntries(PANE_IDS.map((id) => [id, emptyPane()])) as Record<PaneId, Pane>;

const autosaveTimers: Record<PaneId, ReturnType<typeof setTimeout> | null> = {
  leftTop: null,
  leftBottom: null,
  rightTop: null,
  rightBottom: null,
};

let settingsPersistTimer: ReturnType<typeof setTimeout> | null = null;

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
  layoutMode: LayoutMode;
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
    patch: {
      synopsis?: string;
      status?: string;
      color?: string;
      tags?: string[];
      /** Kartenbild (rel. Pfad unter images/); "" entfernt es. */
      image?: string;
    },
  ) => Promise<void>;
  quickNavOpen: boolean;
  setQuickNavOpen: (open: boolean) => void;
  /** Blendet den Zeitstrahl in einem Pane ein/aus (Inhalt darunter bleibt erhalten). */
  setPaneTimeline: (paneId: PaneId, on: boolean) => Promise<void>;
  setContent: (paneId: PaneId, content: string) => void;
  flushPane: (paneId: PaneId) => Promise<void>;
  flushAll: () => Promise<void>;
  resolveConflict: (paneId: PaneId, action: "overwrite" | "reload") => Promise<void>;
  setActivePane: (paneId: PaneId) => void;
  /** Wechselt das Split-Layout; schließende Panes werden vorher gespeichert. */
  setLayoutMode: (mode: LayoutMode) => Promise<void>;
  /** Schaltet der Reihe nach durch die Layout-Modi (Shortcut). */
  cycleLayout: () => Promise<void>;
  /** Öffnet Person/Ort/Notiz in einem Pane (id = null → leere Auswahl). */
  openResearchInPane: (paneId: PaneId, kind: PaneResearchKind, id: string | null) => Promise<void>;
  setPaneResearchId: (paneId: PaneId, id: string | null) => void;
  /** Öffnet Person/Ort/Notiz in einem anderen sichtbaren Pane (Klick auf einen
   *  Planungs-Tag im Text) — teilt notfalls das Layout auf. */
  openResearchNextTo: (
    paneId: PaneId,
    kind: PaneResearchKind,
    id: string,
  ) => Promise<void>;
  /** Wie `openResearchNextTo`, nur für eine Szene (Sprung aus einer Fundstelle). */
  openSceneNextTo: (paneId: PaneId, sceneId: string) => Promise<void>;
  /** Zähler als Refresh-Signal nach Anlegen/Speichern/Löschen von Recherche-Daten. */
  researchVersion: number;
  touchResearch: () => void;
  /** Personen/Orte/Notizen für die Tag-Auswahl und die Hover-Vorschau. */
  planIndex: PlanIndex;
  refreshPlanIndex: () => Promise<void>;
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

  /** App-weite Einstellungen (Phase 7): Theme, Editor, Layout, Kürzel. */
  settings: AppSettings;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  /** Lädt gespeicherte Einstellungen vom Backend und wendet sie an. */
  initSettings: () => Promise<void>;
  /** Wendet die Änderung sofort an und persistiert debounced. */
  updateSettings: (patch: Partial<AppSettings>) => void;
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

  /** Bereich für einen Sprung aus `paneId` heraus — bevorzugt einer, in dem
   *  gerade kein Text bearbeitet wird; im Einzel-Layout wird aufgeteilt. */
  const neighbourPane = async (paneId: PaneId): Promise<PaneId> => {
    const visible = PANES_FOR_MODE[get().layoutMode];
    const free = visible.find((p) => p !== paneId && !get().panes[p].sceneId);
    const other = free ?? visible.find((p) => p !== paneId);
    if (other) return other;
    await get().setLayoutMode("cols");
    return paneId === "rightTop" ? "leftTop" : "rightTop";
  };

  const resetView = (project: ProjectInfo | null) => {
    set({
      project,
      panes: emptyPanes(),
      layoutMode: "single",
      activePane: "leftTop" as PaneId,
      externalChanges: [],
    });
    void get().refreshPlanIndex();
  };

  return {
    project: null,
    panes: emptyPanes(),
    layoutMode: "single",
    activePane: "leftTop",
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
      const paneId = get().activePane;
      const pane = get().panes[paneId];
      if (pane.sceneId === id && !pane.corkboardId && !pane.researchKind) {
        // Gleiche Szene: nur einen darüberliegenden Zeitstrahl wegblenden.
        if (pane.timeline) patchPane(paneId, { timeline: false });
        return;
      }
      await get().flushPane(paneId);
      try {
        const content = await api.readScene(id);
        patchPane(paneId, {
          sceneId: id,
          corkboardId: null,
          researchKind: null,
          researchId: null,
          timeline: false,
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
      if (get().panes[paneId].corkboardId === id) {
        if (get().panes[paneId].timeline) patchPane(paneId, { timeline: false });
        return;
      }
      await get().flushPane(paneId);
      patchPane(paneId, {
        sceneId: null,
        corkboardId: id,
        researchKind: null,
        researchId: null,
        timeline: false,
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

    setPaneTimeline: async (paneId, on) => {
      if (get().panes[paneId].timeline === on) {
        set({ activePane: paneId });
        return;
      }
      // Zweimal geöffnet würden beide Zeitstrahl-Panes unabhängig speichern
      // und sich gegenseitig überschreiben — stattdessen den offenen aktivieren.
      if (on) {
        const open = PANES_FOR_MODE[get().layoutMode].find((p) => get().panes[p].timeline);
        if (open) {
          set({ activePane: open });
          return;
        }
      }
      // Beim Verdecken des Editors offene Änderungen sichern.
      if (on) await get().flushPane(paneId);
      patchPane(paneId, { timeline: on });
      set({ activePane: paneId });
    },

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
      for (const paneId of PANE_IDS) await get().flushPane(paneId);
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
      if (!PANES_FOR_MODE[get().layoutMode].includes(paneId)) return;
      set({ activePane: paneId });
    },

    setLayoutMode: async (mode) => {
      const visible = PANES_FOR_MODE[mode];
      const closing = PANES_FOR_MODE[get().layoutMode].filter((id) => !visible.includes(id));
      // Ungelöste Konflikte in schließenden Panes würden sonst stumm verworfen.
      if (closing.some((id) => get().panes[id].saveState === "conflict")) {
        set({ error: "Bitte zuerst den Schreibkonflikt im betroffenen Bereich lösen." });
        return;
      }
      for (const id of closing) await get().flushPane(id);
      set((s) => ({
        layoutMode: mode,
        activePane: visible.includes(s.activePane) ? s.activePane : "leftTop",
        panes: {
          ...s.panes,
          ...Object.fromEntries(closing.map((id) => [id, emptyPane()])),
        },
      }));
    },

    cycleLayout: async () => {
      const i = LAYOUT_MODES.indexOf(get().layoutMode);
      await get().setLayoutMode(LAYOUT_MODES[(i + 1) % LAYOUT_MODES.length]);
    },

    openResearchInPane: async (paneId, kind, id) => {
      // Dieselbe Notiz doppelt zu öffnen provoziert Autosave-Konflikte —
      // stattdessen den Pane aktivieren, der sie schon zeigt.
      if (id) {
        const open = PANES_FOR_MODE[get().layoutMode].find(
          (p) => get().panes[p].researchKind === kind && get().panes[p].researchId === id,
        );
        if (open) {
          if (get().panes[open].timeline) patchPane(open, { timeline: false });
          set({ activePane: open });
          return;
        }
      }
      await get().flushPane(paneId);
      patchPane(paneId, {
        sceneId: null,
        corkboardId: null,
        researchKind: kind,
        researchId: id,
        timeline: false,
        content: "",
        saveState: "saved",
      });
      set({ activePane: paneId });
    },

    setPaneResearchId: (paneId, id) => patchPane(paneId, { researchId: id }),

    openResearchNextTo: async (paneId, kind, id) => {
      const target = await neighbourPane(paneId);
      await get().openResearchInPane(target, kind, id);
    },

    openSceneNextTo: async (paneId, sceneId) => {
      const target = await neighbourPane(paneId);
      set({ activePane: target });
      await get().selectScene(sceneId);
    },

    researchVersion: 0,
    touchResearch: () => {
      set((s) => ({ researchVersion: s.researchVersion + 1 }));
      void get().refreshPlanIndex();
    },

    planIndex: emptyPlanIndex(),

    refreshPlanIndex: async () => {
      clearPlanTagAvatars();
      if (!get().project) {
        set({ planIndex: emptyPlanIndex() });
        return;
      }
      try {
        const [characters, locations, notes] = await Promise.all([
          api.listEntities("characters"),
          api.listEntities("locations"),
          api.listNotes(),
        ]);
        const fromEntities = (list: typeof characters) =>
          list.map((e) => ({ id: e.id, name: e.name, hasImage: !!e.image }));
        set({
          planIndex: {
            characters: fromEntities(characters),
            locations: fromEntities(locations),
            notes: notes.map((n) => ({ id: n.id, name: n.title, hasImage: false })),
          },
        });
      } catch {
        // Der Index ist nur Komfort — ein Fehler darf den Editor nicht stören.
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
        for (const paneId of PANE_IDS) {
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
        for (const paneId of PANE_IDS) {
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
        for (const paneId of PANE_IDS) {
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

    settings: defaultSettings(),
    settingsOpen: false,
    setSettingsOpen: (open) => set({ settingsOpen: open }),

    initSettings: async () => {
      try {
        const settings = mergeSettings(await api.loadSettings());
        set({ settings });
        applySettings(settings);
      } catch {
        // Backend nicht erreichbar → mit Defaults weiterarbeiten.
        applySettings(get().settings);
      }
    },

    updateSettings: (patch) => {
      const settings = { ...get().settings, ...patch };
      set({ settings });
      applySettings(settings);
      if (settingsPersistTimer) clearTimeout(settingsPersistTimer);
      settingsPersistTimer = setTimeout(
        () => void api.saveSettings(get().settings).catch(() => {}),
        500,
      );
    },
  };
});
