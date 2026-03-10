mod config;
mod pipeline;

use config::{ConfigDb, SavedConfig};
use pipeline::{GenerateConfig, PipelineEvent};
use tauri::{Emitter, Manager};

#[tauri::command]
async fn generate(app: tauri::AppHandle, config: GenerateConfig) -> Result<String, String> {
    pipeline::run(config, move |event: PipelineEvent| {
        let _ = app.emit("pipeline-progress", &event);
    })
    .await
    .map_err(|e| format!("{e}"))
}

#[tauri::command]
fn load_config(state: tauri::State<'_, ConfigDb>) -> SavedConfig {
    state.load_all()
}

#[tauri::command]
fn save_config(state: tauri::State<'_, ConfigDb>, config: SavedConfig) {
    state.save_all(&config);
}

#[tauri::command]
fn get_default_video_dir(app: tauri::AppHandle) -> Result<String, String> {
    let video_dir = app
        .path()
        .video_dir()
        .map_err(|e| format!("failed to resolve video dir: {e}"))?;
    let dir = video_dir.join("NarrateThis");
    std::fs::create_dir_all(&dir).map_err(|e| format!("failed to create output dir: {e}"))?;
    Ok(dir.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");
            let db = ConfigDb::open(data_dir).expect("failed to open config db");
            app.manage(db);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            generate,
            load_config,
            save_config,
            get_default_video_dir
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
