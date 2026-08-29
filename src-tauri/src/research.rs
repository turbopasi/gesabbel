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

/// Freitext-Dokument einer Person / eines Orts (liegt neben der JSON-Metadatei).
pub(crate) fn entity_doc_rel(dir: &str, id: &str) -> String {
    format!("{dir}/{id}.md")
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
        let doc_rel = entity_doc_rel(dir, &id);
        let doc_src = p.abs(&doc_rel);
        if doc_src.exists() {
            fs::rename(&doc_src, trash.join(format!("{stamp}-{id}.md")))
                .map_err(|e| format!("In Papierkorb verschieben: {e}"))?;
        }
        p.known_mtimes.remove(&doc_rel);
        p.search_dirty = true;
        Ok(())
    })
}

/// Patcht nur die Metadaten eines Eintrags (Name, Szenen-Verknüpfungen) —
/// liest den aktuellen Stand von Platte, damit das Frontend nie versehentlich
/// alte Formulardaten (description/fields) zurückschreibt.
#[tauri::command]
pub fn update_entity_meta(
    kind: String,
    id: String,
    name: Option<String>,
    scene_ids: Option<Vec<String>>,
    state: tauri::State<AppState>,
) -> Result<Entity, String> {
    let dir = entity_dir(&kind)?;
    validate_id_pub(&id)?;
    with_project(&state, |p| {
        let rel = entity_rel_path(dir, &id);
        let raw = fs::read_to_string(p.abs(&rel)).map_err(|e| format!("{rel} lesen: {e}"))?;
        let mut entity: Entity =
            serde_json::from_str(&raw).map_err(|e| format!("{rel} ungültig: {e}"))?;
        if let Some(name) = name {
            if name.trim().is_empty() {
                return Err("Name darf nicht leer sein".into());
            }
            entity.name = name;
        }
        if let Some(scene_ids) = scene_ids {
            entity.scene_ids = scene_ids;
        }
        let json = serde_json::to_string_pretty(&entity)
            .map_err(|e| format!("Serialisierung: {e}"))?;
        fs::write(p.abs(&rel), json).map_err(|e| format!("{rel} schreiben: {e}"))?;
        p.note_mtime(&rel);
        p.search_dirty = true;
        Ok(entity)
    })
}

/// Liest das Freitext-Dokument einer Person / eines Orts. Alt-Einträge, die
/// noch Beschreibung + freie Felder im JSON tragen (früheres Formular),
/// werden beim ersten Zugriff nach Markdown migriert.
#[tauri::command]
pub fn read_entity_doc(
    kind: String,
    id: String,
    state: tauri::State<AppState>,
) -> Result<String, String> {
    let dir = entity_dir(&kind)?;
    validate_id_pub(&id)?;
    with_project(&state, |p| {
        let rel = entity_doc_rel(dir, &id);
        let path = p.abs(&rel);
        if !path.exists() {
            let json_rel = entity_rel_path(dir, &id);
            let raw = fs::read_to_string(p.abs(&json_rel))
                .map_err(|e| format!("{json_rel} lesen: {e}"))?;
            let mut entity: Entity =
                serde_json::from_str(&raw).map_err(|e| format!("{json_rel} ungültig: {e}"))?;

            let mut doc = entity.description.trim().to_string();
            if !entity.fields.is_empty() {
                if !doc.is_empty() {
                    doc.push_str("\n\n");
                }
                for f in &entity.fields {
                    doc.push_str(&format!("- **{}:** {}\n", f.label, f.value));
                }
            }
            fs::write(&path, &doc).map_err(|e| format!("{rel} schreiben: {e}"))?;

            // Formulardaten aus dem JSON entfernen — das Dokument ist jetzt die Quelle.
            entity.description = String::new();
            entity.fields = Vec::new();
            let json = serde_json::to_string_pretty(&entity)
                .map_err(|e| format!("Serialisierung: {e}"))?;
            fs::write(p.abs(&json_rel), json).map_err(|e| format!("{json_rel} schreiben: {e}"))?;

            p.note_mtime(&json_rel);
            p.note_mtime(&rel);
            p.search_dirty = true;
            return Ok(doc);
        }
        let content = fs::read_to_string(&path).map_err(|e| format!("{rel} lesen: {e}"))?;
        p.note_mtime(&rel);
        Ok(content)
    })
}

#[tauri::command]
pub fn write_entity_doc(
    kind: String,
    id: String,
    content: String,
    force: bool,
    state: tauri::State<AppState>,
) -> Result<WriteResult, String> {
    let dir = entity_dir(&kind)?;
    validate_id_pub(&id)?;
    with_project(&state, |p| {
        let rel = entity_doc_rel(dir, &id);
        let path = p.abs(&rel);
        if !force {
            if let (Some(known), Some(current)) = (p.known_mtimes.get(&rel), mtime_ms(&path)) {
                if current != *known {
                    return Ok(WriteResult::Conflict);
                }
            }
        }
        fs::write(&path, &content).map_err(|e| format!("{rel} schreiben: {e}"))?;
        p.note_mtime(&rel);
        p.search_dirty = true;
        Ok(WriteResult::Ok)
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
// Dokument-Bilder (inline in Szenen und Recherche-Dokumenten)
// ---------------------------------------------------------------------------

const IMAGE_EXTS: [&str; 5] = ["png", "jpg", "jpeg", "gif", "webp"];

fn image_mime(ext: &str) -> &'static str {
    match ext {
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        _ => "image/png",
    }
}

/// Speichert ein eingefügtes Bild (z. B. Screenshot aus der Zwischenablage)
/// unter `images/` und liefert den projektrelativen Pfad fürs Markdown.
#[tauri::command]
pub fn save_doc_image(
    data_base64: String,
    ext: String,
    state: tauri::State<AppState>,
) -> Result<String, String> {
    let ext = ext.to_lowercase();
    if !IMAGE_EXTS.contains(&ext.as_str()) {
        return Err(format!("Nicht unterstütztes Bildformat: .{ext}"));
    }
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&data_base64)
        .map_err(|e| format!("Bilddaten ungültig: {e}"))?;
    with_project(&state, |p| {
        fs::create_dir_all(p.abs("images")).map_err(|e| format!("images anlegen: {e}"))?;
        let id = make_id("bild");
        let rel = format!("images/{id}.{ext}");
        fs::write(p.abs(&rel), &bytes).map_err(|e| format!("{rel} schreiben: {e}"))?;
        Ok(rel)
    })
}

/// Kopiert eine Bilddatei (Dateidialog) nach `images/` und liefert den
/// projektrelativen Pfad — Gegenstück zu `save_doc_image` für die Zwischenablage.
#[tauri::command]
pub fn import_doc_image(
    source_path: String,
    state: tauri::State<AppState>,
) -> Result<String, String> {
    let ext = std::path::Path::new(&source_path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .ok_or("Datei hat keine Endung")?;
    if !IMAGE_EXTS.contains(&ext.as_str()) {
        return Err(format!("Nicht unterstütztes Bildformat: .{ext}"));
    }
    with_project(&state, |p| {
        fs::create_dir_all(p.abs("images")).map_err(|e| format!("images anlegen: {e}"))?;
        let id = make_id("bild");
        let rel = format!("images/{id}.{ext}");
        fs::copy(&source_path, p.abs(&rel)).map_err(|e| format!("Bild kopieren: {e}"))?;
        Ok(rel)
    })
}

/// Liefert ein Dokument-Bild als data-URL (base64) — vermeidet Asset-Protocol-Scopes.
#[tauri::command]
pub fn read_doc_image(
    rel: String,
    state: tauri::State<AppState>,
) -> Result<Option<String>, String> {
    if !rel.starts_with("images/") || rel.contains("..") || rel.contains('\\') {
        return Err(format!("Ungültiger Bildpfad: {rel}"));
    }
    let ext = rel.rsplit('.').next().unwrap_or("").to_lowercase();
    if !IMAGE_EXTS.contains(&ext.as_str()) {
        return Err(format!("Ungültiger Bildpfad: {rel}"));
    }
    with_project(&state, |p| {
        let bytes = match fs::read(p.abs(&rel)) {
            Ok(b) => b,
            Err(_) => return Ok(None),
        };
        let b64 = base64::engine::general_purpose::STANDARD.encode(bytes);
        Ok(Some(format!("data:{};base64,{b64}", image_mime(&ext))))
    })
}

// ---------------------------------------------------------------------------
// Planungs-Tags: Rückverlinkung
// ---------------------------------------------------------------------------
//
// Tags stehen als Markdown-Link mit eigenem Schema im Fließtext:
// `[Er](person:jonas-3f2a1b)`. Für die Rückrichtung ("wo kommt Jonas vor?")
// werden die Klartextdateien durchsucht. Bewusst kein Index: der Aufwand
// entspricht einem Suchindex-Rebuild und die Daten können nie veralten.

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Mention {
    /// "scene" | "note" | "character" | "location"
    pub source: String,
    pub source_id: String,
    pub source_title: String,
    /// Das getaggte Wort im Fließtext ("Er", "Seine", "Jonas", …).
    pub label: String,
    /// Umgebender Absatz als Vorschau (ohne Tag-Syntax).
    pub context: String,
}

struct FoundTag<'a> {
    label: &'a str,
    kind: &'a str,
    id: &'a str,
    /// Byte-Index hinter der schließenden Klammer.
    end: usize,
}

fn is_tag_kind(kind: &str) -> bool {
    matches!(kind, "person" | "location" | "note")
}

/// Liest einen Planungs-Tag, der an `start` mit '[' beginnt.
fn plan_tag_at(s: &str, start: usize) -> Option<FoundTag<'_>> {
    let rest = &s[start + 1..];
    let close = rest.find("](")?;
    let label = &rest[..close];
    if label.contains('[') {
        return None;
    }
    let target_start = start + 1 + close + 2;
    let paren = s[target_start..].find(')')?;
    let target = &s[target_start..target_start + paren];
    let (kind, id) = target.split_once(':')?;
    if !is_tag_kind(kind) || id.is_empty() {
        return None;
    }
    if !id.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-') {
        return None;
    }
    Some(FoundTag { label, kind, id, end: target_start + paren + 1 })
}

/// Entfernt die Tag-Syntax aus einer Zeile, damit die Vorschau lesbar ist.
fn strip_plan_tags(line: &str) -> String {
    let mut out = String::new();
    let mut i = 0;
    while i < line.len() {
        if line.as_bytes()[i] == b'[' {
            if let Some(tag) = plan_tag_at(line, i) {
                out.push_str(tag.label);
                i = tag.end;
                continue;
            }
        }
        let ch = line[i..].chars().next().unwrap();
        out.push(ch);
        i += ch.len_utf8();
    }
    out
}

fn shorten(s: &str, max: usize) -> String {
    let trimmed = s.trim();
    if trimmed.chars().count() <= max {
        return trimmed.to_string();
    }
    let cut: String = trimmed.chars().take(max).collect();
    format!("{}…", cut.trim_end())
}

fn collect_mentions(
    text: &str,
    kind: &str,
    id: &str,
    source: &str,
    source_id: &str,
    source_title: &str,
    out: &mut Vec<Mention>,
) {
    for line in text.lines() {
        let mut hits: Vec<&str> = Vec::new();
        let mut i = 0;
        while i < line.len() {
            if line.as_bytes()[i] == b'[' {
                if let Some(tag) = plan_tag_at(line, i) {
                    if tag.kind == kind && tag.id == id {
                        hits.push(tag.label);
                    }
                    i = tag.end;
                    continue;
                }
            }
            i += line[i..].chars().next().map(char::len_utf8).unwrap_or(1);
        }
        if hits.is_empty() {
            continue;
        }
        let context = shorten(&strip_plan_tags(line), 180);
        for label in hits {
            out.push(Mention {
                source: source.to_string(),
                source_id: source_id.to_string(),
                source_title: source_title.to_string(),
                label: label.to_string(),
                context: context.clone(),
            });
        }
    }
}

fn collect_scene_titles(nodes: &[crate::project::BinderNode], out: &mut Vec<(String, String)>) {
    for n in nodes {
        if matches!(n.kind, crate::project::NodeKind::Scene) {
            out.push((n.id.clone(), n.title.clone()));
        }
        collect_scene_titles(&n.children, out);
    }
}

/// Alle Fundstellen eines Planungs-Tags — in Szenen, Notizen und den
/// Dokumenten anderer Personen/Orte.
#[tauri::command]
pub fn list_mentions(
    tag_kind: String,
    id: String,
    state: tauri::State<AppState>,
) -> Result<Vec<Mention>, String> {
    if !is_tag_kind(&tag_kind) {
        return Err(format!("Unbekannte Tag-Art: {tag_kind}"));
    }
    validate_id_pub(&id)?;
    with_project(&state, |p| {
        let mut out = Vec::new();

        let mut scenes = Vec::new();
        collect_scene_titles(&p.meta.binder, &mut scenes);
        for (scene_id, title) in scenes {
            let Ok(text) = fs::read_to_string(p.abs(&crate::project::scene_rel_path(&scene_id)))
            else {
                continue;
            };
            collect_mentions(&text, &tag_kind, &id, "scene", &scene_id, &title, &mut out);
        }

        for note in list_note_infos(p) {
            let Ok(text) = fs::read_to_string(p.abs(&note_rel_path(&note.id))) else {
                continue;
            };
            collect_mentions(&text, &tag_kind, &id, "note", &note.id, &note.title, &mut out);
        }

        for (source, dir) in [("character", "characters"), ("location", "locations")] {
            let Ok(entries) = fs::read_dir(p.abs(dir)) else {
                continue;
            };
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|e| e.to_str()) != Some("json") {
                    continue;
                }
                let Ok(raw) = fs::read_to_string(&path) else {
                    continue;
                };
                let Ok(entity) = serde_json::from_str::<Entity>(&raw) else {
                    continue;
                };
                let Ok(text) = fs::read_to_string(p.abs(&entity_doc_rel(dir, &entity.id))) else {
                    continue;
                };
                collect_mentions(
                    &text,
                    &tag_kind,
                    &id,
                    source,
                    &entity.id,
                    &entity.name,
                    &mut out,
                );
            }
        }

        Ok(out)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const TEXT: &str = "Am Abend kam [Er](person:jonas-3f2a1b) durch [den Wald](location:wald-9c11ab).\n\
Später sah [ihn](person:jonas-3f2a1b) niemand mehr.\n\
Hier steht [ein Link](https://example.org) und [jemand anders](person:mara-11aa22).";

    fn mentions(kind: &str, id: &str) -> Vec<Mention> {
        let mut out = Vec::new();
        collect_mentions(TEXT, kind, id, "scene", "szene-aaa111", "Anfang", &mut out);
        out
    }

    #[test]
    fn findet_alle_fundstellen_einer_person() {
        let found = mentions("person", "jonas-3f2a1b");
        assert_eq!(found.len(), 2);
        assert_eq!(found[0].label, "Er");
        assert_eq!(found[0].source_title, "Anfang");
        // Der Kontext zeigt den Satz ohne Tag-Syntax.
        assert_eq!(found[0].context, "Am Abend kam Er durch den Wald.");
        assert_eq!(found[1].label, "ihn");
    }

    #[test]
    fn trennt_arten_und_ids() {
        assert_eq!(mentions("location", "wald-9c11ab").len(), 1);
        assert_eq!(mentions("person", "mara-11aa22").len(), 1);
        // Gleiche ID, andere Art → keine Fundstelle.
        assert!(mentions("location", "jonas-3f2a1b").is_empty());
        assert!(mentions("person", "gibt-es-nicht").is_empty());
    }

    #[test]
    fn ignoriert_fremde_links() {
        assert!(plan_tag_at("[x](https://example.org)", 0).is_none());
        assert!(plan_tag_at("[x](unbekannt:abc)", 0).is_none());
        assert!(plan_tag_at("[x](person:)", 0).is_none());
        // IDs sind immer klein — Großbuchstaben deuten auf etwas anderes hin.
        assert!(plan_tag_at("[x](person:Jonas)", 0).is_none());
        assert!(plan_tag_at("[x](person:jonas-3f2a1b)", 0).is_some());
    }

    #[test]
    fn kuerzt_lange_kontexte() {
        let long = format!("{} [Er](person:jonas-3f2a1b)", "wort ".repeat(80));
        let mut out = Vec::new();
        collect_mentions(&long, "person", "jonas-3f2a1b", "scene", "s", "T", &mut out);
        assert_eq!(out.len(), 1);
        assert!(out[0].context.chars().count() <= 181, "{}", out[0].context);
        assert!(out[0].context.ends_with('…'));
    }

    #[test]
    fn kommt_mit_umlauten_klar() {
        let text = "Draußen stand [er](person:jonas-3f2a1b) – müde.";
        let mut out = Vec::new();
        collect_mentions(text, "person", "jonas-3f2a1b", "note", "n", "Notiz", &mut out);
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].context, "Draußen stand er – müde.");
    }
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
