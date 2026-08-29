import { useState } from "react";
import { LAYOUT_MODES, useStore, type LayoutMode } from "../store";

const MODE_LABELS: Record<LayoutMode, string> = {
  single: "Kein Split",
  cols: "Zwei Spalten",
  leftSplit: "Links geteilt",
  rightSplit: "Rechts geteilt",
  grid: "Vier Bereiche",
};

/** Schema-Icon: Rechtecke zeigen die Pane-Aufteilung des Modus. */
function ModeIcon({ mode }: { mode: LayoutMode }) {
  const rects: Record<LayoutMode, [number, number, number, number][]> = {
    single: [[0, 0, 18, 14]],
    cols: [
      [0, 0, 8, 14],
      [10, 0, 8, 14],
    ],
    leftSplit: [
      [0, 0, 8, 6],
      [0, 8, 8, 6],
      [10, 0, 8, 14],
    ],
    rightSplit: [
      [0, 0, 8, 14],
      [10, 0, 8, 6],
      [10, 8, 8, 6],
    ],
    grid: [
      [0, 0, 8, 6],
      [10, 0, 8, 6],
      [0, 8, 8, 6],
      [10, 8, 8, 6],
    ],
  };
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true">
      {rects[mode].map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} rx="1.5" fill="currentColor" />
      ))}
    </svg>
  );
}

/** Split-Button in der Titelleiste: öffnet die Auswahl der fünf Layout-Modi. */
export function LayoutMenu() {
  const layoutMode = useStore((s) => s.layoutMode);
  const setLayoutMode = useStore((s) => s.setLayoutMode);
  const [open, setOpen] = useState(false);

  return (
    <span className="layout-menu">
      <button
        className={layoutMode !== "single" ? "on" : ""}
        title={`Split-Layout (${MODE_LABELS[layoutMode]})`}
        onClick={() => setOpen(!open)}
      >
        <ModeIcon mode={layoutMode} /> Split
      </button>
      {open && (
        <>
          <div className="layout-menu-overlay" onClick={() => setOpen(false)} />
          <div className="layout-menu-popover">
            {LAYOUT_MODES.map((mode) => (
              <button
                key={mode}
                className={mode === layoutMode ? "on" : ""}
                title={MODE_LABELS[mode]}
                onClick={() => {
                  setOpen(false);
                  void setLayoutMode(mode);
                }}
              >
                <ModeIcon mode={mode} />
              </button>
            ))}
          </div>
        </>
      )}
    </span>
  );
}
