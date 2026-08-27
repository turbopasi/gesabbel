# Schreibsoftware

Desktop-Schreibsoftware für Autoren, gebaut mit Tauri 2.x (React + TypeScript + Vite).
Kombiniert die besten Features von Scrivener (Binder, Corkboard, flexibler Export) und
Papyrus Autor (deutsche Normseite, Zeitstrahl, Personen-/Ortsdatenbank).

**Zielplattformen:** Windows, Linux (macOS später)
**Lizenz:** Kostenlos, Open Source

Der vollständige Entwicklungsplan steht in [dev-plan-schreibsoftware.md](dev-plan-schreibsoftware.md).

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
