# Gesabbel

Desktop-Schreibsoftware für Autoren, gebaut mit Tauri 2.x (React + TypeScript + Vite).
Kombiniert die besten Features von Scrivener (Binder, Corkboard, flexibler Export) und
Papyrus Autor (deutsche Normseite, Zeitstrahl, Personen-/Ortsdatenbank).

**Zielplattformen:** Windows, Linux (macOS später)
**Lizenz:** Apache-2.0 — kostenlos und Open Source

**Kernprinzip Datenformat:** Ein Projekt ist ein Ordner mit vielen kleinen Dateien
(`.autorproj`, analog Scriveners `.scriv`-Package) — keine einzelne SQLite- oder
JSON-Datei. Das ermöglicht sichere Cloud-Synchronisation über Dropbox & Co. und
sinnvolles Git-Diffing. SQLite dient nur als regenerierbarer Such-/Index-Cache
(`.cache/index.sqlite`, nicht versioniert).

Die restlichen Schritte bis zum ersten Release stehen in [finalisierung-plan.md](finalisierung-plan.md).

## Entwicklung

Voraussetzungen: Node LTS, Rust (stable), plattformspezifische Tauri-Dependencies
(siehe <https://tauri.app/start/prerequisites/>).

```sh
npm install
npm run tauri dev     # Entwicklungsmodus
npm run tauri build   # Release-Build (.exe/.msi bzw. .AppImage/.deb)
```

## Projektstruktur

- `src/` — React-Frontend
- `src-tauri/` — Rust-Backend (Tauri Commands)
- `.github/workflows/build.yml` — CI-Builds für Windows + Linux

## Lizenz

Der eigene Code steht unter der [Apache-Lizenz 2.0](LICENSE) — Nutzung,
Veränderung und Weitergabe sind frei, auch kommerziell; einzige Auflage ist,
Copyright- und Lizenzhinweis zu erhalten.

Die Anwendung bündelt Bestandteile Dritter (Schriften, Symbole, Bibliotheken),
deren Lizenzen einen Hinweis im Auslieferungsumfang verlangen. Diese Hinweise
stehen vollständig in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) und
werden vom Installer neben die Anwendung gelegt.

Die Datei wird aus dem tatsächlichen Abhängigkeitsbaum erzeugt und muss nach
jeder Änderung an `package.json` oder `src-tauri/Cargo.toml` neu geschrieben
werden:

```sh
npm run notices
```
