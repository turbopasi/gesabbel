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

**Erledigt.** Die Lizenzwahl fiel auf **Apache-2.0** (permissiv wie MIT, dazu
eine ausdrückliche Patentlizenz und eine Marken-Klausel), Copyright-Inhaber ist
Pascal Lamers. Umgesetzt:

- `LICENSE` (Apache-2.0-Volltext) und `NOTICE` im Wurzelverzeichnis;
  `license`-Feld in `package.json`, `src-tauri/Cargo.toml` und
  `tauri.conf.json` gesetzt.
- `THIRD-PARTY-NOTICES.md` wird **generiert** statt gepflegt:
  `npm run notices` (`scripts/generate-third-party-notices.mts`). Es liest den
  echten Abhängigkeitsbaum — Rust-Laufzeit-Crates für Windows und Linux, npm nur
  `--omit=dev` — und druckt jeden Lizenztext im Wortlaut ab. Aktuell 494
  Bestandteile. Der Build-Workflow bricht ab, wenn die Datei veraltet ist.
- Die Sonderfälle stehen als handgeschriebene Präambel im Generator: Schriften
  (OFL 1.1, Volltexte jetzt als `public/fonts/OFL-*.txt` gebündelt), Lucide-
  Symbole (ISC, 13 der 32 Glyphen zusätzlich MIT © Cole Bemis, Volltext als
  `src/components/Icon.LICENSE.txt`), libgit2 (GPL-2.0 mit Linking-Ausnahme),
  SQLite (gemeinfrei) und die MPL-2.0-Crates samt Quellcode-Bezugsquelle.
- Der Installer legt `LICENSE`, `NOTICE` und `THIRD-PARTY-NOTICES.md` neben die
  Anwendung (`bundle.resources` in `tauri.conf.json`); NSIS und WiX zeigen den
  Lizenztext zusätzlich im Installationsdialog (`bundle.licenseFile`).

Zwei Korrekturen an der ursprünglichen Einschätzung:

- „Alle übrigen Abhängigkeiten sind MIT/Apache-2.0" stimmte nicht ganz — im Baum
  stecken außerdem BSD-2/3-Clause, ISC, Zlib, Unicode-3.0, CC0, Unlicense und
  Python-2.0 (via `argparse`). Alle permissiv und Apache-2.0-verträglich, aber
  hinweispflichtig. Und auch MIT und BSD verlangen den Hinweis bei *binärer*
  Weitergabe — „Nennung genügt" gilt also für den gesamten Baum, nicht nur für
  die Sonderfälle. Genau deshalb der Generator.
- Die MPL-2.0 verlangt bei binärer Weitergabe zusätzlich die Angabe, **woher der
  Quellcode zu beziehen ist**. Steht jetzt in der Präambel.

Erledigt inzwischen auch:

- **App-Icon ersetzt.** Das Standard-Logo aus `create-tauri-app` (Marke der Tauri
  Programme within Commons Conservancy) ist raus, an seiner Stelle steht das
  eigene „g"-Icon. Die Vorlage liegt als `src-tauri/icons/source-1024.png`;
  neu erzeugen lässt sich der Satz mit
  `npm run tauri icon src-tauri/icons/source-1024.png`. Die dabei ebenfalls
  erzeugten iOS-/Android-Sätze sind gelöscht — Mobil ist kein Ziel.
- **Name festgelegt: Gesabbel.** „Schreibsoftware" war Platzhalter und steht nur
  noch dort, wo es als Gattungsbegriff gemeint ist. Umbenannt wurden
  Produktname, Fenstertitel, npm- und Cargo-Paket (`gesabbel`, `gesabbel_lib`),
  die Bundle-Identifier (`io.github.turbopasi.gesabbel`) sowie die
  `localStorage`-Schlüssel (`gesabbel.*`).

Offen:

- README um Download-/Update-Hinweise ergänzen (nach Punkt 1 und 2).
- SmartScreen-Warnung des unsignierten Windows-Installers wird bewusst akzeptiert
  (kein EV-Zertifikat, üblich bei kostenlosen Open-Source-Tools).

## Voraussetzungen vor dem Start

- [x] GitHub-Remote — <https://github.com/turbopasi/gesabbel>
- [x] Lizenz-Entscheidung — Apache-2.0, Copyright Pascal Lamers
- [x] Eigenes App-Icon
- [ ] Update-Schlüsselpaar erzeugt und privater Schlüssel gesichert

## Sinnvolle Reihenfolge

1. Repo auf GitHub (Punkt 4 im Übrigen erledigt)
2. Updater einbauen (Punkt 2) — vor dem ersten Release, damit v0.1.0-Nutzer
   bereits Updates empfangen können
3. Release-Workflow + erster Tag `v0.1.0` (Punkt 1)
4. Landing Page in Ruhe gestalten (Punkt 3)
