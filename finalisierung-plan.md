# Finalisierungs-Plan (ehemals Phase 8)

Stand: 2026-08-29. Phasen 0–7 des ursprünglichen Dev-Plans sind umgesetzt.
Dieses Dokument sammelt die restlichen Schritte bis zum ersten öffentlichen Release.

**Getroffene Entscheidungen:**
- Name: **Gesabbel** (bis 29.08. Platzhalter „Schreibsoftware").
- Lizenz: **Apache-2.0**, Copyright Pascal Lamers.
- Distribution: Open Source via GitHub, Releases mit Ready-to-use-Builds im Repo.
  Repo: <https://github.com/turbopasi/gesabbel> (öffentlich).
- Erstmal **nur Windows-Builds** (nur Windows zum Testen verfügbar). Linux/macOS später.
- Kein Remote-Git-Backup der Versionshistorie (Erweiterungspunkt bleibt nur im Code vorgemerkt).
- Kein eigener Server für irgendetwas — alles läuft über GitHub (Actions, Releases, Pages).

---

## Wo wir stehen

Punkt 4 (Lizenz & Repo-Hygiene) ist **fertig**. Punkte 1–3 stehen noch aus.

Der Code liegt öffentlich auf GitHub, die CI (`build.yml`) läuft auf `main` grün
durch und legt für beide Plattformen Bundles als Artefakte ab. Damit ist die
Grundlage für die Release-Pipeline da: sie wird dieselben Schritte verwenden.

**Nächster Schritt beim Wiedereinstieg — Punkt 2, Updater.** Und zwar beginnt er
mit einer Sache, die **Pascal selbst machen muss**:

```sh
npm run tauri signer generate
```

Der private Schlüssel gehört als GitHub-Actions-Secret `TAURI_SIGNING_PRIVATE_KEY`
ins Repo und zusätzlich in einen Passwortmanager. Er darf **nicht** durch einen
Chat-Verlauf laufen und nicht ins Repo committet werden. Geht er verloren, kann
keine installierte Version je wieder ein Update annehmen — dann hilft nur noch
manuelle Neuinstallation bei allen Nutzern. Der öffentliche Schlüssel ist
unkritisch und kommt in `tauri.conf.json`.

Erst danach: Updater einbauen, dann Release-Workflow, dann Tag `v0.1.0`.
Reihenfolge steht unten.

---

## 1. Release-Workflow (GitHub Actions)

Neuer Workflow zusätzlich zur bestehenden `build.yml` (die bleibt als CI auf `main`):

- Trigger: Push eines Versions-Tags (z. B. `v0.1.0`).
- Offizielles `tauri-action` verwenden: baut den Windows-Installer (MSI/NSIS),
  erzeugt ein GitHub Release und hängt die Artefakte an.
- Signiert die Artefakte mit dem Tauri-Update-Schlüssel und erzeugt automatisch
  die `latest.json` fürs Update-Manifest (siehe Punkt 2).
- Nur Windows-Runner; Linux/macOS-Matrix erst ergänzen, wenn testbar.
- Kosten: Auf öffentlichem Repo kostenlos, unbegrenzt.

## 2. Tauri-Updater

Kein eigener Server nötig, läuft komplett über GitHub Releases:

- Einmalig Schlüsselpaar erzeugen — siehe „Wo wir stehen" oben.
- `tauri-plugin-updater` einbauen; Endpoint:
  `https://github.com/turbopasi/gesabbel/releases/latest/download/latest.json`
  (GitHub leitet automatisch aufs neueste Release um, nichts zu pflegen).
- UI: Beim App-Start prüfen, Update-Hinweis mit Download + Selbst-Update anbieten.
- Voraussetzung „Repo öffentlich" ist erfüllt.

## 3. Landing Page (GitHub Pages)

Bewusst zurückgestellt — soll später **schön gestaltet** werden, kein Quick-Job.
Grobe Eckpunkte: statische Seite via GitHub Pages, Kurzbeschreibung, Screenshots,
Download-Button auf `releases/latest`. Die Wortmarke aus `public/brand/` liegt
schon bereit.

Sobald die Seite live ist, kann in Österreich die Offenlegungspflicht nach ECG
greifen — dann dort Name und Kontakt hinterlegen.

## 4. Lizenz & Repo-Hygiene — erledigt

- `LICENSE` (Apache-2.0-Volltext) und `NOTICE` im Wurzelverzeichnis;
  `license`-Feld in `package.json`, `src-tauri/Cargo.toml` und `tauri.conf.json`.
- `THIRD-PARTY-NOTICES.md` wird **generiert**, nie von Hand bearbeitet:
  `npm run notices` (`scripts/generate-third-party-notices.mts`). Es liest den
  echten Abhängigkeitsbaum — Rust-Laufzeit-Crates für Windows und Linux, npm nur
  `--omit=dev` — und druckt jeden Lizenztext im Wortlaut ab. Aktuell 494
  Bestandteile. `build.yml` bricht ab, wenn die Datei veraltet ist; nach jeder
  Änderung an `package.json` oder `Cargo.toml` also neu erzeugen und committen.
- Sonderfälle stehen als handgeschriebene Präambel im Generator: Schriften
  (OFL 1.1, Volltexte als `public/fonts/OFL-*.txt`), Lucide-Symbole (ISC, 13 der
  32 Glyphen zusätzlich MIT © Cole Bemis, `src/components/Icon.LICENSE.txt`),
  libgit2 (GPL-2.0 mit Linking-Ausnahme), SQLite (gemeinfrei) und die
  MPL-2.0-Crates samt Quellcode-Bezugsquelle.
- Der Installer legt `LICENSE`, `NOTICE` und `THIRD-PARTY-NOTICES.md` neben die
  Anwendung (`bundle.resources`); NSIS und WiX zeigen den Lizenztext zusätzlich
  im Installationsdialog (`bundle.licenseFile`).
- Eigenes App-Icon statt des Tauri-Standardlogos (das eine fremde Marke war).
  Vorlage: `src-tauri/icons/source-1024.png`, neu erzeugen mit
  `npm run tauri icon src-tauri/icons/source-1024.png`. Die dabei ebenfalls
  erzeugten iOS-/Android-Sätze sind gelöscht — Mobil ist kein Ziel.
- Bundle-Identifier `io.github.turbopasi.gesabbel` (Reverse-DNS über den
  GitHub-Account, das Schema, das Flathub später ohnehin verlangt).

Zwei Korrekturen an der ursprünglichen Einschätzung, festgehalten damit sie nicht
wieder verloren geht:

- „Alle übrigen Abhängigkeiten sind MIT/Apache-2.0" stimmte nicht — im Baum
  stecken außerdem BSD-2/3-Clause, ISC, Zlib, Unicode-3.0, CC0, Unlicense und
  Python-2.0. Alle permissiv und Apache-2.0-verträglich, aber hinweispflichtig.
  Und auch MIT und BSD verlangen den Hinweis bei *binärer* Weitergabe — die
  Pflicht gilt für den gesamten Baum, nicht nur für die Sonderfälle.
- Die MPL-2.0 verlangt bei binärer Weitergabe zusätzlich die Angabe, woher der
  Quellcode zu beziehen ist.

## 5. Kleinkram

Kein Blocker, aber beim nächsten Anfassen von `build.yml` bzw. dem README
mitnehmen:

- **`paths-ignore` in `build.yml`.** Ein README-Commit löst derzeit einen vollen
  Rust-Release-Build auf zwei Runnern aus. `**.md`, `LICENSE`, `NOTICE` und
  `docs/**` ausnehmen — aber aufpassen, dass die Notices-Prüfung weiterhin
  läuft, wenn `package-lock.json` oder `Cargo.lock` sich ändern.
- **Wortmarke liegt im Bundle.** `public/` wird unverändert nach `dist/` kopiert
  und `dist/` ist das Frontend im Binary, also reisen die ~35 KB
  `public/brand/*.svg` in der App mit, obwohl nur das README sie braucht.
  `docs/brand/` wäre der richtige Ort; README-Pfade müssten mitwandern.
- **README um Download-/Update-Hinweise ergänzen**, sobald Releases existieren.
- **SmartScreen-Warnung** des unsignierten Windows-Installers wird bewusst
  akzeptiert (kein EV-Zertifikat, üblich bei kostenlosen Open-Source-Tools).

## Voraussetzungen vor dem Start

- [x] GitHub-Remote — <https://github.com/turbopasi/gesabbel>, öffentlich
- [x] Lizenz-Entscheidung — Apache-2.0, Copyright Pascal Lamers
- [x] Eigenes App-Icon und Wortmarke
- [x] CI grün auf beiden Plattformen
- [ ] **Update-Schlüsselpaar erzeugt und privater Schlüssel gesichert** ← hier weiter

## Sinnvolle Reihenfolge

1. Updater einbauen (Punkt 2) — vor dem ersten Release, damit v0.1.0-Nutzer
   bereits Updates empfangen können
2. Release-Workflow + erster Tag `v0.1.0` (Punkt 1)
3. Landing Page in Ruhe gestalten (Punkt 3)

## Nützliche Befehle

```sh
npm run tauri dev      # Entwicklungsmodus
npm run tauri build    # Release-Build (MSI + NSIS bzw. AppImage + deb)
npm run notices        # THIRD-PARTY-NOTICES.md neu erzeugen
npm run build          # nur Frontend, inkl. tsc
npx tsx scripts/align-roundtrip.test.mts
npx tsx scripts/plan-tag-roundtrip.test.mts
```

## Fallstricke, die schon zugeschlagen haben

- **Lockfile war unvollständig.** `@floating-ui/dom` fehlte als Paket-Eintrag,
  obwohl zwei Tiptap-Pakete es verlangen. `npm ci` lief lokal trotzdem mit
  Exit-Code 0 durch und legte einen unvollständigen Baum an — auf den CI-Runnern
  brach es ab. Geheilt durch Neuaufbau (`rm -rf node_modules package-lock.json &&
  npm install`). Bei rätselhaften CI-Fehlern am `npm ci` also zuerst prüfen, ob
  jede deklarierte Abhängigkeit auch einen `packages`-Eintrag im Lock hat.
- **CI-Logs sind ohne Admin-Rechte nicht über die API lesbar** (403). `gh` ist
  auf dem Rechner nicht installiert — entweder nachinstallieren oder die
  Fehlerzeilen aus dem Browser kopieren.
