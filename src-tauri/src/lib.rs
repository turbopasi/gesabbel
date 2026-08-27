mod project;

use project::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            project::create_project,
            project::open_project,
            project::close_project,
            project::read_scene,
            project::write_scene,
            project::create_node,
            project::rename_node,
            project::move_node,
            project::delete_node,
            project::check_external_changes,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
