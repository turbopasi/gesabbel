/** Live-Zähler: Wörter, Zeichen, deutsche Normseiten (beide Konventionen). */

export type NormVariant = "1800" | "30x60";

export interface TextStats {
  words: number;
  charsWithSpaces: number;
  charsWithoutSpaces: number;
  /** Normseiten nach 1800-Zeichen-Konvention (inkl. Leerzeichen). */
  norm1800: number;
  /** Normseiten nach 30-Zeilen-×-60-Zeichen-Konvention. */
  norm30x60: number;
}

/** `text`: Klartext mit `\n` als Absatztrenner (Zeilenumbrüche zählen nicht als Zeichen). */
export function computeStats(text: string): TextStats {
  const paragraphs = text.split("\n");
  const joined = paragraphs.join("");
  const charsWithSpaces = joined.length;
  const charsWithoutSpaces = joined.replace(/\s/g, "").length;
  const words = text.split(/\s+/).filter(Boolean).length;

  // 30×60: Jeder Absatz belegt ceil(Länge/60) Zeilen, mindestens eine;
  // eine Normseite hat 30 Zeilen.
  const lines = paragraphs.reduce(
    (sum, p) => sum + Math.max(1, Math.ceil(p.length / 60)),
    0,
  );

  return {
    words,
    charsWithSpaces,
    charsWithoutSpaces,
    norm1800: charsWithSpaces / 1800,
    norm30x60: lines / 30,
  };
}

export const emptyStats = (): TextStats => ({
  words: 0,
  charsWithSpaces: 0,
  charsWithoutSpaces: 0,
  norm1800: 0,
  norm30x60: 0,
});

/** Summiert zwei Zählungen (Normseiten addieren sich als Bruchteile). */
export function addStats(a: TextStats, b: TextStats): TextStats {
  return {
    words: a.words + b.words,
    charsWithSpaces: a.charsWithSpaces + b.charsWithSpaces,
    charsWithoutSpaces: a.charsWithoutSpaces + b.charsWithoutSpaces,
    norm1800: a.norm1800 + b.norm1800,
    norm30x60: a.norm30x60 + b.norm30x60,
  };
}

export function subStats(a: TextStats, b: TextStats): TextStats {
  return {
    words: a.words - b.words,
    charsWithSpaces: a.charsWithSpaces - b.charsWithSpaces,
    charsWithoutSpaces: a.charsWithoutSpaces - b.charsWithoutSpaces,
    norm1800: a.norm1800 - b.norm1800,
    norm30x60: a.norm30x60 - b.norm30x60,
  };
}

/** Näherung: Markdown einer gespeicherten Szene → Fließtext, wie ihn der
 *  Editor zählen würde (Auszeichnungen, Bilder und Link-Ziele fallen weg). */
export function plainTextFromMarkdown(md: string): string {
  return md
    .replace(/^\s*```.*$/gm, "") // Code-Zäune
    .replace(/<[^>]*>/g, "") // HTML (u. a. die Ausrichtungs-Wrapper)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // Bilder
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // Links & Planungs-Tags → Label
    .replace(/^\s{0,3}(#{1,6}\s+|>\s?|([-*+]|\d+[.)])\s+)/gm, "") // Block-Zeichen
    .replace(/^\s*([-*_]\s*){3,}$/gm, "") // horizontale Linien
    .replace(/(?<!\\)(\*\*|__|~~|\*|_|`)/g, "") // Auszeichnungen
    .replace(/\\([^\sA-Za-z0-9])/g, "$1") // maskierte Sonderzeichen
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean) // Leerzeilen sind im Editor keine Absätze
    .join("\n");
}

export function formatNorm(n: number): string {
  return n.toLocaleString("de-DE", { maximumFractionDigits: 1 });
}

const NORM_KEY = "gesabbel.normVariant";

export function loadNormVariant(): NormVariant {
  return localStorage.getItem(NORM_KEY) === "30x60" ? "30x60" : "1800";
}

export function saveNormVariant(v: NormVariant) {
  localStorage.setItem(NORM_KEY, v);
}
