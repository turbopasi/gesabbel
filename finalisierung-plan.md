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

Punkte 4, 2 und 1 sind **fertig** — Lizenz/Repo-Hygiene, Updater und
Release-Workflow. Offen ist Punkt 3 (Landing Page) und der Rest von Punkt 5.

Das Schlüsselpaar ist erzeugt, der private Schlüssel liegt im Passwortmanager
und als GitHub-Secret, der öffentliche in `tauri.conf.json`.

**Nächster Schritt: Tag `v0.1.0` pushen.**

```sh
git tag v0.1.0
git push origin v0.1.0
```

Das startet `release.yml`. Der Workflow baut die Windows-Installer, signiert sie
und legt ein **Release als Entwurf** an. Danach von Hand:

1. Installer aus dem Entwurf herunterladen und einmal wirklich installieren.
2. Release veröffentlichen — erst dann ist es `releases/latest` und erst dann
   sehen bestehende Installationen das Update.
3. Für den echten Test des Updaters: `version` in `tauri.conf.json` und
   `Cargo.toml` auf `0.1.1` heben, Tag `v0.1.1`, veröffentlichen — die
   installierte 0.1.0 muss den Banner zeigen.

---

## 1. Release-Workflow (GitHub Actions) — erledigt

`release.yml` neben der bestehenden `build.yml` (die bleibt CI auf `main`):

- Trigger: Push eines Tags `v*`. Nur Windows-Runner; Linux/macOS ergänzen,
  sobald dort getestet werden kann.
- `tauri-apps/tauri-action` baut MSI und NSIS-Setup, signiert sie, legt das
  Release an und hängt die Artefakte samt `latest.json` an
  (`includeUpdaterJson: true`).
- **`releaseDraft: true`** — das Release entsteht als Entwurf und wird erst
  durch Veröffentlichen zu `releases/latest`. Damit lässt sich der Installer
  ausprobieren, bevor irgendeine Installation das Update angeboten bekommt.
- `build.yml` hat dieselben Signatur-Secrets bekommen: mit
  `createUpdaterArtifacts` bricht `tauri build` sonst ab, weil ein öffentlicher
  Schlüssel ohne privaten konfiguriert ist.
- Kosten: auf öffentlichem Repo kostenlos.

**Welche Version zählt.** Maßgeblich ist `version` in `tauri.conf.json` — sie
landet im Installer, in den Eigenschaften der `.exe` und in `latest.json`, und
genau sie vergleicht der Updater. `Cargo.toml` ist nur Fallback (greift, wenn in
`tauri.conf.json` keine steht), `package.json` liest Tauri gar nicht. Beim
Anheben trotzdem `tauri.conf.json` und `Cargo.toml` gemeinsam ändern und die
mitgezogene `Cargo.lock` committen.

Der erste Schritt in `release.yml` bricht ab, wenn der Tag nicht zu beiden passt.
Ohne diese Prüfung wäre ein Tag `v0.1.1` auf einer 0.1.0-Konfiguration lautlos
durchgelaufen: Release heißt „v0.1.1", `latest.json` sagt `0.1.0`, kein
installiertes Exemplar sieht je ein Update — und nichts davon wird rot.

## 2. Tauri-Updater — erledigt

Kein eigener Server, alles über GitHub Releases:

- `tauri-plugin-updater` und `tauri-plugin-process` in `Cargo.toml`, `lib.rs`
  und `capabilities/default.json` (`updater:default`, `process:allow-restart`).
- `tauri.conf.json`: Endpoint
  `https://github.com/turbopasi/gesabbel/releases/latest/download/latest.json`
  (GitHub leitet automatisch aufs neueste Release um, nichts zu pflegen),
  öffentlicher Schlüssel, `installMode: passive`, `createUpdaterArtifacts`.
- UI: `src/components/UpdateBanner.tsx`, eingehängt in `App.tsx` neben den
  anderen Bannern. Prüft einmal beim Start, bietet Download mit Fortschritt und
  Neustart an. Schlägt die Prüfung fehl (kein Netz, noch kein Release), bleibt
  es bewusst stumm — ein Schreibprogramm soll beim Start nicht meckern.
- Im Entwicklungsmodus ist der Updater nicht aktiv; testbar nur mit zwei
  echten Releases.

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

- ~~**`paths-ignore` in `build.yml`.**~~ Erledigt: `**.md`, `LICENSE`, `NOTICE`
  und `docs/**` sind ausgenommen. `paths-ignore` greift nur, wenn *alle*
  geänderten Dateien passen — sobald `package-lock.json` oder `Cargo.lock` im
  Commit steckt, läuft die Notices-Prüfung also weiter.
- ~~**Wortmarke liegt im Bundle.**~~ Teilweise erledigt, mit einer Korrektur:
  „nur das README braucht sie" stimmte nicht. `gesabbel-wordmark.svg` wird von
  der App selbst als CSS-Maske im Startbildschirm verwendet
  (`.wordmark-mark` in `App.css`) und muss in `public/` bleiben. Verschoben ist
  nur die reine README-Variante `gesabbel-wordmark-on-dark.svg` nach
  `docs/brand/`. Gleich mitgenommen: `public/tauri.svg` (nirgends referenziert)
  und `public/vite.svg` (war das Favicon in `index.html`) sind gelöscht — beides
  fremde Logos im Bundle. Favicon ist jetzt `public/app-icon.png`, eine Kopie
  von `src-tauri/icons/32x32.png`.
- ~~**README um Download-/Update-Hinweise ergänzen**~~ — erledigt: Abschnitt
  „Installation" mit Link auf `releases/latest`, SmartScreen-Hinweis und
  Erklärung des Selbst-Updates.
- **SmartScreen-Warnung** des unsignierten Windows-Installers wird bewusst
  akzeptiert (kein EV-Zertifikat, üblich bei kostenlosen Open-Source-Tools).

## Voraussetzungen vor dem Start

- [x] GitHub-Remote — <https://github.com/turbopasi/gesabbel>, öffentlich
- [x] Lizenz-Entscheidung — Apache-2.0, Copyright Pascal Lamers
- [x] Eigenes App-Icon und Wortmarke
- [x] CI grün auf beiden Plattformen
- [x] Update-Schlüsselpaar erzeugt, privater Schlüssel im Passwortmanager und
      als Secrets `TAURI_SIGNING_PRIVATE_KEY` /
      `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` im Repo
- [x] Updater eingebaut (Punkt 2)
- [x] Release-Workflow (Punkt 1)
- [ ] **Tag `v0.1.0` pushen und Release veröffentlichen** ← hier weiter

## Sinnvolle Reihenfolge

1. ~~Updater einbauen (Punkt 2)~~ — vor dem ersten Release, damit v0.1.0-Nutzer
   bereits Updates empfangen können
2. ~~Release-Workflow~~ + erster Tag `v0.1.0` (Punkt 1)
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
  **Ist beim Einbau des Updaters gleich wieder passiert**: `npm install
  @tauri-apps/plugin-updater @tauri-apps/plugin-process` meldete nebenbei
  „removed 1 package" und warf `@floating-ui/dom` erneut hinaus. Nach jedem
  `npm install` also `npm ls @floating-ui/dom` prüfen; im Zweifel Lock neu
  aufbauen und danach `npm run notices` wiederholen.
- **CI-Logs sind ohne Admin-Rechte nicht über die API lesbar** (403). `gh` ist
  auf dem Rechner nicht installiert — entweder nachinstallieren oder die
  Fehlerzeilen aus dem Browser kopieren.
