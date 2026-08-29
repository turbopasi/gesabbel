// TipTap-Mark für Planungs-Tags (siehe src/planTags.ts zum Speicherformat).
//
// Mark und nicht Node, weil das Label echter Fließtext bleiben soll: "Er",
// "Seine", "der Mann" zählen bei den Wörtern mit, der Cursor läuft normal
// hindurch und die Suche findet sie.

import { getMarkRange, Mark, mergeAttributes, type Editor } from "@tiptap/react";
import type { MarkdownSerializerState } from "prosemirror-markdown";
import type { Mark as PMMark } from "@tiptap/pm/model";
import { parsePlanTagHref, planTagHref, type PlanTagKind } from "../planTags";

export const PLAN_TAG_MARK = "planTag";

/** Hebt die Verknüpfung eines Tags auf; der Text bleibt unverändert stehen. */
export function removePlanTagAt(editor: Editor, element: HTMLElement): boolean {
  const pos = editor.view.posAtDOM(element, 0);
  if (pos < 0) return false;
  const type = editor.state.schema.marks[PLAN_TAG_MARK];
  if (!type) return false;
  const range = getMarkRange(editor.state.doc.resolve(pos), type);
  if (!range) return false;
  return editor
    .chain()
    .focus()
    .setTextSelection(range)
    .unsetMark(PLAN_TAG_MARK)
    .setTextSelection(range.to)
    .run();
}

export const PlanTag = Mark.create({
  name: PLAN_TAG_MARK,

  // Über dem Link-Mark aus dem StarterKit, damit unsere Parse-Regel bei
  // `<a href="person:…">` zuerst greift.
  priority: 1100,

  // Tippen direkt hinter einem fertigen Tag darf ihn nicht verlängern.
  // Während des Schreibens hält das Kommando-Plugin den Mark selbst nach.
  inclusive: false,

  addAttributes() {
    // rendered: false — die DOM-Attribute setzt renderHTML unten selbst
    // (ein rohes id="…" würde mit echten Element-IDs kollidieren).
    return {
      kind: { default: "person" as PlanTagKind, rendered: false },
      id: { default: "", rendered: false },
    };
  },

  parseHTML() {
    return [
      // Aus dem Markdown (markdown-it macht daraus ein <a>).
      {
        tag: "a[href]",
        getAttrs: (element: HTMLElement) =>
          // false = Regel greift nicht; normale Links behält der Link-Mark.
          parsePlanTagHref(element.getAttribute("href")) ?? false,
      },
      // Aus der Zwischenablage (unsere eigene DOM-Darstellung, siehe unten).
      {
        tag: "span[data-plan-tag]",
        getAttrs: (element: HTMLElement) => ({
          kind: element.getAttribute("data-plan-tag"),
          id: element.getAttribute("data-plan-id"),
        }),
      },
    ];
  },

  // Als span, nicht als a: ein echter Link mit "person:"-Schema würde beim
  // Klick einen Navigationsversuch der Webview auslösen.
  renderHTML({ HTMLAttributes, mark }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        class: "plan-tag",
        "data-plan-tag": mark.attrs.kind,
        "data-plan-id": mark.attrs.id,
      }),
      0,
    ];
  },

  addStorage() {
    return {
      markdown: {
        serialize: {
          open: "[",
          close: (_state: MarkdownSerializerState, mark: PMMark) =>
            `](${planTagHref(mark.attrs.kind, mark.attrs.id)})`,
          mixable: false,
          expelEnclosingWhitespace: true,
        },
        parse: {
          // markdown-it liefert den <a>-Tag, den parseHTML oben aufgreift.
        },
      },
    };
  },
});
