/** Zeilenbasierter Textvergleich für die Verlaufsansicht (Ebene C). */

export interface DiffLine {
  type: "same" | "add" | "del";
  text: string;
}

/**
 * Vergleicht zwei Texte zeilenweise (LCS). `del` = Zeile aus der alten
 * Version entfernt, `add` = Zeile in der neuen Version hinzugekommen.
 * Bei sehr großen Texten wird der Mittelteil pauschal als ersetzt markiert,
 * statt eine quadratische DP-Tabelle aufzubauen.
 */
export function diffLines(oldText: string, newText: string): DiffLine[] {
  const a = oldText.split(/\r?\n/);
  const b = newText.split(/\r?\n/);

  // Gemeinsamen Anfang/Ende abschneiden — der Normalfall beim Schreiben.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }

  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);
  const result: DiffLine[] = a.slice(0, start).map((text) => ({ type: "same", text }));

  if (midA.length * midB.length > 1_000_000) {
    result.push(...midA.map((text): DiffLine => ({ type: "del", text })));
    result.push(...midB.map((text): DiffLine => ({ type: "add", text })));
  } else {
    result.push(...lcsDiff(midA, midB));
  }

  result.push(...a.slice(endA).map((text): DiffLine => ({ type: "same", text })));
  return result;
}

function lcsDiff(a: string[], b: string[]): DiffLine[] {
  const n = a.length;
  const m = b.length;
  // dp[i][j] = LCS-Länge von a[i..] und b[j..]
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: "same", text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: "del", text: a[i] });
      i++;
    } else {
      out.push({ type: "add", text: b[j] });
      j++;
    }
  }
  while (i < n) out.push({ type: "del", text: a[i++] });
  while (j < m) out.push({ type: "add", text: b[j++] });
  return out;
}
