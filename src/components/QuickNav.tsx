import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store";
import { flattenTree } from "../tree";
import type { BinderNode } from "../types";

/** Stabile Referenz — `?? []` im Selector würde jedes Mal ein neues Array
 *  liefern und eine Endlos-Render-Schleife auslösen. */
const NO_BINDER: BinderNode[] = [];

export function QuickNav() {
  const open = useStore((s) => s.quickNavOpen);
  const setOpen = useStore((s) => s.setQuickNavOpen);
  const binder = useStore((s) => s.project?.meta.binder ?? NO_BINDER);
  const selectScene = useStore((s) => s.selectScene);
  const selectChapter = useStore((s) => s.selectChapter);

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const all = flattenTree(binder);
    const q = query.toLowerCase().trim();
    const hits = q
      ? all.filter(
          ({ node, path }) =>
            node.title.toLowerCase().includes(q) ||
            path.join(" ").toLowerCase().includes(q),
        )
      : all;
    return hits.slice(0, 50);
  }, [binder, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      // Nach dem Rendern fokussieren.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => setSelected(0), [query]);

  if (!open) return null;

  function pick(index: number) {
    const hit = results[index];
    if (!hit) return;
    setOpen(false);
    if (hit.node.kind === "scene") void selectScene(hit.node.id);
    else void selectChapter(hit.node.id);
  }

  return (
    <div className="quicknav-overlay" onClick={() => setOpen(false)}>
      <div className="quicknav" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          placeholder="Szene oder Kapitel suchen …"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSelected((s) => Math.min(s + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setSelected((s) => Math.max(s - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              pick(selected);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        <ul>
          {results.map(({ node, path }, i) => (
            <li
              key={node.id}
              className={i === selected ? "selected" : ""}
              onMouseEnter={() => setSelected(i)}
              onClick={() => pick(i)}
            >
              <span>
                {node.kind === "chapter" ? "📁 " : "📄 "}
                {node.title}
              </span>
              {path.length > 0 && <span className="muted small">{path.join(" › ")}</span>}
            </li>
          ))}
          {results.length === 0 && <li className="muted">Keine Treffer</li>}
        </ul>
      </div>
    </div>
  );
}
