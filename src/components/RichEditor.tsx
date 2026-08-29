import { useMemo, type ReactNode } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import { useStore, type PaneId } from "../store";
import { computeStats, formatNorm } from "../stats";
import { DocImage, imagePasteHandler } from "./DocImage";
import { PlanTag } from "./PlanTag";
import { PlanTagCommand } from "./planTagCommand";
import { PlanTagOverlay } from "./PlanTagOverlay";
import { Icon } from "./Icon";
import {
  AlignedHeading,
  AlignedParagraph,
  MarkdownTextAlign,
} from "./TextAlignMarkdown";

/** Gemeinsame Extensions aller Dokument-Editoren (Szenen wie Recherche). */
export function docExtensions() {
  return [
    // Paragraph/Heading kommen als Varianten mit Ausrichtungs-Serialisierung.
    StarterKit.configure({ paragraph: false, heading: false }),
    AlignedParagraph,
    AlignedHeading.configure({ levels: [1, 2, 3] }),
    // html: true, damit die div-Wrapper der Ausrichtung beim Laden greifen.
    Markdown.configure({ html: true }),
    MarkdownTextAlign.configure({ types: ["heading", "paragraph"] }),
    DocImage,
    // Planungs-Tags (/person, /location, /note) samt Slash-Kommando.
    PlanTag,
    PlanTagCommand,
  ];
}

export function RichEditor({ paneId }: { paneId: PaneId }) {
  const pane = useStore((s) => s.panes[paneId]);
  const isActive = useStore((s) => s.activePane === paneId && s.layoutMode !== "single");
  const setActivePane = useStore((s) => s.setActivePane);
  const openResearchInPane = useStore((s) => s.openResearchInPane);

  return (
    <section
      className={`editor ${isActive ? "pane-active" : ""}`}
      onFocusCapture={() => setActivePane(paneId)}
      onMouseDownCapture={() => setActivePane(paneId)}
    >
      {pane.sceneId ? (
        <EditorInstance
          key={`${pane.sceneId}:${pane.loadCounter}`}
          paneId={paneId}
          initialContent={pane.content}
        />
      ) : (
        <div className="editor empty">
          <p className="muted">Wähle im Binder eine Szene für diesen Bereich aus.</p>
          <p className="muted small">… oder zeige hier Planungsinhalte an:</p>
          <div className="empty-research-buttons">
            <button onClick={() => void openResearchInPane(paneId, "characters", null)}>
              👤 Personen
            </button>
            <button onClick={() => void openResearchInPane(paneId, "locations", null)}>
              📍 Orte
            </button>
            <button onClick={() => void openResearchInPane(paneId, "notes", null)}>
              🗒 Notizen
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/** Pro Szene neu gemountet (via key) → frischer Undo/Redo-Stack pro Dokument. */
function EditorInstance({
  paneId,
  initialContent,
}: {
  paneId: PaneId;
  initialContent: string;
}) {
  const setContent = useStore((s) => s.setContent);

  const editor = useEditor({
    extensions: docExtensions(),
    editorProps: { handlePaste: imagePasteHandler },
    content: initialContent,
    autofocus: true,
    onUpdate: ({ editor }) => {
      setContent(paneId, getMarkdown(editor));
      if (useStore.getState().typewriter) centerCaret(editor);
    },
    onSelectionUpdate: ({ editor }) => {
      if (useStore.getState().typewriter) centerCaret(editor);
    },
  });

  const typewriter = useStore((s) => s.typewriter);

  if (!editor) return null;

  return (
    <>
      <Toolbar editor={editor} />
      <EditorContent
        editor={editor}
        className={`editor-content ${typewriter ? "typewriter" : ""}`}
      />
      <PlanTagOverlay editor={editor} paneId={paneId} />
      <StatusBar editor={editor} paneId={paneId} />
    </>
  );
}

/** tiptap-markdown liefert keine Storage-Typen für sein Editor-Storage-Feld. */
export function getMarkdown(editor: Editor): string {
  return (editor.storage as unknown as { markdown: { getMarkdown(): string } }).markdown.getMarkdown();
}

function centerCaret(editor: Editor) {
  requestAnimationFrame(() => {
    const { node } = editor.view.domAtPos(editor.state.selection.head);
    const el = node instanceof Text ? node.parentElement : (node as HTMLElement);
    el?.scrollIntoView({ block: "center" });
  });
}

/** Balken-Icon für die Ausrichtungs-Buttons. */
function AlignIcon({ variant }: { variant: "left" | "center" | "right" | "justify" }) {
  const widths: Record<string, [number, number, number, number]> = {
    left: [12, 8, 12, 8],
    center: [12, 8, 12, 8],
    right: [12, 8, 12, 8],
    justify: [12, 12, 12, 12],
  };
  const x = (w: number) =>
    variant === "center" ? (12 - w) / 2 : variant === "right" ? 12 - w : 0;
  return (
    <svg width="12" height="11" viewBox="0 0 12 11" aria-hidden="true">
      {widths[variant].map((w, i) => (
        <rect key={i} x={x(w)} y={i * 3} width={w} height="1.6" rx="0.8" fill="currentColor" />
      ))}
    </svg>
  );
}

export function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      h1: editor.isActive("heading", { level: 1 }),
      h2: editor.isActive("heading", { level: 2 }),
      h3: editor.isActive("heading", { level: 3 }),
      alignLeft: editor.isActive({ textAlign: "left" }),
      alignCenter: editor.isActive({ textAlign: "center" }),
      alignRight: editor.isActive({ textAlign: "right" }),
      alignJustify: editor.isActive({ textAlign: "justify" }),
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
    }),
  });

  // Ohne explizite Absatz-Ausrichtung gilt die Grundeinstellung aus den
  // Editor-Einstellungen — die Buttons zeigen die tatsächliche Darstellung.
  const defaultAlignment = useStore((s) => s.settings.editor.defaultAlignment);
  const explicitAlign = state.alignLeft
    ? "left"
    : state.alignCenter
      ? "center"
      : state.alignRight
        ? "right"
        : state.alignJustify
          ? "justify"
          : null;
  const effectiveAlign = explicitAlign ?? defaultAlignment;

  const btn = (
    label: ReactNode,
    title: string,
    active: boolean,
    action: () => void,
    disabled = false,
  ) => (
    <button
      className={active ? "on" : ""}
      title={title}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault() /* Fokus bleibt im Editor */}
      onClick={action}
    >
      {label}
    </button>
  );

  const chain = () => editor.chain().focus();

  return (
    <div className="toolbar">
      {btn(<Icon name="bold" size={14} />, "Fett (Strg+B)", state.bold, () =>
        chain().toggleBold().run(),
      )}
      {btn(<Icon name="italic" size={14} />, "Kursiv (Strg+I)", state.italic, () =>
        chain().toggleItalic().run(),
      )}
      <span className="sep" />
      {btn("H1", "Überschrift 1", state.h1, () => chain().toggleHeading({ level: 1 }).run())}
      {btn("H2", "Überschrift 2", state.h2, () => chain().toggleHeading({ level: 2 }).run())}
      {btn("H3", "Überschrift 3", state.h3, () => chain().toggleHeading({ level: 3 }).run())}
      {btn(<Icon name="pilcrow" size={14} />, "Absatz", false, () =>
        chain().setParagraph().run(),
      )}
      <span className="sep" />
      {btn(
        <AlignIcon variant="left" />,
        "Linksbündig",
        effectiveAlign === "left",
        () => chain().toggleTextAlign("left").run(),
      )}
      {btn(
        <AlignIcon variant="center" />,
        "Zentriert",
        effectiveAlign === "center",
        () => chain().toggleTextAlign("center").run(),
      )}
      {btn(
        <AlignIcon variant="right" />,
        "Rechtsbündig",
        effectiveAlign === "right",
        () => chain().toggleTextAlign("right").run(),
      )}
      {btn(
        <AlignIcon variant="justify" />,
        "Blocksatz",
        effectiveAlign === "justify",
        () => chain().toggleTextAlign("justify").run(),
      )}
      <span className="sep" />
      {btn(
        <Icon name="undo-2" size={14} />,
        "Rückgängig (Strg+Z)",
        false,
        () => chain().undo().run(),
        !state.canUndo,
      )}
      {btn(
        <Icon name="redo-2" size={14} />,
        "Wiederholen (Strg+Y)",
        false,
        () => chain().redo().run(),
        !state.canRedo,
      )}
    </div>
  );
}

function StatusBar({ editor, paneId }: { editor: Editor; paneId: PaneId }) {
  const saveState = useStore((s) => s.panes[paneId].saveState);
  const sceneId = useStore((s) => s.panes[paneId].sceneId);
  const setHistoryFor = useStore((s) => s.setHistoryFor);
  const normVariant = useStore((s) => s.normVariant);
  const setNormVariant = useStore((s) => s.setNormVariant);
  const typewriter = useStore((s) => s.typewriter);
  const toggleTypewriter = useStore((s) => s.toggleTypewriter);

  const text = useEditorState({
    editor,
    selector: ({ editor }) =>
      editor.state.doc.textBetween(0, editor.state.doc.content.size, "\n", "\n"),
  });
  const stats = useMemo(() => computeStats(text), [text]);
  const norm = normVariant === "1800" ? stats.norm1800 : stats.norm30x60;

  const saveLabel: Record<string, string> = {
    saved: "Gespeichert",
    dirty: "Ungespeichert …",
    saving: "Speichert …",
    conflict: "Konflikt",
  };

  return (
    <footer className="statusbar">
      <span className={saveState === "conflict" ? "save-state conflict" : "save-state"}>
        {saveLabel[saveState]}
      </span>
      <span className="spacer" />
      <span>{stats.words.toLocaleString("de-DE")} Wörter</span>
      <span title="Zeichen inkl. Leerzeichen / ohne Leerzeichen">
        {stats.charsWithSpaces.toLocaleString("de-DE")} /{" "}
        {stats.charsWithoutSpaces.toLocaleString("de-DE")} Zeichen
      </span>
      <span>
        {formatNorm(norm)} Normseiten{" "}
        <select
          value={normVariant}
          onChange={(e) => setNormVariant(e.target.value as "1800" | "30x60")}
          title="Normseiten-Zählweise"
        >
          <option value="1800">1800 Zeichen</option>
          <option value="30x60">30 × 60</option>
        </select>
      </span>
      <button
        className={typewriter ? "on" : ""}
        title="Typewriter-Scrolling: Cursorzeile bleibt mittig"
        onClick={toggleTypewriter}
      >
        <Icon name="keyboard" size={14} />
      </button>
      <button
        title="Verlauf dieser Szene: frühere Versionen ansehen und wiederherstellen"
        onClick={() => sceneId && setHistoryFor(sceneId)}
      >
        <Icon name="history" size={14} />
        Verlauf
      </button>
    </footer>
  );
}
