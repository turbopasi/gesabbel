/// Platzhalter-Command zum Verifizieren der Frontend↔Backend-IPC (Phase 0).
#[tauri::command]
fn app_info() -> String {
    format!(
        "Backend erreichbar — Tauri {}, Version {}",
        tauri::VERSION,
        env!("CARGO_PKG_VERSION")
    )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![app_info])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
