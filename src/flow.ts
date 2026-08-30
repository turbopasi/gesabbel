// Fluss-Modus: alle Szenen eines Kapitels am Stück in einem Editor.
//
// Die Szenen bleiben einzelne Dateien — für den Editor werden sie zu einem
// Markdown-Dokument zusammengesetzt, getrennt durch einen HTML-Block mit der
// Szenen-ID. Der Block überlebt den Weg durch markdown-it (html: true) und
// wird von der SceneBreak-Extension zu einem nicht editierbaren Trenner.
// Beim Speichern wird an genau diesen Marken wieder zerlegt.

export const sceneBreakHtml = (id: string) => `<div data-scene-break="${id}"></div>`;

const BREAK_RE = /^<div data-scene-break="([^"]*)"><\/div>$/;

export interface FlowPart {
  id: string;
  /** Markdown der Szene, normalisiert (ohne führende/abschließende Leerzeilen). */
  content: string;
}

/** Normalisierte Form, in der Szenen-Markdown verglichen und geschrieben wird. */
export function normalizeScene(markdown: string): string {
  const trimmed = markdown.trim();
  return trimmed ? `${trimmed}\n` : "";
}

export function joinFlow(parts: FlowPart[]): string {
  return parts
    .map((p) => `${sceneBreakHtml(p.id)}\n\n${normalizeScene(p.content)}`)
    .join("\n");
}

/** Zerlegt das Markdown des Fluss-Editors wieder in einzelne Szenen.
 *  `expected` sind die Szenen des Flusses; Abschnitte mit unbekannter ID
 *  (etwa ein vom Benutzer eingefügter div-Block) werden an die vorherige
 *  Szene angehängt, damit kein Text verloren geht. */
export function splitFlow(markdown: string, expected: string[]): FlowPart[] {
  const known = new Set(expected);
  const parts: FlowPart[] = [];
  let buffer: string[] = [];

  const take = () => {
    const text = buffer.join("\n");
    buffer = [];
    return text;
  };

  for (const line of markdown.split("\n")) {
    const id = BREAK_RE.exec(line.trim())?.[1];
    if (id !== undefined && known.has(id)) {
      // Text oberhalb der ersten Marke gehört zur ersten Szene.
      const carried = parts.length ? "" : take();
      if (parts.length) parts[parts.length - 1].content += take();
      parts.push({ id, content: carried });
      continue;
    }
    // Unbekannte Marke: die Zeile selbst fällt weg, ihr Text zählt weiter zur
    // laufenden Szene (sonst tauchte der Block bei jedem Laden erneut auf).
    if (id === undefined) buffer.push(line);
  }
  if (parts.length) parts[parts.length - 1].content += take();

  return parts.map((p) => ({ id: p.id, content: normalizeScene(p.content) }));
}
