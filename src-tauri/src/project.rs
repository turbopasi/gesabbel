//! Projekt-Dateiformat (`.autorproj`) und zugehörige Tauri-Commands.
//!
//! Ein Projekt ist ein Ordner mit vielen kleinen Klartextdateien (sync- und
//! git-freundlich). `project.json` hält Metadaten + Binder-Baum; Szenentexte
//! liegen als einzelne Markdown-Dateien flach in `manuscript/`, benannt nach
//! ihrer stabilen Node-ID. Dateien werden beim Umsortieren im Binder NICHT
//! umbenannt oder verschoben — das vermeidet Sync-Konflikte.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::UNIX_EPOCH;

pub const FORMAT_VERSION: u32 = 1;
pub const PROJECT_FILE: &str = "project.json";

// ---------------------------------------------------------------------------
// Datenmodell
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum NodeKind {
    Chapter,
    Scene,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BinderNode {
    pub id: String,
    pub kind: NodeKind,
    pub title: String,
    /// Kurzbeschreibung für die Corkboard-Karteikarte.
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub synopsis: String,
    /// "draft" | "revision" | "done"
    #[serde(default = "default_status", skip_serializing_if = "is_default_status")]
    pub status: String,
    /// Farbcodierung als CSS-Farbe (z. B. "#e6b33f").
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tags: Vec<String>,
    /// Kartenbild fürs Corkboard: projektrelativer Pfad unter `images/`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub image: Option<String>,
    #[serde(default)]
    pub children: Vec<BinderNode>,
}

fn default_status() -> String {
    "draft".into()
}

fn is_default_status(s: &str) -> bool {
    s == "draft"
}

impl BinderNode {
    fn new(id: String, kind: NodeKind, title: String) -> Self {
        BinderNode {
            id,
            kind,
            title,
            synopsis: String::new(),
            status: default_status(),
            color: None,
            tags: Vec::new(),
            image: None,
            children: Vec::new(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProjectMeta {
    pub format_version: u32,
    pub title: String,
    pub author: String,
    pub created: String,
    pub binder: Vec<BinderNode>,
}

/// Zustand des aktuell geöffneten Projekts (im Tauri-State gemanagt).
pub struct OpenProject {
    pub root: PathBuf,
    pub meta: ProjectMeta,
    /// Letzter bekannter mtime (ms) pro projektrelativer Datei — Grundlage
    /// der Erkennung externer Änderungen (Dropbox, zweite Maschine, …).
    pub known_mtimes: HashMap<String, u64>,
    /// true, wenn sich seit dem letzten Suchindex-Aufbau etwas geändert hat.
    pub search_dirty: bool,
}

#[derive(Default)]
pub struct AppState(pub Mutex<Option<OpenProject>>);

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInfo {
    pub root: String,
    pub meta: ProjectMeta,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase", tag = "status")]
pub enum WriteResult {
    /// Erfolgreich geschrieben.
    Ok,
    /// Datei wurde seit letztem bekannten Stand extern verändert;
    /// nicht geschrieben (außer `force`).
    Conflict,
}

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

pub(crate) fn mtime_ms(path: &Path) -> Option<u64> {
    fs::metadata(path)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
}

/// IDs sind slug + Zufallssuffix; nur [a-z0-9-] — schützt zugleich vor
/// Pfad-Traversal, da IDs direkt Dateinamen bilden.
fn validate_id(id: &str) -> Result<(), String> {
    if !id.is_empty()
        && id.len() <= 64
        && id
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
    {
        Ok(())
    } else {
        Err(format!("Ungültige Node-ID: {id:?}"))
    }
}

pub(crate) fn make_id(title: &str) -> String {
    let slug: String = title
        .to_lowercase()
        .chars()
        .map(|c| match c {
            'ä' => "ae".into(),
            'ö' => "oe".into(),
            'ü' => "ue".into(),
            'ß' => "ss".into(),
            c if c.is_ascii_lowercase() || c.is_ascii_digit() => c.to_string(),
            _ => "-".into(),
        })
        .collect();
    let slug: String = slug
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-")
        .chars()
        .take(24)
        .collect();
    let suffix = &uuid::Uuid::new_v4().simple().to_string()[..6];
    if slug.is_empty() {
        format!("node-{suffix}")
    } else {
        format!("{}-{suffix}", slug.trim_end_matches('-'))
    }
}

pub(crate) fn validate_id_pub(id: &str) -> Result<(), String> {
    validate_id(id)
}

pub(crate) fn scene_rel_path(id: &str) -> String {
    format!("manuscript/{id}.md")
}

fn find_node<'a>(nodes: &'a [BinderNode], id: &str) -> Option<&'a BinderNode> {
    for n in nodes {
        if n.id == id {
            return Some(n);
        }
        if let Some(found) = find_node(&n.children, id) {
            return Some(found);
        }
    }
    None
}

fn find_node_mut<'a>(nodes: &'a mut [BinderNode], id: &str) -> Option<&'a mut BinderNode> {
    for n in nodes {
        if n.id == id {
            return Some(n);
        }
        if let Some(found) = find_node_mut(&mut n.children, id) {
            return Some(found);
        }
    }
    None
}

/// Entfernt den Node mit `id` aus dem Baum und gibt ihn zurück.
fn remove_node(nodes: &mut Vec<BinderNode>, id: &str) -> Option<BinderNode> {
    if let Some(pos) = nodes.iter().position(|n| n.id == id) {
        return Some(nodes.remove(pos));
    }
    for n in nodes.iter_mut() {
        if let Some(found) = remove_node(&mut n.children, id) {
            return Some(found);
        }
    }
    None
}

pub(crate) fn collect_scene_ids(node: &BinderNode, out: &mut Vec<String>) {
    if node.kind == NodeKind::Scene {
        out.push(node.id.clone());
    }
    for c in &node.children {
        collect_scene_ids(c, out);
    }
}

fn is_descendant(nodes: &[BinderNode], ancestor_id: &str, id: &str) -> bool {
    match find_node(nodes, ancestor_id) {
        Some(n) => find_node(&n.children, id).is_some(),
        None => false,
    }
}

impl OpenProject {
    pub(crate) fn abs(&self, rel: &str) -> PathBuf {
        self.root.join(rel)
    }

    /// Merkt sich den aktuellen mtime einer Datei als "bekannt".
    pub(crate) fn note_mtime(&mut self, rel: &str) {
        if let Some(mt) = mtime_ms(&self.abs(rel)) {
            self.known_mtimes.insert(rel.into(), mt);
        }
    }

    pub(crate) fn write_meta(&mut self) -> Result<(), String> {
        let json = serde_json::to_string_pretty(&self.meta)
            .map_err(|e| format!("Serialisierung fehlgeschlagen: {e}"))?;
        let path = self.abs(PROJECT_FILE);
        fs::write(&path, json).map_err(|e| format!("project.json schreiben: {e}"))?;
        self.note_mtime(PROJECT_FILE);
        self.search_dirty = true;
        Ok(())
    }

    fn snapshot_mtimes(&mut self) {
        self.known_mtimes.clear();
        let mut ids = Vec::new();
        for n in &self.meta.binder {
            collect_scene_ids(n, &mut ids);
        }
        for id in ids {
            self.note_mtime(&scene_rel_path(&id));
        }
        self.note_mtime(PROJECT_FILE);
        self.note_mtime("timeline.json");
        self.note_mtime(crate::research::NOTES_INDEX);
        for note in crate::research::list_note_infos(self) {
            self.note_mtime(&crate::research::note_rel_path(&note.id));
        }
    }

    fn info(&self) -> ProjectInfo {
        ProjectInfo {
            root: self.root.to_string_lossy().into_owned(),
            meta: self.meta.clone(),
        }
    }
}

pub(crate) fn with_project<T>(
    state: &tauri::State<AppState>,
    f: impl FnOnce(&mut OpenProject) -> Result<T, String>,
) -> Result<T, String> {
    let mut guard = state.0.lock().map_err(|_| "State-Lock vergiftet".to_string())?;
    let project = guard.as_mut().ok_or("Kein Projekt geöffnet")?;
    f(project)
}

// ---------------------------------------------------------------------------
// Commands: Projekt-Lebenszyklus
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn create_project(
    parent_dir: String,
    name: String,
    title: String,
    author: String,
    state: tauri::State<AppState>,
) -> Result<ProjectInfo, String> {
    let safe_name: String = name
        .chars()
        .filter(|c| !matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|'))
        .collect::<String>()
        .trim()
        .to_string();
    if safe_name.is_empty() {
        return Err("Projektname ist leer".into());
    }
    let root = Path::new(&parent_dir).join(format!("{safe_name}.autorproj"));
    if root.exists() {
        return Err(format!("Ordner existiert bereits: {}", root.display()));
    }

    for dir in ["manuscript", "notes", "characters", "locations", ".cache"] {
        fs::create_dir_all(root.join(dir)).map_err(|e| format!("Ordner anlegen ({dir}): {e}"))?;
    }
    // Vorbereitung für Ebene C (Phase 5): Cache und Papierkorb gehören nicht ins Repo.
    fs::write(root.join(".gitignore"), ".cache/\n.trash/\n")
        .map_err(|e| format!(".gitignore schreiben: {e}"))?;
    fs::write(root.join("timeline.json"), "{\n  \"events\": []\n}\n")
        .map_err(|e| format!("timeline.json schreiben: {e}"))?;

    let scene_id = make_id("Szene 1");
    fs::write(root.join(scene_rel_path(&scene_id)), "")
        .map_err(|e| format!("Szenendatei anlegen: {e}"))?;

    let meta = ProjectMeta {
        format_version: FORMAT_VERSION,
        title: if title.trim().is_empty() { safe_name.clone() } else { title },
        author,
        created: chrono::Local::now().to_rfc3339(),
        binder: vec![{
            let mut chapter =
                BinderNode::new(make_id("Kapitel 1"), NodeKind::Chapter, "Kapitel 1".into());
            chapter
                .children
                .push(BinderNode::new(scene_id, NodeKind::Scene, "Szene 1".into()));
            chapter
        }],
    };

    let mut project = OpenProject {
        root,
        meta,
        known_mtimes: HashMap::new(),
        search_dirty: true,
    };
    project.write_meta()?;
    project.snapshot_mtimes();
    // Ebene C: Versionierung ab dem ersten Moment.
    crate::versioning::ensure_repo(&project.root, &project.meta.author, "Projekt angelegt")?;
    let info = project.info();
    *state.0.lock().map_err(|_| "State-Lock vergiftet")? = Some(project);
    Ok(info)
}

#[tauri::command]
pub fn open_project(path: String, state: tauri::State<AppState>) -> Result<ProjectInfo, String> {
    let root = PathBuf::from(&path);
    let meta_path = root.join(PROJECT_FILE);
    if !meta_path.is_file() {
        return Err(format!(
            "Kein Projekt: {} enthält keine {PROJECT_FILE}",
            root.display()
        ));
    }
    let raw = fs::read_to_string(&meta_path).map_err(|e| format!("project.json lesen: {e}"))?;
    let meta: ProjectMeta =
        serde_json::from_str(&raw).map_err(|e| format!("project.json ungültig: {e}"))?;
    if meta.format_version > FORMAT_VERSION {
        return Err(format!(
            "Projektformat v{} ist neuer als diese App-Version unterstützt (v{FORMAT_VERSION})",
            meta.format_version
        ));
    }
    let mut project = OpenProject {
        root,
        meta,
        known_mtimes: HashMap::new(),
        search_dirty: true,
    };
    project.snapshot_mtimes();
    // Ebene C: Repo bei Altprojekten nachrüsten; externen Stand als Basis sichern.
    crate::versioning::ensure_repo(
        &project.root,
        &project.meta.author,
        "Automatischer Sicherungspunkt (Projekt geöffnet)",
    )?;
    let info = project.info();
    *state.0.lock().map_err(|_| "State-Lock vergiftet")? = Some(project);
    Ok(info)
}

#[tauri::command]
pub fn close_project(state: tauri::State<AppState>) -> Result<(), String> {
    *state.0.lock().map_err(|_| "State-Lock vergiftet")? = None;
    Ok(())
}

// ---------------------------------------------------------------------------
// Commands: Szenen lesen/schreiben
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn read_scene(id: String, state: tauri::State<AppState>) -> Result<String, String> {
    validate_id(&id)?;
    with_project(&state, |p| {
        let rel = scene_rel_path(&id);
        let content =
            fs::read_to_string(p.abs(&rel)).map_err(|e| format!("Szene lesen ({id}): {e}"))?;
        if let Some(mt) = mtime_ms(&p.abs(&rel)) {
            p.known_mtimes.insert(rel, mt);
        }
        Ok(content)
    })
}

#[tauri::command]
pub fn write_scene(
    id: String,
    content: String,
    force: bool,
    state: tauri::State<AppState>,
) -> Result<WriteResult, String> {
    validate_id(&id)?;
    with_project(&state, |p| {
        let rel = scene_rel_path(&id);
        let path = p.abs(&rel);
        // Externe Änderung? Nur blockieren, wenn wir einen früheren Stand kennen.
        if !force {
            if let (Some(known), Some(current)) = (p.known_mtimes.get(&rel), mtime_ms(&path)) {
                if current != *known {
                    return Ok(WriteResult::Conflict);
                }
            }
        }
        fs::write(&path, &content).map_err(|e| format!("Szene schreiben ({id}): {e}"))?;
        if let Some(mt) = mtime_ms(&path) {
            p.known_mtimes.insert(rel, mt);
        }
        p.search_dirty = true;
        Ok(WriteResult::Ok)
    })
}

// ---------------------------------------------------------------------------
// Commands: Binder-Mutationen (Rust ist Owner von project.json)
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn create_node(
    parent_id: Option<String>,
    kind: NodeKind,
    title: String,
    state: tauri::State<AppState>,
) -> Result<ProjectInfo, String> {
    with_project(&state, |p| {
        let id = make_id(&title);
        if kind == NodeKind::Scene {
            fs::write(p.abs(&scene_rel_path(&id)), "")
                .map_err(|e| format!("Szenendatei anlegen: {e}"))?;
            let rel = scene_rel_path(&id);
            if let Some(mt) = mtime_ms(&p.abs(&rel)) {
                p.known_mtimes.insert(rel, mt);
            }
        }
        let node = BinderNode::new(id, kind, title);
        match parent_id {
            Some(pid) => find_node_mut(&mut p.meta.binder, &pid)
                .ok_or(format!("Parent nicht gefunden: {pid}"))?
                .children
                .push(node),
            None => p.meta.binder.push(node),
        }
        p.write_meta()?;
        Ok(p.info())
    })
}

#[tauri::command]
pub fn rename_node(
    id: String,
    title: String,
    state: tauri::State<AppState>,
) -> Result<ProjectInfo, String> {
    with_project(&state, |p| {
        find_node_mut(&mut p.meta.binder, &id)
            .ok_or(format!("Node nicht gefunden: {id}"))?
            .title = title;
        p.write_meta()?;
        Ok(p.info())
    })
}

#[tauri::command]
pub fn move_node(
    id: String,
    new_parent_id: Option<String>,
    index: usize,
    state: tauri::State<AppState>,
) -> Result<ProjectInfo, String> {
    with_project(&state, |p| {
        if let Some(pid) = &new_parent_id {
            if *pid == id || is_descendant(&p.meta.binder, &id, pid) {
                return Err("Node kann nicht in sich selbst verschoben werden".into());
            }
        }
        let node =
            remove_node(&mut p.meta.binder, &id).ok_or(format!("Node nicht gefunden: {id}"))?;
        let target = match &new_parent_id {
            Some(pid) => {
                &mut find_node_mut(&mut p.meta.binder, pid)
                    .ok_or(format!("Parent nicht gefunden: {pid}"))?
                    .children
            }
            None => &mut p.meta.binder,
        };
        target.insert(index.min(target.len()), node);
        p.write_meta()?;
        Ok(p.info())
    })
}

/// Teil-Update der Szenen-/Kapitel-Metadaten. Nicht übergebene Felder bleiben
/// unverändert; `color: ""` löscht die Farbe.
#[tauri::command]
pub fn update_node_meta(
    id: String,
    synopsis: Option<String>,
    status: Option<String>,
    color: Option<String>,
    tags: Option<Vec<String>>,
    image: Option<String>,
    state: tauri::State<AppState>,
) -> Result<ProjectInfo, String> {
    with_project(&state, |p| {
        let node = find_node_mut(&mut p.meta.binder, &id)
            .ok_or(format!("Node nicht gefunden: {id}"))?;
        if let Some(s) = synopsis {
            node.synopsis = s;
        }
        if let Some(img) = image {
            if !img.is_empty() && (!img.starts_with("images/") || img.contains("..")) {
                return Err(format!("Ungültiger Bildpfad: {img}"));
            }
            node.image = if img.is_empty() { None } else { Some(img) };
        }
        if let Some(s) = status {
            if !["draft", "revision", "done"].contains(&s.as_str()) {
                return Err(format!("Unbekannter Status: {s}"));
            }
            node.status = s;
        }
        if let Some(c) = color {
            node.color = if c.is_empty() { None } else { Some(c) };
        }
        if let Some(t) = tags {
            node.tags = t;
        }
        p.write_meta()?;
        Ok(p.info())
    })
}

/// Löscht einen Node; zugehörige Szenendateien wandern in `.trash/` statt
/// endgültig gelöscht zu werden.
#[tauri::command]
pub fn delete_node(id: String, state: tauri::State<AppState>) -> Result<ProjectInfo, String> {
    with_project(&state, |p| {
        let node =
            remove_node(&mut p.meta.binder, &id).ok_or(format!("Node nicht gefunden: {id}"))?;
        let mut scene_ids = Vec::new();
        collect_scene_ids(&node, &mut scene_ids);
        if !scene_ids.is_empty() {
            let trash = p.root.join(".trash");
            fs::create_dir_all(&trash).map_err(|e| format!(".trash anlegen: {e}"))?;
            let stamp = chrono::Local::now().format("%Y%m%d-%H%M%S");
            for sid in scene_ids {
                let rel = scene_rel_path(&sid);
                let src = p.abs(&rel);
                if src.exists() {
                    fs::rename(&src, trash.join(format!("{stamp}-{sid}.md")))
                        .map_err(|e| format!("In Papierkorb verschieben ({sid}): {e}"))?;
                }
                p.known_mtimes.remove(&rel);
            }
        }
        p.write_meta()?;
        Ok(p.info())
    })
}

// ---------------------------------------------------------------------------
// Commands: Externe Änderungen
// ---------------------------------------------------------------------------

/// Vergleicht mtimes aller bekannten Dateien mit dem letzten bekannten Stand.
/// Aufruf bei Fenster-Fokus. Rückgabe: projektrelative Pfade mit Abweichung.
#[tauri::command]
pub fn check_external_changes(state: tauri::State<AppState>) -> Result<Vec<String>, String> {
    with_project(&state, |p| {
        let changed = p
            .known_mtimes
            .iter()
            .filter(|(rel, known)| mtime_ms(&p.abs(rel)) != Some(**known))
            .map(|(rel, _)| rel.clone())
            .collect();
        Ok(changed)
    })
}
