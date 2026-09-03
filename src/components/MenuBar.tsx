// Anwendungsmenü in der Titelleiste — bewusst in der App gebaut statt als
// natives Windows-Menü: nur so läuft es in allen Themes und mit den eigenen
// Schriften mit. Die Einträge rufen dieselben Store-Aktionen wie die Knöpfe.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open, save } from "@tauri-apps/plugin-dialog";
import { loadRecents, useStore } from "../store";
import { formatCombo } from "../settings";
import { Icon, type IconName } from "./Icon";

type MenuId = "datei" | "hilfe";

/** Trennt "D:\\Bücher\\Roman.autorproj" in Elternordner und blanken Namen. */
function splitTarget(path: string): { parentDir: string; name: string } {
  const norm = path.replace(/[\\/]+$/, "");
  const cut = Math.max(norm.lastIndexOf("/"), norm.lastIndexOf("\\"));
  return {
    parentDir: norm.slice(0, cut),
    name: norm.slice(cut + 1).replace(/\.autorproj$/i, ""),
  };
}

export function MenuBar() {
  const [openMenu, setOpenMenu] = useState<MenuId | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const project = useStore((s) => s.project);
  const openProject = useStore((s) => s.openProject);
  const saveProjectAs = useStore((s) => s.saveProjectAs);
  const closeProject = useStore((s) => s.closeProject);
  const takeSnapshot = useStore((s) => s.takeSnapshot);
  const setExportOpen = useStore((s) => s.setExportOpen);
  const setAboutOpen = useStore((s) => s.setAboutOpen);
  const shortcuts = useStore((s) => s.settings.shortcuts);

  const recents = loadRecents().filter((p) => p !== project?.root);

  // Escape schließt das Menü, bevor der globale Handler den Fokusmodus trifft.
  useEffect(() => {
    if (!openMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      e.preventDefault();
      setOpenMenu(null);
      barRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [openMenu]);

  /** Führt einen Eintrag aus und schließt das Menü — nie beides getrennt. */
  const run = (fn: () => void | Promise<void>) => () => {
    setOpenMenu(null);
    void fn();
  };

  async function handleOpen() {
    const dir = await open({ directory: true, title: "Projektordner (.autorproj) öffnen" });
    if (typeof dir === "string") await openProject(dir);
  }

  async function handleSaveAs() {
    const chosen = await save({
      title: "Projektkopie speichern unter …",
      defaultPath: `${project?.meta.title ?? "Projekt"} Kopie`,
    });
    if (!chosen) return;
    const { parentDir, name } = splitTarget(chosen);
    if (!parentDir || !name) return;
    await saveProjectAs(parentDir, name);
  }

  async function handleQuit() {
    // Wie „Projekt schließen": erst alles sichern, dann das Fenster zu.
    if (useStore.getState().project) await closeProject();
    await getCurrentWindow().close();
  }

  return (
    <div className="menubar" ref={barRef}>
      <MenuTitle id="datei" label="Datei" openMenu={openMenu} setOpenMenu={setOpenMenu}>
        <Item icon="folder" label="Projekt öffnen …" onClick={run(handleOpen)} />
        <Submenu icon="clock" label="Letzte Projekte" disabled={recents.length === 0}>
          {recents.map((path) => (
            <button key={path} className="menu-item" onClick={run(() => openProject(path))}>
              <span className="menu-item-label" title={path}>
                {path}
              </span>
            </button>
          ))}
        </Submenu>
        <hr />
        <Item
          icon="camera"
          label="Sicherungspunkt"
          hint={formatCombo(shortcuts.snapshot)}
          disabled={!project}
          onClick={run(() => takeSnapshot("Manueller Sicherungspunkt"))}
        />
        <Item
          icon="file-text"
          label="Speichern unter …"
          disabled={!project}
          onClick={run(handleSaveAs)}
        />
        <hr />
        <Item
          icon="book-open"
          label="Exportieren …"
          hint={formatCombo(shortcuts.export)}
          disabled={!project}
          onClick={run(() => setExportOpen(true))}
        />
        <hr />
        <Item
          icon="x"
          label="Projekt schließen"
          disabled={!project}
          onClick={run(closeProject)}
        />
        <Item label="Beenden" onClick={run(handleQuit)} />
      </MenuTitle>

      <MenuTitle id="hilfe" label="Hilfe" openMenu={openMenu} setOpenMenu={setOpenMenu}>
        <Item icon="info" label="Über Gesabbel" onClick={run(() => setAboutOpen(true))} />
      </MenuTitle>

      {openMenu && <div className="menu-overlay" onMouseDown={() => setOpenMenu(null)} />}
    </div>
  );
}

/** Ein Menütitel samt Klappe. Ist eine Klappe offen, genügt Überfahren zum Wechseln. */
function MenuTitle({
  id,
  label,
  openMenu,
  setOpenMenu,
  children,
}: {
  id: MenuId;
  label: string;
  openMenu: MenuId | null;
  setOpenMenu: (id: MenuId | null) => void;
  children: ReactNode;
}) {
  const open = openMenu === id;
  return (
    <span className="menu">
      <button
        className={open ? "menu-title on" : "menu-title"}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpenMenu(open ? null : id)}
        onMouseEnter={() => openMenu && setOpenMenu(id)}
      >
        {label}
      </button>
      {open && (
        <div className="menu-popover" role="menu">
          {children}
        </div>
      )}
    </span>
  );
}

function Item({
  icon,
  label,
  hint,
  disabled,
  onClick,
}: {
  icon?: IconName;
  label: string;
  hint?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button className="menu-item" role="menuitem" disabled={disabled} onClick={onClick}>
      <span className="menu-item-icon">{icon && <Icon name={icon} size={14} />}</span>
      <span className="menu-item-label">{label}</span>
      {hint && <span className="menu-item-hint">{hint}</span>}
    </button>
  );
}

/** Untermenü, das zur Seite aufklappt (nur „Letzte Projekte"). */
function Submenu({
  icon,
  label,
  disabled,
  children,
}: {
  icon?: IconName;
  label: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="menu-sub"
      onMouseEnter={() => !disabled && setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        className="menu-item"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        <span className="menu-item-icon">{icon && <Icon name={icon} size={14} />}</span>
        <span className="menu-item-label">{label}</span>
        <span className="menu-item-hint">
          <Icon name="chevron-right" size={14} />
        </span>
      </button>
      {open && (
        <div className="menu-popover menu-popover-sub" role="menu">
          {children}
        </div>
      )}
    </span>
  );
}
