// Hintergrundbild der Dokumentenfläche.
//
// Bewusst eine eigene DOM-Ebene statt einer zweiten background-image-Ebene auf
// dem Schreibtisch: die Stapelung ist dadurch genau die erwartete —
//
//   1. .editor            Dokumenten-Hintergrund aus dem Theme
//   2. .doc-backdrop      dieses Bild, mit eigener Deckkraft
//   3. .ProseMirror       die Manuskriptseite mit dem Text
//
// — und die Deckkraft ist schlichtes `opacity`, kein Schleier in Theme-Farbe.
// Der Schreibtisch selbst scrollt; deshalb liegt die Ebene im Pane darüber
// (.editor), nicht im scrollenden .editor-content: so steht das Bild still,
// während der Text darüber läuft.

import { useEffect, useState } from "react";
import { api } from "../api";
import { useStore } from "../store";

/** Dateiname → data-URL, einmal pro Sitzung geladen (wie bei den Dokumentbildern). */
const cache = new Map<string, string>();

function useBackgroundImage(name: string): string | null {
  const [url, setUrl] = useState<string | null>(() => (name ? (cache.get(name) ?? null) : null));

  useEffect(() => {
    if (!name) {
      setUrl(null);
      return;
    }
    const hit = cache.get(name);
    if (hit) {
      setUrl(hit);
      return;
    }
    let alive = true;
    void api
      .readBackgroundImage(name)
      .then((resolved) => {
        if (resolved) cache.set(name, resolved);
        if (alive) setUrl(resolved);
      })
      .catch((e) => useStore.setState({ error: `Hintergrundbild nicht ladbar: ${String(e)}` }));
    return () => {
      alive = false;
    };
  }, [name]);

  return url;
}

export function DocBackdrop() {
  const bg = useStore((s) => s.settings.background);
  const url = useBackgroundImage(bg.image);

  if (!url) return null;
  return (
    <div
      className="doc-backdrop"
      aria-hidden="true"
      style={{
        backgroundImage: `url("${url}")`,
        backgroundSize: bg.fit === "tile" ? "auto" : "cover",
        backgroundRepeat: bg.fit === "tile" ? "repeat" : "no-repeat",
        opacity: Math.min(100, Math.max(0, bg.opacity)) / 100,
      }}
    />
  );
}
