// Textausrichtung in Markdown-Dokumenten. Markdown kennt keine Ausrichtung —
// ausgerichtete Absätze/Überschriften werden deshalb als HTML-Block gespeichert:
//
//   <div style="text-align: center">
//
//   Inhalt bleibt normales **Markdown**.
//
//   </div>
//
// Beim Laden (markdown-it mit html:true) landet der div als Vorfahr im DOM;
// die erweiterte TextAlign-Extension liest die Ausrichtung von dort zurück.

import { TextAlign } from "@tiptap/extension-text-align";
import { Paragraph } from "@tiptap/extension-paragraph";
import { Heading } from "@tiptap/extension-heading";
import { defaultMarkdownSerializer, type MarkdownSerializerState } from "prosemirror-markdown";
import type { Node as PMNode } from "@tiptap/pm/model";

type NodeSerializer = (
  state: MarkdownSerializerState,
  node: PMNode,
  parent: PMNode,
  index: number,
) => void;

function alignedSerializer(defaultSerialize: NodeSerializer): NodeSerializer {
  return (state, node, parent, index) => {
    const align = node.attrs.textAlign as string | null;
    // Jede EXPLIZITE Ausrichtung wird gewrappt — auch "left", denn bei
    // Blocksatz-Grundeinstellung ist Linksbündig eine bewusste Abweichung.
    // Wrapper nur auf oberster Ebene — in Listen/Zitaten würde der HTML-Block
    // die Markdown-Struktur zerreißen (Ausrichtung geht dort beim Speichern verloren).
    if (align && parent.type.name === "doc") {
      state.write(`<div style="text-align: ${align}">\n\n`);
      defaultSerialize(state, node, parent, index);
      state.write("</div>");
      state.closeBlock(node);
    } else {
      defaultSerialize(state, node, parent, index);
    }
  };
}

export const AlignedParagraph = Paragraph.extend({
  addStorage() {
    return {
      markdown: {
        serialize: alignedSerializer(
          defaultMarkdownSerializer.nodes.paragraph as NodeSerializer,
        ),
        parse: {},
      },
    };
  },
});

export const AlignedHeading = Heading.extend({
  addStorage() {
    return {
      markdown: {
        serialize: alignedSerializer(
          defaultMarkdownSerializer.nodes.heading as NodeSerializer,
        ),
        parse: {},
      },
    };
  },
});

export const MarkdownTextAlign = TextAlign.extend({
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          textAlign: {
            default: this.options.defaultAlignment,
            parseHTML: (element: HTMLElement) => {
              const own = element.style.textAlign;
              if (this.options.alignments.includes(own)) return own;
              // Ausrichtung vom div-Wrapper (siehe Serialisierung oben) erben.
              const wrapper = element.closest(
                'div[style*="text-align"]',
              ) as HTMLElement | null;
              const inherited = wrapper?.style.textAlign ?? "";
              return this.options.alignments.includes(inherited)
                ? inherited
                : this.options.defaultAlignment;
            },
            renderHTML: (attributes: Record<string, string | null>) => {
              if (!attributes.textAlign) return {};
              return { style: `text-align: ${attributes.textAlign}` };
            },
          },
        },
      },
    ];
  },
  addKeyboardShortcuts() {
    // Die Standard-Kürzel (Strg+Umschalt+L/E/R/J) kollidieren mit App-Kürzeln
    // (Export, Recherche-Leiste) — Ausrichtung läuft über die Toolbar.
    return {};
  },
});
