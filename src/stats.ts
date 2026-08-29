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
