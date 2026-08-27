import { useMemo } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import { useStore, type PaneId } from "../store";
import { computeStats, formatNorm } from "../stats";

export function RichEditor({ paneId }: { paneId: PaneId }) {
  const pane = useStore((s) => s.panes[paneId]);
  const isActive = useStore((s) => s.activePane === paneId && s.splitOpen);
  const setActivePane = useStore((s) => s.setActivePane);

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
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Markdown.configure({ html: false }),
    ],
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
      <StatusBar editor={editor} paneId={paneId} />
    </>
  );
}

/** tiptap-markdown liefert keine Storage-Typen für sein Editor-Storage-Feld. */
function getMarkdown(editor: Editor): string {
  return (editor.storage as unknown as { markdown: { getMarkdown(): string } }).markdown.getMarkdown();
}

function centerCaret(editor: Editor) {
  requestAnimationFrame(() => {
    const { node } = editor.view.domAtPos(editor.state.selection.head);
    const el = node instanceof Text ? node.parentElement : (node as HTMLElement);
    el?.scrollIntoView({ block: "center" });
  });
}

function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      h1: editor.isActive("heading", { level: 1 }),
      h2: editor.isActive("heading", { level: 2 }),
      h3: editor.isActive("heading", { level: 3 }),
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
    }),
  });

  const btn = (
    label: string,
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
      {btn("F", "Fett (Strg+B)", state.bold, () => chain().toggleBold().run())}
      {btn("K", "Kursiv (Strg+I)", state.italic, () => chain().toggleItalic().run())}
      <span className="sep" />
      {btn("H1", "Überschrift 1", state.h1, () => chain().toggleHeading({ level: 1 }).run())}
      {btn("H2", "Überschrift 2", state.h2, () => chain().toggleHeading({ level: 2 }).run())}
      {btn("H3", "Überschrift 3", state.h3, () => chain().toggleHeading({ level: 3 }).run())}
      {btn("¶", "Absatz", false, () => chain().setParagraph().run())}
      <span className="sep" />
      {btn("↶", "Rückgängig (Strg+Z)", false, () => chain().undo().run(), !state.canUndo)}
      {btn("↷", "Wiederholen (Strg+Y)", false, () => chain().redo().run(), !state.canRedo)}
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
    conflict: "⚠ Konflikt",
  };

  return (
    <footer className="statusbar">
      <span>{saveLabel[saveState]}</span>
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
        ⌨
      </button>
      <button
        title="Verlauf dieser Szene: frühere Versionen ansehen und wiederherstellen"
        onClick={() => sceneId && setHistoryFor(sceneId)}
      >
        🕘 Verlauf
      </button>
    </footer>
  );
}
