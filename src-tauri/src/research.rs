//! Recherche-Module (Phase 4): Personen-/Orte-Datenbank, Notizen, Zeitstrahl.
//!
//! Personen/Orte: eine JSON-Datei pro Eintrag in `characters/` bzw. `locations/`.
//! Notizen: `notes/<id>.md` + Titel-Index `notes/_index.json`.
//! Zeitstrahl: `timeline.json` (Reihenfolge = Array-Reihenfolge).

use crate::project::{
    make_id, mtime_ms, validate_id_pub, with_project, AppState, OpenProject, WriteResult,
};
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::fs;

// ---------------------------------------------------------------------------
// Personen & Orte
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EntityField {
    pub label: String,
    pub value: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Entity {
    #[serde(default)]
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub description: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub fields: Vec<EntityField>,
    /// Szenen, in denen die Person / der Ort vorkommt.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub scene_ids: Vec<String>,
    /// Dateiname des Bilds im Entity-Ordner (z. B. "anna-3f2a1b-img.png").
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub image: Option<String>,
}

fn entity_dir(kind: &str) -> Result<&'static str, String> {
    match kind {
        "characters" => Ok("characters"),
        "locations" => Ok("locations"),
        _ => Err(format!("Unbekannte Entity-Art: {kind}")),
    }
}

fn entity_rel_path(dir: &str, id: &str) -> String {
    format!("{dir}/{id}.json")
}

#[tauri::command]
pub fn list_entities(kind: String, state: tauri::State<AppState>) -> Result<Vec<Entity>, String> {
    let dir = entity_dir(&kind)?;
    with_project(&state, |p| {
        let mut out = Vec::new();
        let abs_dir = p.abs(dir);
        let entries = match fs::read_dir(&abs_dir) {
            Ok(e) => e,
            Err(_) => return Ok(out), // Ordner fehlt (altes Projekt) → leer
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("json") {
                continue;
            }
            let raw = fs::read_to_string(&path)
                .map_err(|e| format!("{} lesen: {e}", path.display()))?;
            match serde_json::from_str::<Entity>(&raw) {
                Ok(entity) => out.push(entity),
                Err(e) => return Err(format!("{} ungültig: {e}", path.display())),
            }
        }
        out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        Ok(out)
    })
}

#[tauri::command]
pub fn save_entity(
    kind: String,
    mut entity: Entity,
    state: tauri::State<AppState>,
) -> Result<Entity, String> {
    let dir = entity_dir(&kind)?;
    with_project(&state, |p| {
        if entity.name.trim().is_empty() {
            return Err("Name darf nicht leer sein".into());
        }
        if entity.id.is_empty() {
            entity.id = make_id(&entity.name);
        } else {
            validate_id_pub(&entity.id)?;
        }
        fs::create_dir_all(p.abs(dir)).map_err(|e| format!("{dir} anlegen: {e}"))?;
        let rel = entity_rel_path(dir, &entity.id);
        let json = serde_json::to_string_pretty(&entity)
            .map_err(|e| format!("Serialisierung: {e}"))?;
        fs::write(p.abs(&rel), json).map_err(|e| format!("{rel} schreiben: {e}"))?;
        p.note_mtime(&rel);
        p.search_dirty = true;
        Ok(entity.clone())
    })
}

#[tauri::command]
pub fn delete_entity(
    kind: String,
    id: String,
    state: tauri::State<AppState>,
) -> Result<(), String> {
    let dir = entity_dir(&kind)?;
    validate_id_pub(&id)?;
    with_project(&state, |p| {
        let trash = p.root.join(".trash");
        fs::create_dir_all(&trash).map_err(|e| format!(".trash anlegen: {e}"))?;
        let stamp = chrono::Local::now().format("%Y%m%d-%H%M%S");
        let rel = entity_rel_path(dir, &id);
        let src = p.abs(&rel);
        if src.exists() {
            fs::rename(&src, trash.join(format!("{stamp}-{id}.json")))
                .map_err(|e| format!("In Papierkorb verschieben: {e}"))?;
        }
        p.known_mtimes.remove(&rel);
        p.search_dirty = true;
        Ok(())
    })
}

/// Kopiert ein Bild in den Entity-Ordner und trägt es im Eintrag ein.
#[tauri::command]
pub fn set_entity_image(
    kind: String,
    id: String,
    source_path: String,
    state: tauri::State<AppState>,
) -> Result<Entity, String> {
    let dir = entity_dir(&kind)?;
    validate_id_pub(&id)?;
    let ext = std::path::Path::new(&source_path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .ok_or("Datei hat keine Endung")?;
    if !["png", "jpg", "jpeg", "gif", "webp"].contains(&ext.as_str()) {
        return Err(format!("Nicht unterstütztes Bildformat: .{ext}"));
    }
    with_project(&state, |p| {
        let rel = entity_rel_path(dir, &id);
        let raw = fs::read_to_string(p.abs(&rel)).map_err(|e| format!("{rel} lesen: {e}"))?;
        let mut entity: Entity =
            serde_json::from_str(&raw).map_err(|e| format!("{rel} ungültig: {e}"))?;

        let image_name = format!("{id}-img.{ext}");
        fs::copy(&source_path, p.abs(dir).join(&image_name))
            .map_err(|e| format!("Bild kopieren: {e}"))?;
        entity.image = Some(image_name);

        let json = serde_json::to_string_pretty(&entity)
            .map_err(|e| format!("Serialisierung: {e}"))?;
        fs::write(p.abs(&rel), json).map_err(|e| format!("{rel} schreiben: {e}"))?;
        p.note_mtime(&rel);
        Ok(entity)
    })
}

/// Liefert das Entity-Bild als data-URL (base64) — vermeidet Asset-Protocol-Scopes.
#[tauri::command]
pub fn get_entity_image(
    kind: String,
    id: String,
    state: tauri::State<AppState>,
) -> Result<Option<String>, String> {
    let dir = entity_dir(&kind)?;
    validate_id_pub(&id)?;
    with_project(&state, |p| {
        let rel = entity_rel_path(dir, &id);
        let raw = match fs::read_to_string(p.abs(&rel)) {
            Ok(r) => r,
            Err(_) => return Ok(None),
        };
        let entity: Entity =
            serde_json::from_str(&raw).map_err(|e| format!("{rel} ungültig: {e}"))?;
        let Some(image) = entity.image else {
            return Ok(None);
        };
        let bytes = match fs::read(p.abs(dir).join(&image)) {
            Ok(b) => b,
            Err(_) => return Ok(None),
        };
        let mime = match image.rsplit('.').next().unwrap_or("") {
            "jpg" | "jpeg" => "image/jpeg",
            "gif" => "image/gif",
            "webp" => "image/webp",
            _ => "image/png",
        };
        let b64 = base64::engine::general_purpose::STANDARD.encode(bytes);
        Ok(Some(format!("data:{mime};base64,{b64}")))
    })
}

// ---------------------------------------------------------------------------
// Notizen
// ---------------------------------------------------------------------------

pub const NOTES_INDEX: &str = "notes/_index.json";

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NoteInfo {
    pub id: String,
    pub title: String,
}

pub(crate) fn note_rel_path(id: &str) -> String {
    format!("notes/{id}.md")
}

pub(crate) fn list_note_infos(p: &OpenProject) -> Vec<NoteInfo> {
    fs::read_to_string(p.abs(NOTES_INDEX))
        .ok()
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default()
}

fn save_note_index(p: &mut OpenProject, notes: &[NoteInfo]) -> Result<(), String> {
    let json =
        serde_json::to_string_pretty(notes).map_err(|e| format!("Serialisierung: {e}"))?;
    fs::create_dir_all(p.abs("notes")).map_err(|e| format!("notes anlegen: {e}"))?;
    fs::write(p.abs(NOTES_INDEX), json).map_err(|e| format!("{NOTES_INDEX} schreiben: {e}"))?;
    p.note_mtime(NOTES_INDEX);
    p.search_dirty = true;
    Ok(())
}

#[tauri::command]
pub fn list_notes(state: tauri::State<AppState>) -> Result<Vec<NoteInfo>, String> {
    with_project(&state, |p| Ok(list_note_infos(p)))
}

#[tauri::command]
pub fn create_note(title: String, state: tauri::State<AppState>) -> Result<Vec<NoteInfo>, String> {
    with_project(&state, |p| {
        let id = make_id(&title);
        fs::create_dir_all(p.abs("notes")).map_err(|e| format!("notes anlegen: {e}"))?;
        let rel = note_rel_path(&id);
        fs::write(p.abs(&rel), "").map_err(|e| format!("Notiz anlegen: {e}"))?;
        p.note_mtime(&rel);
        let mut notes = list_note_infos(p);
        notes.push(NoteInfo { id, title });
        save_note_index(p, &notes)?;
        Ok(notes)
    })
}

#[tauri::command]
pub fn rename_note(
    id: String,
    title: String,
    state: tauri::State<AppState>,
) -> Result<Vec<NoteInfo>, String> {
    with_project(&state, |p| {
        let mut notes = list_note_infos(p);
        let note = notes
            .iter_mut()
            .find(|n| n.id == id)
            .ok_or(format!("Notiz nicht gefunden: {id}"))?;
        note.title = title;
        save_note_index(p, &notes)?;
        Ok(notes)
    })
}

#[tauri::command]
pub fn delete_note(id: String, state: tauri::State<AppState>) -> Result<Vec<NoteInfo>, String> {
    validate_id_pub(&id)?;
    with_project(&state, |p| {
        let mut notes = list_note_infos(p);
        notes.retain(|n| n.id != id);
        let trash = p.root.join(".trash");
        fs::create_dir_all(&trash).map_err(|e| format!(".trash anlegen: {e}"))?;
        let stamp = chrono::Local::now().format("%Y%m%d-%H%M%S");
        let rel = note_rel_path(&id);
        let src = p.abs(&rel);
        if src.exists() {
            fs::rename(&src, trash.join(format!("{stamp}-{id}.md")))
                .map_err(|e| format!("In Papierkorb verschieben: {e}"))?;
        }
        p.known_mtimes.remove(&rel);
        save_note_index(p, &notes)?;
        Ok(notes)
    })
}

#[tauri::command]
pub fn read_note(id: String, state: tauri::State<AppState>) -> Result<String, String> {
    validate_id_pub(&id)?;
    with_project(&state, |p| {
        let rel = note_rel_path(&id);
        let content =
            fs::read_to_string(p.abs(&rel)).map_err(|e| format!("Notiz lesen ({id}): {e}"))?;
        p.note_mtime(&rel);
        Ok(content)
    })
}

#[tauri::command]
pub fn write_note(
    id: String,
    content: String,
    force: bool,
    state: tauri::State<AppState>,
) -> Result<WriteResult, String> {
    validate_id_pub(&id)?;
    with_project(&state, |p| {
        let rel = note_rel_path(&id);
        let path = p.abs(&rel);
        if !force {
            if let (Some(known), Some(current)) =
                (p.known_mtimes.get(&rel), mtime_ms(&path))
            {
                if current != *known {
                    return Ok(WriteResult::Conflict);
                }
            }
        }
        fs::write(&path, &content).map_err(|e| format!("Notiz schreiben ({id}): {e}"))?;
        p.note_mtime(&rel);
        p.search_dirty = true;
        Ok(WriteResult::Ok)
    })
}

// ---------------------------------------------------------------------------
// Zeitstrahl
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TimelineEvent {
    pub id: String,
    pub title: String,
    /// Freitext-Zeitangabe ("3. März 1899", "Tag 12", …) — bewusst kein
    /// Datumsformat, damit auch fiktive Kalender funktionieren.
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub when: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub description: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub scene_ids: Vec<String>,
}

#[derive(Serialize, Deserialize, Default)]
struct TimelineFile {
    #[serde(default)]
    events: Vec<TimelineEvent>,
}

#[tauri::command]
pub fn load_timeline(state: tauri::State<AppState>) -> Result<Vec<TimelineEvent>, String> {
    with_project(&state, |p| {
        let file: TimelineFile = fs::read_to_string(p.abs("timeline.json"))
            .ok()
            .and_then(|raw| serde_json::from_str(&raw).ok())
            .unwrap_or_default();
        Ok(file.events)
    })
}

#[tauri::command]
pub fn save_timeline(
    mut events: Vec<TimelineEvent>,
    state: tauri::State<AppState>,
) -> Result<Vec<TimelineEvent>, String> {
    with_project(&state, |p| {
        for ev in events.iter_mut() {
            if ev.id.is_empty() {
                ev.id = make_id(&ev.title);
            }
        }
        let json = serde_json::to_string_pretty(&TimelineFile {
            events: events.clone(),
        })
        .map_err(|e| format!("Serialisierung: {e}"))?;
        fs::write(p.abs("timeline.json"), json)
            .map_err(|e| format!("timeline.json schreiben: {e}"))?;
        p.note_mtime("timeline.json");
        p.search_dirty = true;
        Ok(events)
    })
}
