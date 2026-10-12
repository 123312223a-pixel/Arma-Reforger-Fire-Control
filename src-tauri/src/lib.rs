use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

const STATE_FILE: &str = "reforger-state.json";
const STATE_BACKUP: &str = "reforger-state.previous.json";
const MAX_STATE_BYTES: usize = 8 * 1024 * 1024;

fn state_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn validate_json(raw: &str) -> Result<(), String> {
    if raw.len() > MAX_STATE_BYTES {
        return Err("JSON exceeds the 8 MiB limit".to_string());
    }
    let parsed: serde_json::Value = serde_json::from_str(raw).map_err(|e| e.to_string())?;
    if !parsed.is_object() {
        return Err("State must be a JSON object".to_string());
    }
    Ok(())
}

#[tauri::command]
fn get_data_directory(app: AppHandle) -> Result<String, String> {
    Ok(state_dir(&app)?.display().to_string())
}

#[tauri::command]
fn load_state(app: AppHandle) -> Result<Option<String>, String> {
    let dir = state_dir(&app)?;
    for name in [STATE_FILE, STATE_BACKUP] {
        let path = dir.join(name);
        match fs::read_to_string(&path) {
            Ok(raw) if validate_json(&raw).is_ok() => return Ok(Some(raw)),
            Ok(_) => continue, // Corrupt file: fall back to previous good snapshot.
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => continue,
            Err(e) => return Err(e.to_string()),
        }
    }
    Ok(None)
}

#[tauri::command]
fn store_state(app: AppHandle, json: String) -> Result<(), String> {
    validate_json(&json)?;
    let dir = state_dir(&app)?;
    let destination = dir.join(STATE_FILE);
    let previous = dir.join(STATE_BACKUP);
    let temporary = dir.join("reforger-state.next.json");
    fs::write(&temporary, json.as_bytes()).map_err(|e| e.to_string())?;
    // Windows does not allow rename() over an existing destination.
    // Preserve the last valid version first, then promote the new file.
    if destination.is_file() {
        fs::copy(&destination, &previous).map_err(|e| e.to_string())?;
        fs::remove_file(&destination).map_err(|e| e.to_string())?;
    }
    fs::rename(&temporary, &destination).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn backup_state(app: AppHandle) -> Result<String, String> {
    let dir = state_dir(&app)?;
    let raw = load_state(app.clone())?.ok_or("No state to back up")?;
    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs();
    let target = dir.join(format!("reforger-backup-{}.json", seconds));
    fs::write(&target, raw.as_bytes()).map_err(|e| e.to_string())?;
    Ok(target.display().to_string())
}

#[tauri::command]
fn updater_available() -> bool {
    cfg!(feature = "signed-updates")
}

pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_http::init());
    // Unsigned development builds intentionally have no update permissions.
    // Official update-capable builds use --features signed-updates and a
    // generated Tauri config overlay with trusted endpoints and public key.
    #[cfg(feature = "signed-updates")]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());

    builder
        .invoke_handler(tauri::generate_handler![
            load_state,
            store_state,
            backup_state,
            get_data_directory,
            updater_available
        ])
        .run(tauri::generate_context!())
        .expect("Failed to start Arma Reforger Fire Control");
}
