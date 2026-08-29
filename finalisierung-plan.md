# Finalisierungs-Plan (ehemals Phase 8)

Stand: 2026-08-28. Phasen 0–7 des ursprünglichen Dev-Plans sind umgesetzt.
Dieses Dokument sammelt die restlichen Schritte bis zum ersten öffentlichen Release.

**Getroffene Entscheidungen:**
- Distribution: Open Source via GitHub, Releases mit Ready-to-use-Builds im Repo.
- Erstmal **nur Windows-Builds** (nur Windows zum Testen verfügbar). Linux/macOS später.
- Kein Remote-Git-Backup der Versionshistorie (Erweiterungspunkt bleibt nur im Code vorgemerkt).
- Kein eigener Server für irgendetwas — alles läuft über GitHub (Actions, Releases, Pages).

---

## 1. Release-Workflow (GitHub Actions)

Neuer Workflow zusätzlich zur bestehenden `build.yml` (die bleibt als CI auf `main`):

- Trigger: Push eines Versions-Tags (z. B. `v0.1.0`).
- Offizielles `tauri-action` verwenden: baut den Windows-Installer (MSI/NSIS),
  erzeugt ein GitHub Release und hängt die Artefakte an.
- Signiert die Artefakte mit dem Tauri-Update-Schlüssel und erzeugt automatisch
  die `latest.json` fürs Update-Manifest (siehe Punkt 2).
- Nur Windows-Runner; Linux/macOS-Matrix erst ergänzen, wenn testbar.
- Kosten: Auf öffentlichem Repo kostenlos, unbegrenzt. Privat: zählt gegen
  Freiminuten (Pro-Abo: 3.000/Monat, Windows zählt doppelt) — bei 10–20 min
  pro Build unkritisch.

## 2. Tauri-Updater

Kein eigener Server nötig, läuft komplett über GitHub Releases:

- Einmalig Schlüsselpaar erzeugen: `npm run tauri signer generate`.
  - Öffentlicher Schlüssel → `tauri.conf.json` (Updater-Konfiguration).
  - Privater Schlüssel → GitHub-Actions-Secret (`TAURI_SIGNING_PRIVATE_KEY`).
  - **Privaten Schlüssel sicher aufbewahren** — bei Verlust können bestehende
    Installationen keine Updates mehr annehmen (manuelle Neuinstallation nötig).
- `tauri-plugin-updater` einbauen; Endpoint:
  `https://github.com/<user>/<repo>/releases/latest/download/latest.json`
  (GitHub leitet automatisch aufs neueste Release um, nichts zu pflegen).
- UI: Beim App-Start prüfen, Update-Hinweis mit Download + Selbst-Update anbieten.
- Voraussetzung: Repo muss **öffentlich** sein, sonst sind die Release-Downloads
  für die App nicht anonym abrufbar.

## 3. Landing Page (GitHub Pages)

Bewusst zurückgestellt — soll später **schön gestaltet** werden, kein Quick-Job.
Grobe Eckpunkte: statische Seite via GitHub Pages, Kurzbeschreibung, Screenshots,
Download-Button auf `releases/latest`.

## 4. Lizenz & Repo-Hygiene

Überwiegend organisatorisch — bis auf die Weitergabe-Hinweise, die mit
ausgeliefert werden müssen:

- LICENSE-Datei wählen und ablegen (MIT als unkomplizierter Standard empfohlen).
  Anschließend `license`-Feld in `package.json` und `src-tauri/Cargo.toml` setzen.
- `THIRD-PARTY-NOTICES.md` anlegen. Die App bündelt fremde Bestandteile, deren
  Lizenzen einen Hinweis im Auslieferungsumfang verlangen — der reine Link
  darauf genügt nicht:
  - **Schriften** in `public/fonts/` (Literata, IBM Plex Sans, IBM Plex Mono):
    SIL OFL 1.1. Lizenztext und die drei Copyright-Zeilen müssen mitgeliefert
    werden, siehe `public/fonts/README.md`.
  - **Symbole** in `src/components/Icon.tsx` (Lucide): ISC. 13 der 32 Glyphen
    stammen aus Feather und tragen zusätzlich MIT © Cole Bemis.
  - **libgit2 1.9.7**, über `libgit2-sys` einkompiliert: GPL-2.0 mit
    Linking-Ausnahme, die das Einbinden in Programme beliebiger Lizenz
    ausdrücklich erlaubt. Nennung genügt.
  - **MPL-2.0-Crates** (`epub-builder`, `cssparser`, `selectors`, `dtoa-short`,
    `option-ext`): dateibezogenes Copyleft, greift nur bei Änderungen an diesen
    Crates selbst. Nennung genügt.
  - Alle übrigen Abhängigkeiten (JS wie Rust) sind MIT/Apache-2.0; SQLite ist
    gemeinfrei. Keine davon schränkt die Lizenzwahl für den eigenen Code ein.
- README ggf. um Download-/Update-Hinweise ergänzen.
- SmartScreen-Warnung des unsignierten Windows-Installers wird bewusst akzeptiert
  (kein EV-Zertifikat, üblich bei kostenlosen Open-Source-Tools).

## Voraussetzungen vor dem Start

- [ ] GitHub-Remote fürs Repo (anlegen oder verknüpfen, spätestens zum Release public)
- [ ] Lizenz-Entscheidung (MIT oder Apache-2.0; Apache-2.0 gäbe zusätzlich eine
      ausdrückliche Patentlizenz)
- [ ] Update-Schlüsselpaar erzeugt und privater Schlüssel gesichert

## Sinnvolle Reihenfolge

1. Repo auf GitHub + Lizenz (Punkt 4, Voraussetzungen)
2. Updater einbauen (Punkt 2) — vor dem ersten Release, damit v0.1.0-Nutzer
   bereits Updates empfangen können
3. Release-Workflow + erster Tag `v0.1.0` (Punkt 1)
4. Landing Page in Ruhe gestalten (Punkt 3)
