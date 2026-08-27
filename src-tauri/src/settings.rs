//! Zentrale App-Einstellungen (Phase 7): Theming, Editor, Layout, Tastaturkürzel.
//!
//! Die Einstellungen sind app-weit, nicht projektgebunden, und liegen als
//! `settings.json` im App-Config-Verzeichnis (z. B. `%APPDATA%/<app>` unter
//! Windows). Das Backend behandelt sie als opakes JSON — Schema und Defaults
//! gehören dem Frontend (`src/settings.ts`), damit neue Optionen keine
//! Rust-Änderung brauchen.

use std::fs;
use std::path::PathBuf;
use tauri::Manager;

fn settings_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("App-Config-Verzeichnis nicht ermittelbar: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("Config-Verzeichnis nicht anlegbar: {e}"))?;
    Ok(dir.join("settings.json"))
}

#[tauri::command]
pub fn load_settings(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let path = settings_path(&app)?;
    if !path.exists() {
        return Ok(serde_json::Value::Null);
    }
    let text = fs::read_to_string(&path).map_err(|e| format!("Einstellungen nicht lesbar: {e}"))?;
    // Korrupte Datei → Null zurückgeben, Frontend fällt auf Defaults zurück.
    Ok(serde_json::from_str(&text).unwrap_or(serde_json::Value::Null))
}

#[tauri::command]
pub fn save_settings(app: tauri::AppHandle, settings: serde_json::Value) -> Result<(), String> {
    let path = settings_path(&app)?;
    let text = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&path, text).map_err(|e| format!("Einstellungen nicht speicherbar: {e}"))
}
