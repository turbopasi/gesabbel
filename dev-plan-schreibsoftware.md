# Dev-Plan: Webbasierte Autoren-Schreibsoftware (Tauri)

## Projektkontext (für Claude Code)

Ziel: Eine Desktop-Schreibsoftware für Autoren, gebaut mit Tauri 2.x, die die besten
Features von Scrivener (Binder, Corkboard, flexibler Export) und Papyrus Autor
(deutsche Normseite, Zeitstrahl, Personen-/Ortsdatenbank) kombiniert — ohne
Lektorat-Modul, dafür mit starker Personalisierung.

**Zielplattformen:** Windows (Priorität 1), Linux (Priorität 1), macOS (später, "Coming soon")
**Lizenzmodell:** Kostenlos, Open Source, Distribution über eigene Website + GitHub Releases
**Backup/Sync-Scope für MVP:** Nur lokaler Speicherort (Ebene A) + interne Git-Versionierung (Ebene C). Keine nativen Cloud-Connectors.

**Kernprinzip Datenformat:** Projekt = Ordner mit vielen kleinen Dateien (analog Scrivener
`.scriv`-Package), NICHT eine einzelne SQLite-Datei oder ein großes JSON. Das ist
Voraussetzung für sichere Cloud-Sync via Dropbox/GDrive/OneDrive (extern durch den Nutzer)
und für sinnvolles Git-Diffing. SQLite wird nur als regenerierbarer Such-/Index-Cache genutzt.

---

## Phase 0 — Setup & Grundgerüst

**Ziel:** Lauffähiges Tauri-Grundgerüst mit Build-Pipeline.

1. Tauri 2.x Projekt aufsetzen (`npm create tauri-app@latest`), Frontend-Framework wählen
   (React oder Svelte — Empfehlung: React wegen Ökosystem für Editor-Libraries).
2. Rust-Toolchain, Node LTS, plattformspezifische Build-Dependencies installieren
   (siehe Tauri-Doku: WebView2 auf Windows, webkit2gtk auf Linux).
3. Projektstruktur anlegen: `src/` (Frontend), `src-tauri/` (Rust Backend/Commands).
4. Git-Repo für den Code selbst initialisieren (getrennt von der späteren
   projekt-internen Git-Versionierung der Nutzerdaten!).
5. CI-Grundgerüst (GitHub Actions) für automatisierte Builds auf Windows + Linux.
6. Basis-Fenster mit Platzhalter-UI zum Verifizieren, dass der Build-Prozess funktioniert.

**Definition of Done:** `tauri build` erzeugt lauffähige `.exe` (Windows) und
`.AppImage`/`.deb` (Linux).

---

## Phase 1 — Datenmodell & Projekt-Dateiformat

**Ziel:** Das Herzstück — robustes, sync-freundliches Dateiformat.

1. Ordnerstruktur für ein Projekt definieren, z. B.:
   ```
   MeinRoman.autorproj/
   ├── project.json          (Metadaten: Titel, Autor, Struktur/Binder-Baum)
   ├── manuscript/
   │   ├── kapitel-01/
   │   │   ├── szene-001.md
   │   │   └── szene-002.md
   │   └── kapitel-02/
   ├── notes/                (Recherchenotizen)
   ├── characters/           (Personen-DB als einzelne JSON/MD pro Person)
   ├── locations/            (Orte-DB)
   ├── timeline.json
   ├── .cache/
   │   └── index.sqlite      (regenerierbar, NICHT in Git/Sync — .gitignore)
   └── .git/                 (versteckt, für Ebene C — siehe Phase 5)
   ```
2. Rust-Backend-Commands für: Projekt anlegen, öffnen, Struktur einlesen, Datei
   lesen/schreiben (über Tauri `fs`-Plugin mit Scope-Beschränkung auf Projektordner).
3. Frontend-seitiges State-Management für den Binder-Baum (z. B. Zustand/Redux).
4. Autosave-Mechanismus: Debounced Write pro Szene-Datei (z. B. alle 2–5 Sekunden
   nach letzter Änderung, nicht bei jedem Tastendruck).
5. Externe-Änderungen-Erkennung: Beim Öffnen/Fokussieren prüfen, ob Dateien seit
   letztem bekannten Stand von außen verändert wurden (mtime-Vergleich) — Warnhinweis
   statt stillem Überschreiben.

**Definition of Done:** Projekt kann angelegt, geschlossen, wieder geöffnet werden;
Änderungen werden zuverlässig auf Platte persistiert; manuelles Verschieben des
Ordners in einen Dropbox-Ordner und Öffnen auf einer zweiten Maschine funktioniert.

---

## Phase 2 — Editor-Kern

**Ziel:** Der eigentliche Schreib-Editor.

1. Rich-Text-Editor-Library integrieren (Empfehlung: **TipTap**, da gut erweiterbar
   und Markdown-kompatibel — passt zum Klartextdatei-Ansatz aus Phase 1).
2. Basis-Formatierung: Fett, Kursiv, Überschriften, Absatzformate.
3. Live-Zähler-Leiste: Wörter, Zeichen (mit/ohne Leerzeichen), **deutsche Normseiten**
   (1800 Zeichen inkl. Leerzeichen bzw. 30 Zeilen × 60 Zeichen — beide Varianten als
   Option, da unterschiedliche Verlage/Konventionen existieren).
4. Split-Screen-Modus (zwei Dokumente nebeneinander).
5. Fokus-/Schreibmodus (Ablenkungsfreiheit, Typewriter-Scrolling optional).
6. Undo/Redo-Stack pro Dokument.

**Definition of Done:** Flüssiges Schreiberlebnis, Zähler aktualisieren sich live,
Fokusmodus lässt sich per Shortcut umschalten.

---

## Phase 3 — Binder & Corkboard

**Ziel:** Projektorganisation wie in Scrivener.

1. Binder-Baumansicht: Kapitel/Szenen anlegen, umbenennen, per Drag & Drop umsortieren
   und verschachteln.
2. Corkboard-Ansicht: Karteikarten pro Szene mit Kurzbeschreibung/Synopsis,
   umsortierbar, Ansicht synchron zum Binder.
3. Metadaten pro Szene: Status (Entwurf/Überarbeitung/Fertig), Farbcodierung, Tags.
4. Schnellnavigation (Cmd/Ctrl+K-Stil Sprung zu beliebiger Szene).

**Definition of Done:** Ganzes Manuskript lässt sich strukturell frei umbauen, ohne
Textverlust, Binder und Corkboard bleiben synchron.

---

## Phase 4 — Recherche-Module (Papyrus-Teil)

**Ziel:** Personen, Orte, Zeitstrahl.

1. Personen-Datenbank: Karteikarten mit freien Feldern (Name, Beschreibung, Bild
   optional, Verknüpfung zu Szenen, in denen die Person vorkommt).
2. Orte-Datenbank: analog.
3. Zeitstrahl-Ansicht: Ereignisse chronologisch, verknüpfbar mit Szenen/Kapiteln.
4. Freie Notizen-/Recherche-Ablage (Ordnerstruktur wie `notes/` aus Phase 1),
   durchsuchbar.
5. Volltextsuche über gesamtes Projekt (Manuskript + Notizen + Personen), Backend
   über SQLite-Index (`.cache/index.sqlite`), der bei Bedarf aus den Klartextdateien
   neu aufgebaut wird (z. B. wenn Cache fehlt oder korrupt ist).

**Definition of Done:** Suche findet Treffer über alle Projektbereiche hinweg;
Zeitstrahl und Personen-DB sind mit dem Manuskript verknüpft.

---

## Phase 5 — Backup/Versionierung (Ebene A + C)

**Ziel:** Deine Must-Have-Anforderung.

1. **Ebene A (lokaler Speicherort / Bring-your-own-sync):**
   - Dialog zum freien Wählen des Speicherorts beim Projekt-Anlegen.
   - Dokumentation/Hinweistext in der App: "Lege diesen Ordner in deinen
     Dropbox/Google-Drive/OneDrive-Ordner, um automatisch zu synchronisieren."
   - Konfliktwarnung bei extern geänderten Dateien (siehe Phase 1, Punkt 5).
2. **Ebene C (interne Git-Versionierung):**
   - Rust-Crate `git2` einbinden.
   - Beim ersten Öffnen eines Projekts: `.git`-Repo im Projektordner initialisieren
     (versteckt vor dem Nutzer, kein Git-Wissen nötig).
   - Commit-Trigger: automatisch in Intervallen (z. B. alle 10 Minuten bei Aktivität)
     UND manuell per Button ("Sicherungspunkt setzen").
   - `.gitignore` für `.cache/` (SQLite-Index gehört nicht ins Repo).
   - UI: "Verlauf"-Ansicht pro Szene/Dokument — Liste vergangener Versionen mit
     Zeitstempel, Diff-Anzeige (Textvergleich zweier Versionen), Wiederherstellen-Button.
   - Optional (später): Möglichkeit, ein eigenes Remote (privates GitHub/GitLab-Repo)
     zu hinterlegen, für Nutzer, die zusätzlich zu A noch ein echtes Cloud-Backup
     ihrer Versionshistorie wollen — bewusst NICHT im MVP, nur als Erweiterungspunkt
     im Code vormerken.

**Definition of Done:** Jede Textänderung ist über die Verlaufsansicht nachvollziehbar
und wiederherstellbar; Projektordner lässt sich beliebig in einen Sync-Ordner legen
und auf zweiter Maschine öffnen, ohne Datenverlust.

---

## Phase 6 — Export/Compile

**Ziel:** Fertiges Manuskript exportieren.

1. Export-Engine: Binder-Struktur + Szenen zu einem finalen Dokument zusammenführen.
2. Zielformate: DOCX, PDF, ePub, reines Markdown/TXT.
3. Vorlagen-System: Formatierungsvorlagen speicherbar (Schriftart, Ränder, Kopf-/
   Fußzeile), inkl. einer Normseiten-konformen Vorlage (Times New Roman 12pt,
   1,5-zeilig, Standardränder — deutsche Verlagskonvention).
4. Auswahl, welche Teile des Binders in den Export einfließen (z. B. Notizen
   ausschließen).

**Definition of Done:** Export aus einem realistischen Testprojekt erzeugt sauber
formatierte DOCX/PDF/ePub-Dateien.

---

## Phase 7 — Personalisierung & Theming

**Ziel:** Individualisierbare Oberfläche.

1. Theming-Engine: CSS-Variablen-basiert, mehrere mitgelieferte Themes + Custom-Theme-
   Editor (Farben frei wählbar).
2. Editor-Einstellungen: Schriftart, -größe, Zeilenabstand, Textbreite, Cursor-Stil.
3. Layout-Anpassung: Panels (Binder, Inspector) ein-/ausblendbar und in Größe
   verstellbar, Position (links/rechts) wählbar.
4. Tastaturkürzel-Editor (Rebinding).
5. Einstellungen werden zentral gespeichert (Tauri `store`-Plugin, App-weit, nicht
   projektgebunden — Ausnahme: Formatierungsvorlagen aus Phase 6 sind projektbezogen).

**Definition of Done:** Nutzer kann Look & Feel spürbar an eigenen Geschmack anpassen,
Einstellungen bleiben nach Neustart erhalten.

---

## Phase 8 — Auto-Updates & Distribution

**Ziel:** Kostenlose Verteilung mit funktionierenden Updates.

1. Tauri `updater`-Plugin einrichten.
2. Update-Manifest (`latest.json`) automatisiert über GitHub Releases bereitstellen
   (GitHub Actions Workflow: bei neuem Tag automatisch bauen, signieren mit
   Tauri-eigenem Update-Signing-Key — das ist NICHT dasselbe wie Code-Signing-Zertifikate,
   sondern ein selbst generiertes Schlüsselpaar nur für die Update-Integrität).
3. Windows-Build ohne EV-Zertifikat (SmartScreen-Warnung wird bewusst akzeptiert).
4. macOS-Build-Pipeline vorbereiten, aber Release-Kanal als "Coming soon" markieren
   (Code kann plattformübergreifend bleiben, nur kein aktiver Release).
5. Einfache Landingpage (statisch, z. B. GitHub Pages) mit Download-Links pro
   Plattform + Kurzbeschreibung + Screenshots.

**Definition of Done:** Ein Versions-Tag im Repo löst automatisch einen Build +
Release aus; bestehende Installationen erhalten einen Update-Hinweis und können
sich selbst aktualisieren.

---

## Empfohlene Reihenfolge / Meilensteine

1. Phase 0–2 → **Meilenstein "Minimaler Texteditor"** (kann bereits zum Schreiben genutzt werden)
2. Phase 3–4 → **Meilenstein "Projektorganisation"** (Scrivener-Niveau erreicht)
3. Phase 5 → **Meilenstein "Sicheres Arbeiten"** (dein Must-Have — danach ist die App alltagstauglich)
4. Phase 6–7 → **Meilenstein "Poliert"** (Export + Personalisierung)
5. Phase 8 → **Meilenstein "Release v1.0"**

## Offene Entscheidungen für Claude Code (bei Bedarf nachfragen)

- Frontend-Framework: React vs. Svelte (Empfehlung React, aber Nutzerpräferenz klären)
- Editor-Library: TipTap vs. Lexical vs. ProseMirror direkt
- Genaues Normseiten-Zählformat als Standard (1800 Zeichen vs. 30×60-Zeilen-Modell)
- State-Management-Lösung fürs Frontend
