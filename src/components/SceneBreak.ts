// Trenner zwischen zwei Szenen im Fluss-Modus (siehe src/flow.ts).
//
// Ein Atom-Node ohne eigenen Inhalt: er lässt sich nicht bearbeiten, trägt aber
// die Szenen-ID, damit beim Speichern klar ist, wohin der folgende Text gehört.

import { Node, mergeAttributes } from "@tiptap/react";
import type { MarkdownSerializerState } from "prosemirror-markdown";
import type { Node as PMNode } from "@tiptap/pm/model";
import { sceneBreakHtml } from "../flow";
import { useStore } from "../store";
import { findNode } from "../tree";

export const SCENE_BREAK_NODE = "sceneBreak";

function sceneTitle(id: string): string {
  const binder = useStore.getState().project?.meta.binder ?? [];
  return findNode(binder, id)?.title ?? "Dokument";
}

export const SceneBreak = Node.create({
  name: SCENE_BREAK_NODE,
  group: "block",
  atom: true,
  selectable: false,
  draggable: false,

  addAttributes() {
    // rendered: false — renderHTML setzt das Attribut selbst.
    return { sceneId: { default: "", rendered: false } };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-scene-break]",
        getAttrs: (element: HTMLElement) => ({
          sceneId: element.getAttribute("data-scene-break") ?? "",
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        class: "scene-break",
        "data-scene-break": node.attrs.sceneId,
        contenteditable: "false",
      }),
      ["span", { class: "scene-break-title" }, sceneTitle(node.attrs.sceneId)],
    ];
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: MarkdownSerializerState, node: PMNode) {
          state.write(sceneBreakHtml(node.attrs.sceneId));
          state.closeBlock(node);
        },
        parse: {
          // markdown-it reicht den HTML-Block durch, parseHTML greift ihn auf.
        },
      },
    };
  },
});
